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
 * Resolve o UUID exato da sessão no OpenWA a partir do sessionName cadastrado
 */
export async function obterSessionUuidOpenWA(sessionName: string): Promise<{
  sessionUuid: string | null;
  sessionExactName: string | null;
}> {
  const { url, headers } = getOpenWAConfig();
  if (!url) return { sessionUuid: null, sessionExactName: null };

  try {
    const resList = await fetch(`${url}/api/sessions`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!resList.ok) return { sessionUuid: null, sessionExactName: null };

    const sessions = await resList.json();
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return { sessionUuid: null, sessionExactName: null };
    }

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
      return { sessionUuid: match.id || null, sessionExactName: match.name || null };
    }

    // Se só existe 1 sessão no gateway ou se há sessão ativa/conectada, usa como candidata
    const ativa = sessions.find((s: any) => {
      const st = String(s.status || '').toLowerCase();
      return st === 'ready' || st === 'connected' || st === 'working';
    });
    if (ativa) {
      return { sessionUuid: ativa.id || null, sessionExactName: ativa.name || null };
    }

    return { sessionUuid: sessions[0].id || null, sessionExactName: sessions[0].name || null };
  } catch (err) {
    console.error('[OpenWA] Erro ao resolver session UUID:', err);
    return { sessionUuid: null, sessionExactName: null };
  }
}

/**
 * Resolve um link de convite do WhatsApp (https://chat.whatsapp.com/...) usando o OpenWA
 */
export async function resolverConviteGrupoOpenWA({
  sessionId,
  linkOuCodigo,
}: {
  sessionId: string;
  linkOuCodigo: string;
}): Promise<{ id: string; name: string } | null> {
  const { url, headers } = getOpenWAConfig();
  if (!url) return null;

  const match = linkOuCodigo.match(/chat\.whatsapp\.com\/([a-zA-Z0-9_-]+)/i);
  const code = match ? match[1] : linkOuCodigo.trim();
  if (!code) return null;

  // Endpoint oficial OpenWA (rmyndharis/OpenWA): POST /api/sessions/:sessionId/groups/join
  try {
    const res = await fetch(`${url}/api/sessions/${encodeURIComponent(sessionId)}/groups/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const jid = data.id?._serialized || data.id || data.groupId || data.jid;
      if (jid && String(jid).includes('@g.us')) {
        return {
          id: String(jid),
          name: data.subject || data.name || 'Grupo WhatsApp',
        };
      }
    }
  } catch (err) {
    console.error('[OpenWA] Erro ao resolver convite de grupo:', err);
  }

  return null;
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

  // 1. Resolve o UUID exato da sessão no OpenWA
  const { sessionUuid, sessionExactName } = await obterSessionUuidOpenWA(sessionName);
  const effectiveSessionId = sessionUuid || sessionExactName || sessionName;

  // 2. Se o destinatário for link de convite, resolve o grupo primeiro
  let dest = para.trim();
  if (dest.includes('chat.whatsapp.com/')) {
    const grupoResolvido = await resolverConviteGrupoOpenWA({
      sessionId: effectiveSessionId,
      linkOuCodigo: dest,
    });
    if (grupoResolvido?.id) {
      dest = grupoResolvido.id;
    } else {
      return {
        ok: false,
        erro: 'Não foi possível resolver o link de convite do grupo. Verifique se o link é válido ou informe o JID (@g.us) diretamente.',
      };
    }
  }

  // 3. Normaliza o destinatário (grupo @g.us ou contato @c.us)
  if (!dest.includes('@')) {
    if (dest.length >= 15 || dest.includes('-')) {
      dest = `${dest}@g.us`;
    } else {
      const digitos = dest.replace(/\D/g, '');
      dest = `${digitos}@c.us`;
    }
  }

  // 4. Executa o disparo oficial: POST /api/sessions/:sessionId/messages/send-text
  const targets = Array.from(
    new Set([sessionUuid, sessionExactName, sessionName].filter(Boolean) as string[])
  );

  let ultimoErro = '';

  for (const sid of targets) {
    // Tentativa A (Oficial OpenWA): POST /api/sessions/:sessionId/messages/send-text
    try {
      const res = await fetch(`${url}/api/sessions/${encodeURIComponent(sid)}/messages/send-text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: dest,
          text: texto,
        }),
        signal: AbortSignal.timeout(10000),
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

  // Fallback B: POST /api/sendText (WAHA)
  try {
    const resWaha = await fetch(`${url}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: effectiveSessionId,
        chatId: dest,
        text: texto,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (resWaha.ok) {
      const data = await resWaha.json().catch(() => ({}));
      return { ok: true, messageId: data.id || `msg-${Date.now()}` };
    }
  } catch {}

  console.warn('[OpenWA] Falha ao enviar mensagem:', ultimoErro);
  return {
    ok: false,
    erro: ultimoErro || 'Não foi possível enviar a mensagem no WhatsApp.',
  };
}
