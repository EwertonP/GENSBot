import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
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
  const { supabase, membro } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  if (membro.papel === 'cliente' && membro.cliente_id !== id) {
    return respostaErro('Acesso não autorizado a este cliente.', 403);
  }

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
    const { data: conta } = await serviceSupabase
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

  // Busca o grupo do WhatsApp vinculado especificamente a este membro logado
  const { data: vinculoGrupo } = await serviceSupabase
    .from('cliente_membro_whatsapp_grupos')
    .select('whatsapp_grupo_id, notificar_agendamento')
    .eq('cliente_id', id)
    .eq('membro_id', membro.id)
    .maybeSingle();

  if (vinculoGrupo) {
    clienteFinal = {
      ...clienteFinal,
      whatsapp_grupo_id: vinculoGrupo.whatsapp_grupo_id,
      whatsapp_notificar_agendamento: vinculoGrupo.notificar_agendamento,
    };
  } else {
    // Se este membro ainda não configurou o grupo para este cliente, não herda o grupo de outro membro
    clienteFinal = {
      ...clienteFinal,
      whatsapp_grupo_id: null,
    };
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
  const { supabase, user, membro } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  // Ação de revogação/renovação de link público do feed
  if (body && typeof body === 'object' && (body as any).renovar_token_mes) {
    const { data: ren, error: errRen } = await supabase
      .from('clientes')
      .update({ token_aprovacao_mes: crypto.randomUUID() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (errRen) return traduzirErroBanco(errRen, 'PATCH renovar_token_mes');
    return NextResponse.json(ren);
  }

  const parsed = parseClienteInput(body, 'editar');
  if (!parsed.ok) return respostaErro(parsed.error, 400);

  const contaId = parsed.data.instagram_account_id;
  if (typeof contaId === 'string' && !(await validarContaInstagram(user.id, contaId))) {
    return respostaErro('Conta de Instagram não encontrada.', 400);
  }

  const updateData = { ...parsed.data };
  if (!updateData.foto_url && contaId) {
    const { data: conta } = await serviceSupabase
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

  // Se veio atualização de whatsapp_grupo_id ou whatsapp_notificar_agendamento, salva para este membro específico
  let grupoSalvo = data.whatsapp_grupo_id;
  let notificarSalvo = data.whatsapp_notificar_agendamento;

  if (body && typeof body === 'object') {
    const bodyObj = body as Record<string, any>;
    if ('whatsapp_grupo_id' in bodyObj || 'whatsapp_notificar_agendamento' in bodyObj) {
      const gId = bodyObj.whatsapp_grupo_id ? String(bodyObj.whatsapp_grupo_id).trim() : null;
      const notif = bodyObj.whatsapp_notificar_agendamento ?? true;
      if (gId) {
        await serviceSupabase
          .from('cliente_membro_whatsapp_grupos')
          .upsert({
            cliente_id: id,
            membro_id: membro.id,
            whatsapp_grupo_id: gId,
            notificar_agendamento: notif,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: 'cliente_id,membro_id' });
        grupoSalvo = gId;
        notificarSalvo = notif;
      } else {
        await serviceSupabase
          .from('cliente_membro_whatsapp_grupos')
          .delete()
          .eq('cliente_id', id)
          .eq('membro_id', membro.id);
        grupoSalvo = null;
        notificarSalvo = notif;
      }
    }
  }

  return NextResponse.json({
    cliente: {
      ...data,
      whatsapp_grupo_id: grupoSalvo,
      whatsapp_notificar_agendamento: notificarSalvo,
    },
  });
}
