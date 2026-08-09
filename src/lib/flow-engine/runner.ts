import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase';
import type { Automation } from '@/types/automation';
import type { FlowDefinition, FlowNode, SendMessageNodeConfig, ActionNodeConfig, ConditionNodeConfig, DelayNodeConfig } from '@/types/flow';
import { evaluateTriggerNode, evaluateConditionNode, applyActionNode, matchesKeywords, type ContactSnapshot } from './evaluator';

export interface FlowRunContext {
  ownerUserId: string;
  instagramUserId: string;
  contactId: string;
  text: string;
  triggerType: 'dm' | 'story' | 'story_mention' | 'comment';
  mediaId?: string | null;
  storyId?: string | null;
  /** Onde enviar mensagens: comentário responde por comment_id, DM/story por id do contato. */
  recipientRef: { comment_id: string } | { id: string };
  /** Injetado pelo caller (route.ts) — evita duplicar a chamada à Graph API pra buscar perfil. */
  resolveProfile: (id: string) => Promise<{ username: string | null; name: string | null }>;
}

interface RunResult {
  matched: boolean;
}

type ContactRow = ContactSnapshot & { instagram_id: string; flow_run_id?: string | null; flow_node_id?: string | null };

function findNode(flow: FlowDefinition, id: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}

function outgoingEdges(flow: FlowDefinition, nodeId: string, handle?: string) {
  return flow.edges.filter((e) => e.source === nodeId && (handle === undefined || (e.sourceHandle ?? null) === handle));
}

async function loadContact(contactId: string): Promise<ContactRow | null> {
  const { data } = await supabase.from('contacts').select('*').eq('instagram_id', contactId).single();
  return (data as ContactRow) || null;
}

async function persistContact(ctx: FlowRunContext, mutation: Record<string, unknown>) {
  if (Object.keys(mutation).length === 0) return;
  const { error } = await supabase
    .from('contacts')
    .update({ ...mutation, updated_at: new Date().toISOString() })
    .eq('instagram_id', ctx.contactId);
  if (error) console.error('[flow-engine] Erro ao atualizar contato:', error);
}

async function enqueueSendMessage(automation: Automation, ctx: FlowRunContext, node: FlowNode) {
  const data = node.data as SendMessageNodeConfig;
  const recipientId = 'comment_id' in ctx.recipientRef ? ctx.recipientRef.comment_id : ctx.contactId;

  let messagePayload: any = {
    recipient: ctx.recipientRef,
    message: {
      text: data.text,
      quick_replies: data.quick_reply_button
        ? [{ content_type: 'text', title: data.quick_reply_button.substring(0, 20), payload: `automation_id:${automation.id}` }]
        : undefined,
    },
  };

  if (data.link_url) {
    messagePayload = {
      recipient: ctx.recipientRef,
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: (data.text || 'Acesse o link abaixo:').trim(),
            buttons: [{ type: 'web_url', url: data.link_url, title: (data.link_button_label || 'Acessar Link').substring(0, 20) }],
          },
        },
      },
    };
  }

  const { error } = await supabase.from('queue').insert({
    user_id: ctx.ownerUserId,
    instagram_user_id: ctx.instagramUserId,
    contact_id: ctx.contactId,
    automation_id: automation.id,
    type: 'flow_send',
    recipient_id: recipientId,
    payload: messagePayload,
    status: 'pending',
    scheduled_at: new Date().toISOString(),
  });
  if (error) console.error('[flow-engine] Erro ao enfileirar sendMessage:', error);

  if (data.sequence_id) {
    await enqueueSequenceSteps(automation, ctx, data.sequence_id);
  }
}

/** Agenda os passos de uma sequência reutilizável (Fase 4) — mesma lógica de delay cumulativo de enqueueFollowups (route.ts), lendo de `sequences.steps` em vez do jsonb embutido na automação. */
async function enqueueSequenceSteps(automation: Automation, ctx: FlowRunContext, sequenceId: string) {
  const { data: sequence, error: seqError } = await supabase.from('sequences').select('steps').eq('id', sequenceId).single();
  if (seqError || !sequence?.steps?.length) return;

  let cumulativeDelay = 0;
  for (const step of sequence.steps as { delay_minutes?: number; text?: string; link_url?: string | null; link_button_label?: string | null }[]) {
    cumulativeDelay += step.delay_minutes || 1;
    const scheduledAt = new Date();
    scheduledAt.setMinutes(scheduledAt.getMinutes() + cumulativeDelay);

    let payload: any = { recipient: ctx.recipientRef, message: { text: (step.text || '').trim() } };
    if (step.link_url) {
      payload = {
        recipient: ctx.recipientRef,
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: (step.text || '').trim() || 'Acesse o link abaixo:',
              buttons: [{ type: 'web_url', url: step.link_url, title: (step.link_button_label || 'Acessar Link').substring(0, 20) }],
            },
          },
        },
      };
    }

    const { error } = await supabase.from('queue').insert({
      user_id: ctx.ownerUserId,
      instagram_user_id: ctx.instagramUserId,
      contact_id: ctx.contactId,
      automation_id: automation.id,
      type: 'flow_send',
      recipient_id: ctx.contactId,
      payload,
      status: 'pending',
      scheduled_at: scheduledAt.toISOString(),
    });
    if (error) console.error('[flow-engine] Erro ao enfileirar passo de sequência:', error);
  }
}

async function scheduleDelay(automation: Automation, ctx: FlowRunContext, node: FlowNode, flowRunId: string) {
  const delayMinutes = (node.data as DelayNodeConfig).delayMinutes ?? 0;
  await persistContact(ctx, { flow_node_id: node.id, flow_run_id: flowRunId });

  const scheduledAt = new Date();
  scheduledAt.setMinutes(scheduledAt.getMinutes() + Math.max(0, delayMinutes));

  const { error } = await supabase.from('queue').insert({
    user_id: ctx.ownerUserId,
    instagram_user_id: ctx.instagramUserId,
    contact_id: ctx.contactId,
    automation_id: automation.id,
    type: 'flow_resume',
    recipient_id: ctx.contactId,
    payload: { node_id: node.id },
    status: 'pending',
    scheduled_at: scheduledAt.toISOString(),
  });
  if (error) console.error('[flow-engine] Erro ao agendar retomada de delay:', error);
}

/** Caminha o grafo a partir de `startNodeId`, executando o efeito de cada nó, até parar num `delay` (agenda retomada) ou num nó terminal. */
async function walk(automation: Automation, flow: FlowDefinition, ctx: FlowRunContext, startNodeId: string, flowRunId: string) {
  let currentId: string | undefined = startNodeId;
  let contact = await loadContact(ctx.contactId);
  let guard = 0;

  while (currentId && guard < 50) {
    guard += 1;
    const node = findNode(flow, currentId);
    if (!node) break;

    if (node.type === 'sendMessage') {
      await enqueueSendMessage(automation, ctx, node);
      currentId = outgoingEdges(flow, node.id)[0]?.target;
      continue;
    }

    if (node.type === 'condition') {
      const branch = evaluateConditionNode(node.data as ConditionNodeConfig, { text: ctx.text, contact });
      currentId = outgoingEdges(flow, node.id, branch)[0]?.target;
      continue;
    }

    if (node.type === 'action') {
      const mutation = applyActionNode(node.data as ActionNodeConfig, contact);
      await persistContact(ctx, mutation);
      contact = { ...(contact as ContactRow), ...mutation } as ContactRow;
      currentId = outgoingEdges(flow, node.id)[0]?.target;
      continue;
    }

    if (node.type === 'delay') {
      await scheduleDelay(automation, ctx, node, flowRunId);
      return; // pausa aqui — a execução retoma via job `flow_resume` (ver src/lib/drain.ts)
    }

    // nó `trigger` no meio do grafo (não deveria acontecer) — apenas segue em frente
    currentId = outgoingEdges(flow, node.id)[0]?.target;
  }

  // Nó terminal (sem edges de saída) ou guard estourou (grafo com ciclo) — encerra a execução em andamento.
  await persistContact(ctx, { flow_node_id: null, flow_run_id: null });
}

/** Ponto de entrada quando uma mensagem/comentário chega e ainda não há execução em andamento pra essa automação. */
export async function runFlow(automation: Automation, ctx: FlowRunContext): Promise<RunResult> {
  const flow = automation.flow_definition;
  if (!flow) return { matched: false };

  const triggerNode = flow.nodes.find((n) => n.type === 'trigger');
  if (!triggerNode) return { matched: false };

  const matched = evaluateTriggerNode(triggerNode.data as import('@/types/flow').TriggerNodeConfig, {
    triggerType: ctx.triggerType,
    text: ctx.text,
    mediaId: ctx.mediaId,
    storyId: ctx.storyId,
  });
  if (!matched) return { matched: false };

  // Mesma lógica de "só busca perfil se ainda não tem nome" do caminho legado (route.ts).
  const existing = await loadContact(ctx.contactId);
  let profileName = existing?.name || null;
  let profileUsername = existing?.username || null;
  if (!profileName) {
    const profile = await ctx.resolveProfile(ctx.contactId);
    profileName = profile.name;
    if (profile.username) profileUsername = profile.username;
  }
  await persistContact(ctx, {
    name: profileName,
    username: profileUsername || ctx.contactId,
    last_automation_id: automation.id,
    last_active_automation_id: automation.id,
  });

  const next = outgoingEdges(flow, triggerNode.id)[0];
  if (!next) return { matched: true };

  await walk(automation, flow, ctx, next.target, randomUUID());
  return { matched: true };
}

/** Ponto de entrada quando um job `flow_resume` da fila (ver src/lib/drain.ts) retoma uma execução pausada num nó `delay`. */
export async function resumeFlow(automation: Automation, ctx: FlowRunContext, pausedNodeId: string): Promise<void> {
  const flow = automation.flow_definition;
  if (!flow) return;

  const contact = await loadContact(ctx.contactId);
  const flowRunId = contact?.flow_run_id || randomUUID();
  const next = outgoingEdges(flow, pausedNodeId)[0];

  if (!next) {
    await persistContact(ctx, { flow_node_id: null, flow_run_id: null });
    return;
  }

  await walk(automation, flow, ctx, next.target, flowRunId);
}

// Reexport pra quem só precisa da função de match, sem puxar o resto do motor.
export { matchesKeywords };
