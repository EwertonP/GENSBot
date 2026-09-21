import { NextResponse } from 'next/server';
import { ehUuid, parseClienteInput } from '@/lib/clientes';
import {
  getContextoAgencia,
  respostaErro,
  traduzirErroBanco,
  validarContaInstagram,
} from '@/lib/clientes-server';

type Params = { params: Promise<{ id: string }> };

// GET: um cliente com seus contatos.
export async function GET(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  // A RLS já limita à agência: cliente de outra agência simplesmente não aparece.
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return traduzirErroBanco(error, 'GET /api/clientes/[id]');
  if (!cliente) return respostaErro('Cliente não encontrado.', 404);

  let clienteFinal = cliente;
  if (!clienteFinal.foto_url && clienteFinal.instagram_account_id) {
    const { data: conta } = await supabase
      .from('instagram_accounts')
      .select('profile_picture_url, instagram_username')
      .eq('id', clienteFinal.instagram_account_id)
      .maybeSingle();
    if (conta?.profile_picture_url) {
      clienteFinal = {
        ...clienteFinal,
        foto_url: conta.profile_picture_url,
        instagram_username: conta.instagram_username,
      };
    }
  }

  const { data: contatos, error: erroContatos } = await supabase
    .from('cliente_contatos')
    .select('*')
    .eq('cliente_id', id)
    .order('criado_em', { ascending: true });
  if (erroContatos) return traduzirErroBanco(erroContatos, 'GET /api/clientes/[id] contatos');

  return NextResponse.json({ cliente: clienteFinal, contatos: contatos ?? [] });
}

// PATCH: edição parcial. Arquivar/restaurar é só `{ ativo: false | true }`.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  const parsed = parseClienteInput(body, 'editar');
  if (!parsed.ok) return respostaErro(parsed.error, 400);

  const contaId = parsed.data.instagram_account_id;
  if (typeof contaId === 'string' && !(await validarContaInstagram(user.id, contaId))) {
    return respostaErro('Conta de Instagram não encontrada.', 400);
  }

  const updateData = { ...parsed.data };
  if (!updateData.foto_url && contaId) {
    const { data: conta } = await supabase
      .from('instagram_accounts')
      .select('profile_picture_url')
      .eq('id', contaId)
      .maybeSingle();
    if (conta?.profile_picture_url) {
      updateData.foto_url = conta.profile_picture_url;
    }
  }

  const { data, error } = await supabase
    .from('clientes')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return traduzirErroBanco(error, 'PATCH /api/clientes/[id]');
  // Sem linha: não existe ou é de outra agência (a RLS esconde as duas coisas).
  if (!data) return respostaErro('Cliente não encontrado.', 404);
  return NextResponse.json({ cliente: data });
}
