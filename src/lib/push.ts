/**
 * Envio de notificações push (Web Push / VAPID) para os aparelhos inscritos.
 *
 * Variáveis de ambiente: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e
 * VAPID_SUBJECT (mailto: ou https:). Sem elas, o envio não faz nada e não falha.
 * Gerar o par de chaves: `npx web-push generate-vapid-keys`.
 */
import webpush from 'web-push';
import { supabase } from './supabase';

export interface PushPayload {
  title: string;
  body: string;
  /** Caminho aberto ao tocar (ex.: "/?tab=esteira"). Padrão: "/". */
  url?: string;
  /** Mesma tag substitui a notificação anterior em vez de empilhar. */
  tag?: string;
}

export interface ResultadoPush {
  enviados: number;
  removidas: number;
  falhas: number;
}

export function pushConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

/**
 * O servidor faz uma requisição para o endpoint de cada inscrição. Para uma
 * pessoa logada não conseguir apontar essa requisição para um endereço interno
 * (SSRF), só aceitamos os serviços de push dos navegadores.
 */
const HOSTS_PUSH = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function endpointValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && HOSTS_PUSH.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

let iniciado = false;
function iniciar() {
  if (iniciado) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  iniciado = true;
}

interface Inscricao {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function enviarPush(userId: string, payload: PushPayload): Promise<ResultadoPush> {
  const r: ResultadoPush = { enviados: 0, removidas: 0, falhas: 0 };
  if (!pushConfigurado()) return r;

  const { data: inscricoes, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
  if (error || !inscricoes?.length) return r;

  iniciar();
  const corpo = JSON.stringify({ title: payload.title.slice(0, 80), body: payload.body.slice(0, 240), url: payload.url || '/', tag: payload.tag });

  await Promise.all(
    (inscricoes as Inscricao[]).map(async (i) => {
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, { TTL: 60 * 60 * 12, urgency: 'normal' });
        r.enviados++;
        await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('endpoint', i.endpoint);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // O aparelho cancelou ou a inscrição expirou: limpa.
          await supabase.from('push_subscriptions').delete().eq('endpoint', i.endpoint);
          r.removidas++;
        } else {
          r.falhas++;
          console.error('Falha ao enviar push:', status, (err as Error).message);
        }
      }
    })
  );
  return r;
}
