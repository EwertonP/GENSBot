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
  const contasMap = new Map(contas.map((c) => [c.id, c]));

  const clientesTratados = (clientes ?? []).map((c) => {
    const conta = c.instagram_account_id ? contasMap.get(c.instagram_account_id) : null;
    return {
      ...c,
      foto_url: c.foto_url || conta?.profile_picture_url || null,
      instagram_username: conta?.instagram_username || null,
    };
  });

  return NextResponse.json({ clientes: clientesTratados, contas });
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

  // Se foto_url não foi informada manualmente, herda a foto de perfil do Instagram conectado
  let fotoUrl = parsed.data.foto_url;
  if (!fotoUrl && contaId) {
    const { data: conta } = await supabase
      .from('instagram_accounts')
      .select('profile_picture_url')
      .eq('id', contaId)
      .maybeSingle();
    if (conta?.profile_picture_url) {
      fotoUrl = conta.profile_picture_url;
    }
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...parsed.data, foto_url: fotoUrl, agencia_id: membro.agencia_id })
    .select('*')
    .single();

  if (error) return traduzirErroBanco(error, 'POST /api/clientes');
  return NextResponse.json({ cliente: data }, { status: 201 });
}
