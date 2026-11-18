/**
 * Cadastra no OpenWA o webhook que entrega as mensagens ao GENSBot.
 *
 * O OpenWA só manda o UUID da sessão, então o nome vai no `?session=` da URL.
 * O segredo vai num cabeçalho próprio (`x-openwa-secret`), que é o que
 * `validarWebhookOpenWA` confere. É idempotente: se a sessão já tem um webhook
 * para este endereço, atualiza em vez de criar outro.
 */
import { obterSessionUuidOpenWA, type ConfigOpenWA } from './openwa-client';

export const EVENTOS_WEBHOOK_WHATSAPP = ['message.received', 'message.sent'];

export type ResultadoWebhookOpenWA =
  | { ok: true; webhookId: string; acao: 'criado' | 'atualizado' }
  | { ok: false; erro: string };

const semQuery = (u: string) => u.split('?')[0];

export async function registrarWebhookOpenWA({
  sessionName,
  webhookUrl,
  segredo,
  config,
}: {
  sessionName: string;
  webhookUrl: string;
  segredo: string | undefined;
  config: ConfigOpenWA;
}): Promise<ResultadoWebhookOpenWA> {
  if (!config.url) return { ok: false, erro: 'OpenWA sem endereço configurado.' };
  if (!segredo) return { ok: false, erro: 'OPENWA_WEBHOOK_SECRET não configurado no servidor.' };

  const { sessionUuid } = await obterSessionUuidOpenWA(sessionName, config);
  if (!sessionUuid) return { ok: false, erro: `Sessão "${sessionName}" não encontrada no OpenWA. Crie e conecte a sessão primeiro.` };

  const base = `${config.url}/api/sessions/${encodeURIComponent(sessionUuid)}/webhooks`;
  try {
    const lista = await fetch(base, { headers: config.headers, signal: AbortSignal.timeout(8000) });
    if (!lista.ok) return { ok: false, erro: `OpenWA recusou a listagem de webhooks (${lista.status}).` };
    const existentes = (await lista.json()) as Array<{ id?: string; url?: string }>;
    const nosso = Array.isArray(existentes) ? existentes.find((w) => w.url && semQuery(w.url) === semQuery(webhookUrl)) : undefined;

    const corpo = JSON.stringify({
      url: webhookUrl,
      events: EVENTOS_WEBHOOK_WHATSAPP,
      headers: { 'x-openwa-secret': segredo },
      active: true,
    });

    const res = nosso?.id
      ? await fetch(`${base}/${encodeURIComponent(nosso.id)}`, { method: 'PUT', headers: config.headers, body: corpo, signal: AbortSignal.timeout(8000) })
      : await fetch(base, { method: 'POST', headers: config.headers, body: corpo, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, erro: `OpenWA recusou o cadastro do webhook (${res.status}).` };

    const salvo = (await res.json()) as { id?: string };
    const webhookId = salvo.id || nosso?.id;
    if (!webhookId) return { ok: false, erro: 'OpenWA não devolveu o id do webhook.' };
    return { ok: true, webhookId, acao: nosso?.id ? 'atualizado' : 'criado' };
  } catch (err) {
    return { ok: false, erro: `Falha ao falar com o OpenWA: ${err instanceof Error ? err.message : String(err)}` };
  }
}
