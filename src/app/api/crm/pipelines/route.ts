import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { garantirPipelinePadrao } from '@/lib/crm';

// GET: Lista os pipelines e estágios do escopo selecionado (Agência ou Cliente)
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  let clienteId = searchParams.get('cliente_id');

  // Se o usuário logado for do perfil cliente, força estritamente o cliente dele
  if (membro.papel === 'cliente') {
    if (!membro.cliente_id) {
      return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
    }
    clienteId = membro.cliente_id;
  }

  const ehAgencia = !clienteId || clienteId === 'agencia' || clienteId === 'null';

  try {
    let clienteNome: string | null = null;
    let clienteNicho: string | null = null;
    if (!ehAgencia && clienteId) {
      const { data: cli } = await serviceSupabase
        .from('clientes')
        .select('nome, nicho')
        .eq('id', clienteId)
        .eq('agencia_id', membro.agencia_id)
        .maybeSingle();
      clienteNome = cli?.nome || null;
      clienteNicho = cli?.nicho || null;
    }

    // Garante que exista pelo menos um pipeline padrão caso seja o primeiro acesso (com auto-detecção de nicho)
    await garantirPipelinePadrao(membro.agencia_id, ehAgencia ? null : clienteId, clienteNome, clienteNicho);

    let query = serviceSupabase
      .from('crm_pipelines')
      .select('*, estagios:crm_estagios(*)')
      .eq('agencia_id', membro.agencia_id)
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (ehAgencia) {
      query = query.is('cliente_id', null);
    } else {
      query = query.eq('cliente_id', clienteId);
    }

    const { data: pipelines, error } = await query;
    if (error) return traduzirErroBanco(error, 'GET /api/crm/pipelines');

    const formatados = (pipelines || []).map((p) => ({
      ...p,
      estagios: (p.estagios || []).sort((a: any, b: any) => a.ordem - b.ordem),
    }));

    return NextResponse.json(formatados);
  } catch (err: any) {
    console.error('Erro ao buscar pipelines:', err);
    return respostaErro('Falha interna ao carregar pipelines do CRM.', 500);
  }
}

// POST: Cria um novo pipeline personalizado
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    let { nome, descricao, cliente_id, estagios = [] } = body;

    // Se o usuário logado for do perfil cliente, força estritamente o cliente dele
    if (membro.papel === 'cliente') {
      if (!membro.cliente_id) {
        return respostaErro('Usuário de cliente sem cliente vinculado.', 403);
      }
      cliente_id = membro.cliente_id;
    }

    if (!nome?.trim()) {
      return respostaErro('O nome do funil é obrigatório.', 400);
    }

    const { data: pipe, error: pipeErr } = await serviceSupabase
      .from('crm_pipelines')
      .insert({
        agencia_id: membro.agencia_id,
        cliente_id: cliente_id || null,
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        ativo: true,
      })
      .select()
      .single();

    if (pipeErr || !pipe) {
      return traduzirErroBanco(pipeErr || { message: 'Falha ao criar funil' }, 'POST /api/crm/pipelines');
    }

    // Se foram enviados estágios customizados, cria-os; caso contrário, usa os padrões
    const listaEstagios = Array.isArray(estagios) && estagios.length > 0
      ? estagios.map((e: any, idx: number) => ({
          pipeline_id: pipe.id,
          nome: e.nome || `Etapa ${idx + 1}`,
          cor: e.cor || '#3b82f6',
          ordem: idx,
          tipo_conclusao: e.tipo_conclusao || 'aberto',
          dias_limite_estagnado: e.dias_limite_estagnado ?? 3,
        }))
      : [
          { pipeline_id: pipe.id, nome: 'Novo Lead', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
          { pipeline_id: pipe.id, nome: 'Em Contato', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
          { pipeline_id: pipe.id, nome: 'Proposta / Agendado', cor: '#f59e0b', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
          { pipeline_id: pipe.id, nome: 'Venda Fechada', cor: '#10b981', ordem: 3, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
          { pipeline_id: pipe.id, nome: 'Perdido', cor: '#ef4444', ordem: 4, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
        ];

    const { data: estagiosSalvos } = await serviceSupabase
      .from('crm_estagios')
      .insert(listaEstagios)
      .select()
      .order('ordem', { ascending: true });

    return NextResponse.json({ ...pipe, estagios: estagiosSalvos || [] }, { status: 201 });
  } catch (err: any) {
    console.error('Erro ao criar pipeline:', err);
    return respostaErro('Falha interna ao criar pipeline.', 500);
  }
}
