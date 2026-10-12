/**
 * Cliente centralizado para comunicação com o Gateway OpenWA / WhatsApp HTTP API.
 * Suporta envio de mensagens individuais e para grupos (@g.us), além de sincronização de status de sessões.
 */

export interface OpenWASessionInfo {
  id?: string;
  name?: string;
  status?: string;
  phone?: string | null;
  me?: {
    id?: string;
    pushName?: string;
  };
}

export function getOpenWAConfig() {
  let url = process.env.OPENWA_API_URL?.trim().replace(/\/$/, '') || null;
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  const key = process.env.OPENWA_API_KEY || process.env.API_MASTER_KEY || null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers['X-API-Key'] = key;
    headers['Authorization'] = `Bearer ${key}`;
  }

  return { url, key, headers };
}

/**
 * Consulta as sessões ativas no OpenWA
 */
export async function listarSessoesOpenWA(): Promise<OpenWASessionInfo[]> {
  const { url, headers } = getOpenWAConfig();
  if (!url) return [];

  try {
    const res = await fetch(`${url}/api/sessions`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[OpenWA] Erro ao listar sessões:', err);
    return [];
  }
}

/**
 * Envia mensagem de texto para número pessoal ou Grupo (@g.us) via OpenWA
 */
export async function enviarMensagemOpenWA({
  sessionName,
  para,
  texto,
}: {
  sessionName: string;
  para: string;
  texto: string;
}): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
  const { url, headers } = getOpenWAConfig();
  if (!url) {
    return { ok: false, erro: 'OPENWA_API_URL não configurada no ambiente.' };
  }

  // Normaliza o destinatário (grupo @g.us ou contato individual @s.whatsapp.net / @c.us)
  let dest = para.trim();
  if (!dest.includes('@')) {
    const digitos = dest.replace(/\D/g, '');
    dest = `${digitos}@c.us`;
  }

  // Tentativa 1: Endpoint oficial /api/messages/send-text
  try {
    const res = await fetch(`${url}/api/messages/send-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: sessionName,
        to: dest,
        chatId: dest,
        text: texto,
        content: texto,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, messageId: data.id || data.messageId || `msg-${Date.now()}` };
    }

    // Se o endpoint retornou erro 404, tenta endpoint alternativo do WAHA/OpenWA
    if (res.status === 404) {
      const resAlt = await fetch(`${url}/api/sendText`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session: sessionName,
          chatId: dest,
          text: texto,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (resAlt.ok) {
        const altData = await resAlt.json().catch(() => ({}));
        return { ok: true, messageId: altData.id || `msg-${Date.now()}` };
      }
    }

    const erroTxt = await res.text();
    console.warn(`[OpenWA] Falha ao enviar mensagem (${res.status}):`, erroTxt);
    return { ok: false, erro: erroTxt || `Erro HTTP ${res.status}` };
  } catch (err: unknown) {
    console.error('[OpenWA] Erro de rede ao enviar mensagem:', err);
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
