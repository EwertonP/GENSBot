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
 * Envia mensagem de texto para número pessoal (@c.us) ou Grupo (@g.us) via WAHA / OpenWA
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

  // 1. Resolve identificadores da sessão consultando o gateway (UUID e Nome exatos)
  let identifiers = [sessionName, sessionName.replace(/-/g, '_'), sessionName.replace(/_/g, '-')];
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
          identifiers = Array.from(
            new Set([match.name, match.id, sessionName, sessionName.replace(/-/g, '_')].filter(Boolean))
          );
        } else if (sessions.length === 1 && sessions[0]) {
          // Se só há 1 sessão no gateway, inclui ela como candidata
          const unica = sessions[0];
          identifiers.push(unica.name, unica.id);
        }
      }
    }
  } catch {
    // Segue com os identificadores padrão se listagem prévia falhar
  }

  // Inclui fallback para 'default' se for instalação single-session do WAHA
  if (!identifiers.includes('default')) {
    identifiers.push('default');
  }

  // 2. Monta lista de tentativas de envio na ordem oficial do WAHA
  interface AttemptConfig {
    endpoint: string;
    body: Record<string, any>;
  }

  const attempts: AttemptConfig[] = [];

  for (const sid of identifiers) {
    // Padrão oficial WAHA: POST /api/sendText com session no body
    attempts.push({
      endpoint: `${url}/api/sendText`,
      body: {
        session: sid,
        chatId: dest,
        text: texto,
      },
    });

    // Padrão WAHA com session na URL: POST /api/{session}/sendText
    attempts.push({
      endpoint: `${url}/api/${encodeURIComponent(sid)}/sendText`,
      body: {
        chatId: dest,
        text: texto,
      },
    });

    // Padrão com prefixo sessions: POST /api/sessions/{session}/sendText
    attempts.push({
      endpoint: `${url}/api/sessions/${encodeURIComponent(sid)}/sendText`,
      body: {
        chatId: dest,
        text: texto,
      },
    });

    // Padrão OpenWA alternativo
    attempts.push({
      endpoint: `${url}/api/messages/send-text`,
      body: {
        session: sid,
        chatId: dest,
        to: dest,
        text: texto,
        content: texto,
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
        const messageId = data.id || data.messageId || data.key?.id || `msg-${Date.now()}`;
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
