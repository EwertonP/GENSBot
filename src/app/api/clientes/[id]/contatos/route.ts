import { NextResponse } from 'next/server';
import { ehUuid, parseContatoInput } from '@/lib/clientes';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

type Params = { params: Promise<{ id: string }> };

// POST: adiciona um contato ao cliente.
export async function POST(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  const parsed = parseContatoInput(body);
  if (!parsed.ok) return respostaErro(parsed.error, 400);

  // A agência do contato vem do cliente pai. Se a RLS esconde o cliente, é 404.
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('id, agencia_id')
    .eq('id', id)
    .maybeSingle();
  if (erroCliente) return traduzirErroBanco(erroCliente, 'POST contatos (cliente)');
  if (!cliente) return respostaErro('Cliente não encontrado.', 404);

  const { data, error } = await supabase
    .from('cliente_contatos')
    .insert({ ...parsed.data, cliente_id: cliente.id, agencia_id: cliente.agencia_id })
    .select('*')
    .single();

  if (error) return traduzirErroBanco(error, 'POST /api/clientes/[id]/contatos');
  return NextResponse.json({ contato: data }, { status: 201 });
}
