/**
 * Envio de notificações push (Web Push / VAPID) para os aparelhos inscritos.
 *
 * Variáveis de ambiente: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e
 * VAPID_SUBJECT (mailto: ou https:). Sem elas, o envio não faz nada e não falha.
 * Gerar o par de chaves: `npx web-push generate-vapid-keys`.
 */
import webpush from 'web-push';
import { supabase } from './supabase';

export type PrioridadePush = 'urgente' | 'normal' | 'baixa';

/** Botão da notificação (Android e computador; o iOS ignora). */
export interface AcaoPush {
  /** Identificador devolvido ao service worker ao tocar. */
  id: string;
  rotulo: string;
  /** Tela aberta ao tocar. */
  url?: string;
  /** Token assinado de uma ação feita sem abrir o app (ver /api/notificacoes/acao). */
  token?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Caminho aberto ao tocar (ex.: "/?tab=esteira"). Padrão: "/". */
  url?: string;
  /** Mesma tag substitui a notificação anterior em vez de empilhar. */
  tag?: string;
  /** Imagem de prévia (https). Aparece no Android e no computador. */
  imagem?: string | null;
  /** Até 2 botões. */
  acoes?: AcaoPush[];
  /** Urgente fica na tela até a pessoa agir; baixa chega sem som. Padrão: normal. */
  prioridade?: PrioridadePush;
  /** Quantas notificações não lidas a pessoa tem (número no ícone do app). */
  naoLidas?: number;
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

const MAX_ACOES = 2;

/** Só imagens https de tamanho razoável vão no push (limite do payload é ~4 KB). */
export function imagemValida(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 500) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Urgência e validade do push conforme a prioridade. */
export function opcoesDaPrioridade(p: PrioridadePush | undefined): { TTL: number; urgency: 'very-low' | 'low' | 'normal' | 'high' } {
  if (p === 'urgente') return { TTL: 60 * 60 * 24, urgency: 'high' };
  if (p === 'baixa') return { TTL: 60 * 60 * 3, urgency: 'low' };
  return { TTL: 60 * 60 * 12, urgency: 'normal' };
}

/** Monta o JSON enviado ao aparelho (o service worker lê estes campos). */
export function montarCorpoPush(payload: PushPayload): string {
  const acoes = (payload.acoes || [])
    .filter((a) => a && a.id && a.rotulo && (a.url || a.token))
    .slice(0, MAX_ACOES)
    .map((a) => ({ id: a.id.slice(0, 40), rotulo: a.rotulo.slice(0, 24), url: a.url, token: a.token }));
  return JSON.stringify({
    title: payload.title.slice(0, 80),
    body: payload.body.slice(0, 240),
    url: payload.url || '/',
    tag: payload.tag,
    image: imagemValida(payload.imagem) ? payload.imagem : undefined,
    acoes: acoes.length ? acoes : undefined,
    prioridade: payload.prioridade || 'normal',
    naoLidas: typeof payload.naoLidas === 'number' && payload.naoLidas >= 0 ? Math.min(payload.naoLidas, 999) : undefined,
  });
}

export async function enviarPush(userId: string, payload: PushPayload): Promise<ResultadoPush> {
  const r: ResultadoPush = { enviados: 0, removidas: 0, falhas: 0 };
  if (!pushConfigurado()) return r;

  const { data: inscricoes, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
  if (error || !inscricoes?.length) return r;

  iniciar();
  const corpo = montarCorpoPush(payload);
  const opcoes = opcoesDaPrioridade(payload.prioridade);

  await Promise.all(
    (inscricoes as Inscricao[]).map(async (i) => {
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, opcoes);
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
