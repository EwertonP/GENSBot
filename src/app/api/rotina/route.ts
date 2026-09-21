import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

export interface TarefaRotina {
  id: string;
  agencia_id: string;
  cliente_id: string | null;
  responsavel_id: string | null;
  titulo: string;
  descricao: string | null;
  status: 'pendente' | 'concluido';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  prazo: string | null;
  concluido_em: string | null;
  criado_em: string;
  cliente?: {
    id: string;
    nome: string;
    cor: string | null;
    foto_url: string | null;
  } | null;
  responsavel?: {
    id: string;
    nome: string;
    email: string;
    cargo: string | null;
  } | null;
}

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const responsavelId = searchParams.get('responsavel_id');
  const clienteId = searchParams.get('cliente_id');

  let query = supabase
    .from('tarefas')
    .select(`
      *,
      cliente:clientes(id, nome, cor, foto_url),
      responsavel:membros!responsavel_id(id, nome, email, cargo)
    `)
    .eq('agencia_id', membro.agencia_id)
    .order('criado_em', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  if (responsavelId) {
    query = query.eq('responsavel_id', responsavelId);
  }
  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  }

  const { data, error } = await query;
  if (error) {
    return traduzirErroBanco(error, 'GET /api/rotina');
  }

  return NextResponse.json({ tarefas: data || [] });
}

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user, membro } = auth.ctx;

  try {
    const body = await req.json();
    const {
      titulo,
      descricao,
      prioridade = 'normal',
      prazo,
      cliente_id,
      responsavel_id,
    } = body;

    if (!titulo?.trim()) {
      return respostaErro('O título da tarefa é obrigatório.', 400);
    }

    const { data, error } = await supabase
      .from('tarefas')
      .insert({
        agencia_id: membro.agencia_id,
        cliente_id: cliente_id || null,
        responsavel_id: responsavel_id || user.id,
        titulo: titulo.trim(),
        descricao: descricao?.trim() || null,
        status: 'pendente',
        prioridade,
        prazo: prazo || null,
      })
      .select(`
        *,
        cliente:clientes(id, nome, cor, foto_url),
        responsavel:membros!responsavel_id(id, nome, email, cargo)
      `)
      .single();

    if (error) {
      return traduzirErroBanco(error, 'POST /api/rotina');
    }

    return NextResponse.json({ tarefa: data }, { status: 201 });
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }
}
