import { NextResponse } from 'next/server';
import { parseClienteInput } from '@/lib/clientes';
import {
  getContextoAgencia,
  listarContasSeguro,
  respostaErro,
  traduzirErroBanco,
  validarContaInstagram,
} from '@/lib/clientes-server';

// GET: lista os clientes da agência e as contas de Instagram do usuário
// (para o seletor de vínculo). Por padrão só os ativos; ?arquivados=1 traz todos.
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const incluirArquivados = new URL(req.url).searchParams.get('arquivados') === '1';

  let query = supabase.from('clientes').select('*').order('nome', { ascending: true });
  if (!incluirArquivados) query = query.eq('ativo', true);

  const { data: clientes, error } = await query;
  if (error) return traduzirErroBanco(error, 'GET /api/clientes');

  // Só campos públicos: nunca o access_token.
  const contas = await listarContasSeguro(user.id);

  return NextResponse.json({ clientes: clientes ?? [], contas });
}

// POST: cria um cliente. A agência vem do membro autenticado, nunca do corpo.
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user, membro } = auth.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  const parsed = parseClienteInput(body, 'criar');
  if (!parsed.ok) return respostaErro(parsed.error, 400);

  const contaId = parsed.data.instagram_account_id;
  if (typeof contaId === 'string' && !(await validarContaInstagram(user.id, contaId))) {
    return respostaErro('Conta de Instagram não encontrada.', 400);
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...parsed.data, agencia_id: membro.agencia_id })
    .select('*')
    .single();

  if (error) return traduzirErroBanco(error, 'POST /api/clientes');
  return NextResponse.json({ cliente: data }, { status: 201 });
}
