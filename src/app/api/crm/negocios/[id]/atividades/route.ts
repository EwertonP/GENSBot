import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

type Params = { params: Promise<{ id: string }> };

// GET: Lista as atividades do negócio
export async function GET(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  const { id } = await params;
  try {
    const { data, error } = await serviceSupabase
      .from('crm_atividades')
      .select('*, membro:membros!membro_id(id, nome)')
      .eq('negocio_id', id)
      .eq('agencia_id', membro.agencia_id)
      .order('criado_em', { ascending: false });

    if (error) return traduzirErroBanco(error, 'GET /api/crm/negocios/[id]/atividades');
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Erro ao listar atividades:', err);
    return respostaErro('Falha interna ao carregar atividades.', 500);
  }
}

// POST: Registra uma nova anotação / atividade manual
export async function POST(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro, user } = auth.ctx;

  const { id } = await params;
  try {
    const body = await req.json();
    const { tipo = 'nota', descricao, dados_extras } = body;

    if (!descricao?.trim()) {
      return respostaErro('O texto da nota é obrigatório.', 400);
    }

    const { data, error } = await serviceSupabase
      .from('crm_atividades')
      .insert({
        negocio_id: id,
        agencia_id: membro.agencia_id,
        membro_id: user.id,
        tipo,
        descricao: descricao.trim(),
        dados_extras: dados_extras || null,
      })
      .select('*, membro:membros!membro_id(id, nome)')
      .single();

    if (error) return traduzirErroBanco(error, 'POST /api/crm/negocios/[id]/atividades');

    // Atualiza o timestamp de último contato no negócio
    await serviceSupabase
      .from('crm_negocios')
      .update({ ultimo_contato_em: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Erro ao salvar atividade:', err);
    return respostaErro('Falha interna ao salvar nota.', 500);
  }
}
