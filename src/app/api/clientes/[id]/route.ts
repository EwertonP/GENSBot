import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { ehUuid, parseClienteInput, type Cliente } from '@/lib/clientes';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  escopoClientes,
  getContextoAgencia,
  ocultarCamposFinanceiros,
  podeAcessarCliente,
  respostaErro,
  traduzirErroBanco,
  validarContaInstagram,
} from '@/lib/clientes-server';

// Única parte da ficha que um membro com escopo pode salvar: o próprio grupo de WhatsApp.
const CHAVES_WHATSAPP_MEMBRO = ['whatsapp_grupo_id', 'whatsapp_notificar_agendamento'];

type Params = { params: Promise<{ id: string }> };

// GET: um cliente com seus contatos.
export async function GET(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  const escopo = await escopoClientes(auth.ctx);
  if (!podeAcessarCliente(escopo, id)) {
    return respostaErro('Cliente não encontrado.', 404);
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

  return NextResponse.json({ cliente: ocultarCamposFinanceiros(clienteFinal, escopo), contatos: contatos ?? [] });
}

// PATCH: edição parcial. Arquivar/restaurar é só `{ ativo: false | true }`.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, user, membro } = auth.ctx;

  const { id } = await params;
  if (!ehUuid(id)) return respostaErro('Cliente não encontrado.', 404);

  const escopo = await escopoClientes(auth.ctx);
  if (!podeAcessarCliente(escopo, id)) {
    return respostaErro('Cliente não encontrado.', 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respostaErro('Corpo da requisição inválido.', 400);
  }

  // Membro com escopo não edita a ficha (dados, arquivar, link público): só o próprio grupo de WhatsApp.
  const chavesBody = body && typeof body === 'object' ? Object.keys(body) : [];
  const soWhatsapp = chavesBody.length > 0 && chavesBody.every((k) => CHAVES_WHATSAPP_MEMBRO.includes(k));
  if (!escopo.total && !soWhatsapp) {
    return respostaErro('Só administradores podem editar a ficha do cliente.', 403);
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

  let data: Cliente | null = null;
  let error: PostgrestError | null = null;
  if (!escopo.total) {
    // Só o grupo de WhatsApp do próprio membro é salvo abaixo; a ficha fica como está.
    ({ data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle());
  } else {
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

    ({ data, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .maybeSingle());
  }

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
    cliente: ocultarCamposFinanceiros(
      {
        ...data,
        whatsapp_grupo_id: grupoSalvo,
        whatsapp_notificar_agendamento: notificarSalvo,
      },
      escopo
    ),
  });
}
