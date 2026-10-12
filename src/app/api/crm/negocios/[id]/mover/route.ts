import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

const SELECT_NEGOCIO = `
  *,
  responsavel:membros!responsavel_id(id, nome, email, cargo),
  estagio:crm_estagios!estagio_id(id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado),
  cliente:clientes!cliente_id(id, nome, cor)
`;

// Handler compartilhado para mover negócios entre etapas
async function moverNegocioHandler(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro, user } = auth.ctx;

  const { id } = await params;
  try {
    const body = await req.json();
    const { estagio_id, ordem_no_estagio = 0, motivo_perda, valor_final } = body;

    if (!estagio_id) {
      return respostaErro('O estagio_id é obrigatório.', 400);
    }

    // 1. Busca o negócio atual e o estágio de destino
    const [{ data: negocioAtual }, { data: novoEstagio }] = await Promise.all([
      serviceSupabase
        .from('crm_negocios')
        .select('*, estagio:crm_estagios(nome)')
        .eq('id', id)
        .eq('agencia_id', membro.agencia_id)
        .maybeSingle(),
      serviceSupabase
        .from('crm_estagios')
        .select('*')
        .eq('id', estagio_id)
        .maybeSingle(),
    ]);

    if (!negocioAtual) return respostaErro('Negócio não encontrado.', 404);
    if (!novoEstagio) return respostaErro('Estágio de destino não encontrado.', 404);

    const estagioAnteriorNome = negocioAtual.estagio?.nome || 'Etapa anterior';
    const novoEstagioNome = novoEstagio.nome;

    // 2. Determina o novo status baseado no estágio de destino
    let novoStatus: 'aberto' | 'ganho' | 'perdido' = 'aberto';
    let dataConclusao: string | null = null;
    let tipoAtividade: 'mudanca_estagio' | 'ganho' | 'perda' = 'mudanca_estagio';
    let descricaoAtividade = `Card movido de "${estagioAnteriorNome}" para "${novoEstagioNome}"`;

    if (novoEstagio.tipo_conclusao === 'ganho') {
      novoStatus = 'ganho';
      dataConclusao = new Date().toISOString();
      tipoAtividade = 'ganho';
      descricaoAtividade = `🏆 Oportunidade GANHA na etapa "${novoEstagioNome}"!`;
    } else if (novoEstagio.tipo_conclusao === 'perdido') {
      novoStatus = 'perdido';
      dataConclusao = new Date().toISOString();
      tipoAtividade = 'perda';
      descricaoAtividade = `❌ Oportunidade perdida na etapa "${novoEstagioNome}". Motivo: ${motivo_perda || 'Não especificado'}`;
    }

    const updates: Record<string, any> = {
      estagio_id,
      ordem_no_estagio,
      status: novoStatus,
      data_conclusao: dataConclusao,
      ultimo_contato_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    if (motivo_perda !== undefined) updates.motivo_perda = motivo_perda || null;
    if (valor_final !== undefined && valor_final !== null) updates.valor = Number(valor_final);

    const { data: atualizado, error } = await serviceSupabase
      .from('crm_negocios')
      .update(updates)
      .eq('id', id)
      .eq('agencia_id', membro.agencia_id)
      .select(SELECT_NEGOCIO)
      .single();

    if (error) return traduzirErroBanco(error, 'POST /api/crm/negocios/[id]/mover');

    // 3. Registra na timeline de atividades
    await serviceSupabase.from('crm_atividades').insert({
      negocio_id: id,
      agencia_id: membro.agencia_id,
      membro_id: user.id,
      tipo: tipoAtividade,
      descricao: descricaoAtividade,
      dados_extras: {
        de_estagio: estagioAnteriorNome,
        para_estagio: novoEstagioNome,
        motivo_perda: updates.motivo_perda,
      },
    });



    return NextResponse.json(atualizado);
  } catch (err: any) {
    console.error('Erro ao mover negócio:', err);
    return respostaErro('Falha interna ao movimentar negócio.', 500);
  }
}

export async function POST(req: Request, ctx: Params) {
  return moverNegocioHandler(req, ctx);
}

export async function PATCH(req: Request, ctx: Params) {
  return moverNegocioHandler(req, ctx);
}
