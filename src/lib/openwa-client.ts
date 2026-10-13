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
    Accept: 'application/json',
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
 * Envia mensagem de texto para número pessoal (@c.us) ou Grupo (@g.us) via OpenWA (rmyndharis/OpenWA)
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

  // Normaliza o destinatário (grupo @g.us ou contato individual @c.us)
  let dest = para.trim();
  if (!dest.includes('@')) {
    if (dest.length >= 15 || dest.includes('-')) {
      dest = `${dest}@g.us`;
    } else {
      const digitos = dest.replace(/\D/g, '');
      dest = `${digitos}@c.us`;
    }
  }

  // 1. Resolve o UUID exato da sessão no OpenWA
  let sessionUuid: string | null = null;
  let sessionExactName: string | null = null;
  try {
    const resList = await fetch(`${url}/api/sessions`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    if (resList.ok) {
      const sessions = await resList.json();
      if (Array.isArray(sessions)) {
        const sNameNorm = sessionName.toLowerCase();
        const match = sessions.find((s: any) => {
          const itemNome = (s.name || s.id || '').toLowerCase();
          return (
            itemNome === sNameNorm ||
            itemNome === sNameNorm.replace(/-/g, '_') ||
            itemNome === sNameNorm.replace(/_/g, '-') ||
            (s.id && s.id === sessionName)
          );
        });
        if (match) {
          sessionUuid = match.id || null;
          sessionExactName = match.name || null;
        } else if (sessions.length === 1 && sessions[0]) {
          sessionUuid = sessions[0].id || null;
          sessionExactName = sessions[0].name || null;
        }
      }
    }
  } catch {
    // Segue com fallbacks
  }

  const idsParaTentar = Array.from(
    new Set([sessionUuid, sessionExactName, sessionName, sessionName.replace(/-/g, '_')].filter(Boolean) as string[])
  );

  // 2. Monta lista de tentativas de envio na ordem oficial do OpenWA (rmyndharis/OpenWA)
  interface AttemptConfig {
    endpoint: string;
    body: Record<string, any>;
  }

  const attempts: AttemptConfig[] = [];

  for (const sid of idsParaTentar) {
    // Padrão oficial OpenWA: POST /api/sessions/:sessionId/messages/send-text
    attempts.push({
      endpoint: `${url}/api/sessions/${encodeURIComponent(sid)}/messages/send-text`,
      body: {
        chatId: dest,
        text: texto,
        to: dest,
      },
    });

    // Padrão alternativo com messages direto
    attempts.push({
      endpoint: `${url}/api/sessions/${encodeURIComponent(sid)}/send-text`,
      body: {
        chatId: dest,
        text: texto,
      },
    });

    // Padrão WAHA alternativo: POST /api/sendText
    attempts.push({
      endpoint: `${url}/api/sendText`,
      body: {
        session: sid,
        chatId: dest,
        text: texto,
      },
    });

    // Padrão com session na URL: POST /api/:sid/sendText
    attempts.push({
      endpoint: `${url}/api/${encodeURIComponent(sid)}/sendText`,
      body: {
        chatId: dest,
        text: texto,
      },
    });
  }

  let ultimoErro = '';

  for (const att of attempts) {
    try {
      const res = await fetch(att.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(att.body),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const messageId = data.id || data.messageId || data.key?.id || data.data?.id || `msg-${Date.now()}`;
        return { ok: true, messageId };
      }

      const text = await res.text();
      let msg = text;
      try {
        const json = JSON.parse(text);
        msg = json.message || json.error || text;
      } catch {}

      ultimoErro = msg || `HTTP ${res.status}`;
    } catch (errReq: any) {
      ultimoErro = errReq?.message || String(errReq);
    }
  }

  console.warn('[OpenWA] Falha em todas as tentativas de envio:', ultimoErro);
  return {
    ok: false,
    erro: ultimoErro || 'Não foi possível enviar a mensagem no WhatsApp.',
  };
}
