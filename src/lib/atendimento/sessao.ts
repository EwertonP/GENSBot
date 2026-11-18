/**
 * Sessão de WhatsApp no OpenWA PRÓPRIO do cliente: criar, ligar, pegar o QR e ver se conectou.
 * Recebe sempre a configuração do cliente (nunca a do ambiente): quem chama garante isso.
 */
import { acharSessaoOpenWA, type ConfigOpenWA, type OpenWASessionInfo } from '@/lib/openwa-client';

const CONECTADO = new Set(['READY', 'WORKING', 'CONNECTED', 'OPEN']);
// Estados em que já há QR (ou a sessão já está subindo): não precisa mandar "start" de novo.
const PRONTA_PARA_QR = new Set(['READY', 'QR_READY']);

export const estaConectada = (status?: string | null) => CONECTADO.has(String(status ?? '').toUpperCase());

export type EstadoSessao = { ok: true; existe: boolean; conectada: boolean; qr: string | null } | { ok: false; erro: string };

const chamar = (config: ConfigOpenWA, caminho: string, init: RequestInit = {}) =>
  fetch(`${config.url}${caminho}`, { ...init, headers: config.headers, signal: AbortSignal.timeout(8000) });

async function procurar(config: ConfigOpenWA, sessionName: string): Promise<{ ok: true; sessao: OpenWASessionInfo | null } | { ok: false; erro: string }> {
  const res = await chamar(config, '/api/sessions');
  if (!res.ok) return { ok: false, erro: `O OpenWA respondeu ${res.status} ao listar as sessões.` };
  const lista = await res.json();
  return { ok: true, sessao: Array.isArray(lista) ? acharSessaoOpenWA<OpenWASessionInfo>(lista, sessionName) : null };
}

async function lerQr(config: ConfigOpenWA, uuid: string): Promise<string | null> {
  const res = await chamar(config, `/api/sessions/${encodeURIComponent(uuid)}/qr`);
  if (!res.ok) return null;
  const d = (await res.json()) as { qrCode?: string; qr?: string; dataUrl?: string };
  return d.qrCode || d.qr || d.dataUrl || null;
}

/** Só olha: não cria nem liga nada. */
export async function consultarSessao({ config, sessionName }: { config: ConfigOpenWA; sessionName: string }): Promise<EstadoSessao> {
  try {
    const r = await procurar(config, sessionName);
    if (!r.ok) return r;
    if (!r.sessao?.id) return { ok: true, existe: false, conectada: false, qr: null };
    if (estaConectada(r.sessao.status)) return { ok: true, existe: true, conectada: true, qr: null };
    return { ok: true, existe: true, conectada: false, qr: await lerQr(config, r.sessao.id) };
  } catch (err) {
    return { ok: false, erro: `Não consegui falar com o OpenWA: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Cria a sessão se não existir, liga e espera um pouco pelo QR (a tela volta a perguntar se ainda não veio). */
export async function iniciarSessao({
  config,
  sessionName,
  esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  tentativasQr = 4,
}: {
  config: ConfigOpenWA;
  sessionName: string;
  esperar?: (ms: number) => Promise<void>;
  tentativasQr?: number;
}): Promise<EstadoSessao> {
  try {
    const r = await procurar(config, sessionName);
    if (!r.ok) return r;
    let uuid = r.sessao?.id ?? null;
    const status = r.sessao?.status ?? null;

    if (!uuid) {
      const criar = await chamar(config, '/api/sessions', { method: 'POST', body: JSON.stringify({ name: sessionName }) });
      if (!criar.ok) return { ok: false, erro: `O OpenWA recusou criar a sessão (${criar.status}).` };
      uuid = ((await criar.json()) as { id?: string }).id ?? null;
      if (!uuid) return { ok: false, erro: 'O OpenWA não devolveu o id da sessão criada.' };
    }
    if (estaConectada(status)) return { ok: true, existe: true, conectada: true, qr: null };

    if (!PRONTA_PARA_QR.has(String(status ?? '').toUpperCase())) {
      await chamar(config, `/api/sessions/${encodeURIComponent(uuid)}/start`, { method: 'POST' }).catch(() => null);
    }
    for (let i = 0; i < tentativasQr; i++) {
      await esperar(1200);
      const qr = await lerQr(config, uuid).catch(() => null);
      if (qr) return { ok: true, existe: true, conectada: false, qr };
    }
    return { ok: true, existe: true, conectada: false, qr: null };
  } catch (err) {
    return { ok: false, erro: `Não consegui falar com o OpenWA: ${err instanceof Error ? err.message : String(err)}` };
  }
}
