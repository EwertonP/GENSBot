import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getInstagramAccountByInstagramUserId } from '@/lib/instagram-account';
import { getBestPostingTimes } from '@/lib/best-posting-time';
import { supabase } from '@/lib/supabase';

const APPROVAL_STATUSES = ['rascunho', 'em_revisao', 'aprovado', 'agendado', 'publicado', 'rejeitado'] as const;
type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Próxima ocorrência futura de um dia da semana + hora — mesma lógica de
 * src/components/ui/calendar-picker.tsx (nextOccurrenceOf), duplicada aqui porque
 * aquele arquivo é client-only ('use client') e essa rota roda no servidor. */
function nextOccurrenceOf(weekday: number, hour: number): Date {
  const now = new Date();
  const result = new Date(now);
  const diff = (weekday - now.getDay() + 7) % 7;
  result.setDate(now.getDate() + diff);
  result.setHours(hour, 0, 0, 0);
  if (result.getTime() <= now.getTime()) result.setDate(result.getDate() + 7);
  return result;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const {
      approval_status,
      scheduled_at,
      caption,
      rejection_reason,
      media_type,
      media_url,
      media_urls,
      collaborators,
      user_tags,
      automation_config,
    } = body as {
      approval_status?: ApprovalStatus;
      scheduled_at?: string;
      caption?: string;
      rejection_reason?: string;
      media_type?: string;
      media_url?: string;
      media_urls?: string[];
      collaborators?: string[];
      user_tags?: { username: string }[];
      automation_config?: any;
    };

    const { data: post, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!post) return NextResponse.json({ error: 'Publicação não encontrada.' }, { status: 404 });

    const account = await getInstagramAccountByInstagramUserId(post.instagram_user_id);
    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: 'Publicação não encontrada.' }, { status: 404 });
    }

    if (approval_status && !APPROVAL_STATUSES.includes(approval_status)) {
      return NextResponse.json({ error: 'Status de aprovação inválido.' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (approval_status) update.approval_status = approval_status;
    if (caption !== undefined) update.caption = caption;
    if (rejection_reason !== undefined) update.error_message = rejection_reason;
    if (scheduled_at) update.scheduled_at = scheduled_at;
    if (media_type) update.media_type = media_type;
    if (media_url) update.media_url = media_url;
    if (media_urls !== undefined) update.media_urls = media_urls;
    if (collaborators !== undefined) update.collaborators = collaborators;
    if (user_tags !== undefined) update.user_tags = user_tags;
    if (automation_config !== undefined) update.automation_config = automation_config;

    // Mover pro Kanban pra "aprovado" sem uma data já definida dispara o agendamento
    // automático usando a sugestão de melhor horário (Onda 1, item 1.1 do plano) —
    // não fica esperando alguém voltar e agendar manualmente.
    if (approval_status === 'aprovado' && !scheduled_at && !post.scheduled_at) {
      const suggestionResult = await getBestPostingTimes(post.instagram_user_id, account.access_token);
      const best = !suggestionResult.insufficientData ? suggestionResult.suggestions[0] : null;
      const autoDate = best ? nextOccurrenceOf(best.weekday, best.hourStart) : (() => {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 1);
        fallback.setHours(12, 0, 0, 0);
        return fallback;
      })();
      update.scheduled_at = autoDate.toISOString();
      update.approval_status = 'agendado';
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Sincroniza com a esteira caso esse agendamento esteja atrelado a um conteudo_item
    try {
      const esteiraUpdate: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (caption !== undefined) esteiraUpdate.legenda = caption;
      if (scheduled_at) esteiraUpdate.data_programada = scheduled_at;
      if (automation_config !== undefined) esteiraUpdate.automacao_config = automation_config;

      await supabase
        .from('conteudo_items')
        .update(esteiraUpdate)
        .eq('scheduled_post_id', id);
    } catch (syncErr) {
      console.warn('Erro ao sincronizar com esteira:', syncErr);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Cancela (soft — status vira 'canceled', não apaga a linha) uma publicação ainda agendada.
// Comportamento original preservado (só cabia pra status==='scheduled'); a única mudança
// é também tirar o card do Kanban (approval_status: 'rejeitado') ao cancelar.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id } = await params;

    const { data: existing } = await supabase
      .from('scheduled_posts')
      .select('id, user_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Publicação não encontrada.' }, { status: 404 });
    }
    if (existing.status !== 'scheduled') {
      return NextResponse.json({ error: 'Só é possível cancelar publicações ainda agendadas.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update({ status: 'canceled', approval_status: 'rejeitado' })
      .eq('id', id);

    if (error) throw error;

    // Se havia uma demanda vinculada na esteira, reseta o vínculo mantendo-a pronta para agendamento
    await supabase
      .from('conteudo_items')
      .update({
        scheduled_post_id: null,
        data_programada: null,
        status: 'agendamento',
        atualizado_em: new Date().toISOString(),
      })
      .eq('scheduled_post_id', id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
