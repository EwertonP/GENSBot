/**
 * Cliente mínimo da API v2 do Cal.com (nuvem). Só o que a integração precisa:
 * conferir a chave e cadastrar/apagar o webhook. Formato verificado na nuvem em 18/11/2026
 * (cabeçalho `cal-api-version: 2024-06-14`; corpo `{subscriberUrl, triggers, active, secret}`).
 */

export const VERSAO_API_CALCOM = '2024-06-14';
export const API_BASE_CALCOM = 'https://api.cal.com';
export const TRIGGERS_AGENDA = ['BOOKING_CREATED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'BOOKING_REQUESTED', 'BOOKING_REJECTED'];

/**
 * O endereço da API vem do banco, digitado por um gestor. Só aceita https com nome de
 * domínio (nada de IP, localhost ou rede interna), para a integração não virar um
 * jeito de o servidor chamar serviços internos.
 */
export function apiBaseValida(valor: string | null | undefined): string | null {
  try {
    const u = new URL(String(valor ?? '').trim());
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || !host.includes('.')) return null;
    if (/^\d+(\.\d+){3}$/.test(host) || host.includes(':') || host === 'localhost' || /\.(local|internal|localhost)$/.test(host)) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

async function chamar(apiBase: string, apiKey: string, caminho: string, init: RequestInit = {}) {
  return fetch(`${apiBase}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': VERSAO_API_CALCOM,
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
}

export type ResultadoCalcom<T> = ({ ok: true } & T) | { ok: false; erro: string };

/** Confere a chave antes de guardá-la: um erro de digitação falha na hora, não depois. */
export async function validarChaveCalcom(apiBase: string, apiKey: string): Promise<ResultadoCalcom<{ username: string | null }>> {
  try {
    const res = await chamar(apiBase, apiKey, '/v2/me');
    if (res.status === 401 || res.status === 403) return { ok: false, erro: 'A chave do Cal.com foi recusada. Confira se copiou inteira e se não expirou.' };
    if (!res.ok) return { ok: false, erro: `O Cal.com respondeu ${res.status} ao conferir a chave.` };
    const corpo = (await res.json()) as { data?: { username?: string } };
    return { ok: true, username: corpo.data?.username ?? null };
  } catch (err) {
    return { ok: false, erro: `Não consegui falar com o Cal.com: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function criarWebhookCalcom(
  apiBase: string,
  apiKey: string,
  { subscriberUrl, secret }: { subscriberUrl: string; secret: string }
): Promise<ResultadoCalcom<{ id: string }>> {
  try {
    const res = await chamar(apiBase, apiKey, '/v2/webhooks', {
      method: 'POST',
      body: JSON.stringify({ subscriberUrl, triggers: TRIGGERS_AGENDA, active: true, secret }),
    });
    if (!res.ok) return { ok: false, erro: `O Cal.com recusou o cadastro do webhook (${res.status}).` };
    const corpo = (await res.json()) as { data?: { id?: string } };
    return corpo.data?.id ? { ok: true, id: corpo.data.id } : { ok: false, erro: 'O Cal.com não devolveu o id do webhook.' };
  } catch (err) {
    return { ok: false, erro: `Não consegui falar com o Cal.com: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Apaga o webhook. Já não existir (404) conta como apagado. */
export async function apagarWebhookCalcom(apiBase: string, apiKey: string, id: string): Promise<boolean> {
  try {
    const res = await chamar(apiBase, apiKey, `/v2/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
