import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { listInstagramAccountsForUser } from '@/lib/instagram-account';
import { respostasDe } from '@/lib/contact-format';
import { validateEmail, normalizePhone } from '@/lib/flow-engine/evaluator';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A ficha é identificada pelo `id` (uuid) do contato: desde que a ficha passou a ser
 * por conta do Instagram, a mesma pessoa (instagram_id) pode ter uma linha em cada
 * conta, então o IGSID sozinho não identifica mais uma ficha. O acesso vale se a
 * conta da ficha é uma das contas que o usuário (ou a agência dele) enxerga.
 */
async function loadOwnedContact(userId: string, id: string, columns = '*') {
  if (!UUID_RE.test(id)) return null;
  const { data: contact } = await supabase.from('contacts').select(columns).eq('id', id).maybeSingle();
  if (!contact) return null;
  const accounts = await listInstagramAccountsForUser(userId);
  const accountIds = new Set(accounts.map((a) => a.instagram_user_id));
  const row = contact as unknown as { instagram_user_id: string };
  return accountIds.has(row.instagram_user_id) ? (contact as unknown as Record<string, unknown>) : null;
}

// GET: Ficha completa do lead — dados, respostas, jornada pelas automações e últimas mensagens.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const contact = await loadOwnedContact(user.id, id);
    if (!contact) return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });

    const igUserId = contact.instagram_user_id as string;
    const igsid = contact.instagram_id as string;

    const [{ data: eventos }, { data: mensagens }, { data: conta }] = await Promise.all([
      supabase
        .from('analytics_events')
        .select('event_type, automation_id, created_at')
        .eq('instagram_user_id', igUserId)
        .eq('contact_id', igsid)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('messages')
        .select('id, direction, text, created_at')
        .eq('instagram_user_id', igUserId)
        .eq('contact_id', igsid)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('instagram_accounts').select('instagram_username').eq('instagram_user_id', igUserId).limit(1).maybeSingle(),
    ]);

    const automationIds = Array.from(
      new Set([contact.last_automation_id as string | null, ...(eventos || []).map((e) => e.automation_id)].filter(Boolean) as string[]),
    );
    const { data: automacoes } = automationIds.length
      ? await supabase.from('automations').select('id, name').in('id', automationIds)
      : { data: [] as { id: string; name: string }[] };
    const nomeAutomacao = new Map((automacoes || []).map((a) => [a.id, a.name as string]));

    return NextResponse.json({
      contact: {
        ...contact,
        flow_state: undefined,
        origem: contact.last_automation_id ? { id: contact.last_automation_id, name: nomeAutomacao.get(contact.last_automation_id as string) || null } : null,
      },
      conta: conta?.instagram_username || null,
      respostas: respostasDe(contact.flow_state),
      jornada: (eventos || []).map((e) => ({
        event_type: e.event_type,
        created_at: e.created_at,
        automation_id: e.automation_id,
        automation_name: e.automation_id ? nomeAutomacao.get(e.automation_id) || null : null,
      })),
      mensagens: (mensagens || []).reverse(),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}

// PATCH: Atualiza campos editáveis de um contato — tags de segmentação, dados do lead
// (nome, e-mail, telefone, observações) e respostas guardadas em `flow_state`
// (`respostas: { cargo: "Oficial", cidade: null }` — null apaga a resposta). Todos os
// campos são opcionais no corpo da requisição; só os presentes são atualizados.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};

    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || !body.tags.every((t: unknown) => typeof t === 'string')) {
        return NextResponse.json({ error: 'tags deve ser uma lista de strings.' }, { status: 400 });
      }
      update.tags = Array.from(new Set(body.tags.map((t: string) => t.trim()).filter(Boolean))).slice(0, 10);
    }

    for (const field of ['name', 'email', 'phone', 'notes'] as const) {
      if (body[field] === undefined) continue;
      if (body[field] !== null && typeof body[field] !== 'string') {
        return NextResponse.json({ error: `${field} deve ser uma string ou null.` }, { status: 400 });
      }
      update[field] = typeof body[field] === 'string' ? body[field].trim() || null : null;
    }

    // Mesmas regras do bloco "Capturar Lead": e-mail minúsculo, telefone em +55DDNNNNNNNNN.
    if (typeof update.email === 'string') {
      const email = validateEmail(update.email);
      if (!email) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
      update.email = email;
    }
    if (typeof update.phone === 'string') {
      const phone = normalizePhone(update.phone);
      if (!phone) return NextResponse.json({ error: 'Telefone inválido. Use DDD + número.' }, { status: 400 });
      update.phone = phone;
    }

    const contact = await loadOwnedContact(user.id, id, 'id, instagram_user_id, flow_state');
    if (!contact) return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });

    if (body.respostas !== undefined) {
      if (!body.respostas || typeof body.respostas !== 'object' || Array.isArray(body.respostas)) {
        return NextResponse.json({ error: 'respostas deve ser um objeto { campo: valor }.' }, { status: 400 });
      }
      const flowState = { ...((contact.flow_state as Record<string, unknown>) || {}) };
      for (const [key, value] of Object.entries(body.respostas as Record<string, unknown>)) {
        const campo = key.trim().slice(0, 40);
        if (!campo || campo.startsWith('_')) continue; // estado interno do motor não é editável
        if (value === null || (typeof value === 'string' && !value.trim())) delete flowState[campo];
        else if (typeof value === 'string') flowState[campo] = value.trim().slice(0, 500);
      }
      update.flow_state = flowState;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar foi enviado.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ...data, respostas: respostasDe(data.flow_state), flow_state: undefined });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}

// DELETE: Remove um contato da audiência (ex: contato irrelevante que o usuário não quer na lista/exportação).
// Leva junto o histórico dele naquela conta (FKs com on delete cascade).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const contact = await loadOwnedContact(user.id, id, 'id, instagram_user_id');
    if (!contact) return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 });

    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}
