import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

export interface LegendaPadrao {
  id: string;
  agencia_id: string;
  cliente_id: string;
  nome: string;
  texto: string;
  criado_em: string;
}

/** GET /api/legendas-padrao?cliente_id=...: lista modelos de legenda do cliente. */
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id');
  if (!clienteId || !/^[0-9a-f-]{36}$/i.test(clienteId)) {
    return respostaErro('cliente_id inválido.', 400);
  }

  const { data, error } = await db
    .from('legendas_padrao')
    .select('id, agencia_id, cliente_id, nome, texto, criado_em')
    .eq('agencia_id', auth.ctx.membro.agencia_id)
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false });

  if (error) {
    // Se a tabela ainda não foi criada, retorna array vazio graciosamente
    if (error.code === '42P01') {
      return NextResponse.json({ legendas: [] });
    }
    return traduzirErroBanco(error, 'ler os modelos de legenda');
  }

  return NextResponse.json({ legendas: data ?? [] });
}

/** POST /api/legendas-padrao { cliente_id, nome, texto }: cria um modelo de legenda. */
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;

  const corpo = (await req.json().catch(() => null)) as {
    cliente_id?: unknown;
    nome?: unknown;
    texto?: unknown;
  } | null;

  const clienteId = typeof corpo?.cliente_id === 'string' ? corpo.cliente_id.trim() : '';
  const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : '';
  const texto = typeof corpo?.texto === 'string' ? corpo.texto.trim() : '';

  if (!clienteId || !/^[0-9a-f-]{36}$/i.test(clienteId)) {
    return respostaErro('Selecione um cliente válido.', 400);
  }
  if (!nome || nome.length > 80) {
    return respostaErro('Dê um nome de até 80 caracteres ao modelo de legenda.', 400);
  }
  if (!texto) {
    return respostaErro('O texto da legenda não pode ser vazio.', 400);
  }

  const { data, error } = await db
    .from('legendas_padrao')
    .insert({
      agencia_id: auth.ctx.membro.agencia_id,
      cliente_id: clienteId,
      nome,
      texto,
    })
    .select('id, agencia_id, cliente_id, nome, texto, criado_em')
    .single();

  if (error) {
    return traduzirErroBanco(error, 'salvar o modelo de legenda');
  }

  return NextResponse.json({ legenda: data }, { status: 201 });
}
