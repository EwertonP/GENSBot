import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { ehUuid } from '@/lib/clientes';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { getOpenWAConfig } from '@/lib/openwa-client';

export interface WhatsAppGroupOption {
  id: string; // JID terminado com @g.us
  name: string;
  isGroup: boolean;
  participantsCount?: number;
}

// GET: Lista todos os grupos de WhatsApp disponíveis a partir da sessão conectada
// Pode buscar pela sessão do membro (designer/dono), da agência ou de um cliente específico
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id') || null;
  const membroId = searchParams.get('membro_id') || null;

  try {
    // 1. Localiza a sessão conectada adequada:
    // Para aprovações, a prioridade máxima é o WhatsApp do membro/designer logado
    const { data: todasSessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('agencia_id', membro.agencia_id)
      .eq('status', 'conectado');

    const sessoes = todasSessoes || [];

    // Prioridade 1: WhatsApp do membro logado
    let sessaoAlvo = sessoes.find((s: any) => s.membro_id === membro.id) || null;

    // Prioridade 2: Se foi passado membro_id específico
    if (!sessaoAlvo && membroId) {
      sessaoAlvo = sessoes.find((s: any) => s.membro_id === membroId) || null;
    }

    // Prioridade 3: Sessão geral da agência
    if (!sessaoAlvo) {
      sessaoAlvo = sessoes.find((s: any) => !s.cliente_id && !s.membro_id) || null;
    }

    // Prioridade 4: Se o cliente tiver uma sessão conectada própria
    if (!sessaoAlvo && clienteId) {
      sessaoAlvo = sessoes.find((s: any) => s.cliente_id === clienteId) || null;
    }

    // Prioridade 5: Qualquer sessão conectada da agência
    if (!sessaoAlvo && sessoes.length > 0) {
      sessaoAlvo = sessoes[0];
    }

    if (!sessaoAlvo) {
      return NextResponse.json({
        ok: true,
        grupos: [],
        conectado: false,
        mensagem: 'Nenhum WhatsApp conectado no momento. Conecte seu WhatsApp no Perfil para carregar os grupos automaticamente.',
      });
    }

    // 2. Consulta o OpenWA para obter chats / grupos da sessão
    const { url: openwaUrl, headers } = getOpenWAConfig();
    if (!openwaUrl) {
      return NextResponse.json({
        ok: true,
        grupos: [],
        conectado: true,
        mensagem: 'OPENWA_API_URL não configurada no servidor.',
      });
    }

    const sessionName = sessaoAlvo.session_name;

    // Localiza a sessão no OpenWA para pegar o UUID e o nome exato registrado lá
    let sessionUuid: string | null = null;
    let sessionExactName: string | null = null;
    try {
      const resList = await fetch(`${openwaUrl}/api/sessions`, {
        headers,
        signal: AbortSignal.timeout(5000),
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
          }
        }
      }
    } catch {
      // Ignora falha na listagem prévia e tenta os fallbacks
    }

    const identifiers = Array.from(
      new Set(
        [
          sessionUuid,
          sessionExactName,
          sessionName,
          sessionName.replace(/-/g, '_'),
          sessionName.replace(/_/g, '-'),
        ].filter(Boolean) as string[]
      )
    );

    // Tenta obter lista de chats / grupos por todos os formatos de rotas suportados pelo gateway (WAHA, Baileys, OpenWA)
    let rawChats: any[] = [];
    const endpointsParaTentar: string[] = [];

    for (const id of identifiers) {
      endpointsParaTentar.push(
        `${openwaUrl}/api/sessions/${encodeURIComponent(id)}/groups`,
        `${openwaUrl}/api/${encodeURIComponent(id)}/groups`,
        `${openwaUrl}/api/sessions/${encodeURIComponent(id)}/chats`,
        `${openwaUrl}/api/${encodeURIComponent(id)}/chats`,
        `${openwaUrl}/api/groups?session=${encodeURIComponent(id)}`,
        `${openwaUrl}/api/chats?session=${encodeURIComponent(id)}`
      );
    }
    endpointsParaTentar.push(`${openwaUrl}/api/groups`);
    endpointsParaTentar.push(`${openwaUrl}/api/chats`);

    const debugAttempts: any[] = [];

    // Função auxiliar para extrair lista de chats/grupos de qualquer formato JSON de retorno
    function extrairLista(data: any): any[] {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (typeof data === 'object') {
        if (Array.isArray(data.groups)) return data.groups;
        if (Array.isArray(data.chats)) return data.chats;
        if (Array.isArray(data.data)) return data.data;
        if (Array.isArray(data.result)) return data.result;
        if (Array.isArray(data.items)) return data.items;
        // Formato NOWEB (dicionário chaveado por JID ex: { "12036302482394@g.us": { subject: "..." } })
        const keys = Object.keys(data);
        if (keys.some((k) => k.includes('@g.us') || k.includes('@c.us'))) {
          return Object.entries(data).map(([key, val]: [string, any]) => {
            if (typeof val === 'object' && val !== null) {
              return { id: val.id || key, ...val };
            }
            return { id: key, subject: String(val) };
          });
        }
      }
      return [];
    }

    for (const endpoint of endpointsParaTentar) {
      try {
        const res = await fetch(endpoint, {
          headers,
          signal: AbortSignal.timeout(6000),
        });

        const status = res.status;
        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {}

        const items = extrairLista(data);

        debugAttempts.push({
          endpoint: endpoint.replace(openwaUrl, ''),
          status,
          isJson: Boolean(data),
          itemCount: items.length,
        });

        if (res.ok && items.length > 0) {
          rawChats = items;
          break;
        }
      } catch (errReq: any) {
        debugAttempts.push({
          endpoint: endpoint.replace(openwaUrl, ''),
          error: errReq?.message || String(errReq),
        });
      }
    }

    // Se a busca inicial retornou vazia, tenta disparar o refresh de grupos no WAHA
    if (rawChats.length === 0 && identifiers.length > 0) {
      const idPrincipal = identifiers[0];
      try {
        await fetch(`${openwaUrl}/api/sessions/${encodeURIComponent(idPrincipal)}/groups/refresh`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(4000),
        }).catch(() => null);

        // Tenta novamente após solicitação de refresh
        const resRetry = await fetch(`${openwaUrl}/api/sessions/${encodeURIComponent(idPrincipal)}/groups`, {
          headers,
          signal: AbortSignal.timeout(4000),
        });
        if (resRetry.ok) {
          const dataRetry = await resRetry.json().catch(() => null);
          const itemsRetry = extrairLista(dataRetry);
          if (itemsRetry.length > 0) {
            rawChats = itemsRetry;
          }
        }
      } catch {}
    }

    // Filtra e normaliza apenas os grupos (@g.us)
    const grupos: WhatsAppGroupOption[] = [];
    const vistos = new Set<string>();

    for (const c of rawChats) {
      const idRaw = String(c.id?._serialized || c.id || c.chatId || c.jid || '');
      if (!idRaw.includes('@g.us')) continue;
      if (vistos.has(idRaw)) continue;
      vistos.add(idRaw);

      const nomeGrupo =
        c.subject ||
        c.name ||
        c.formattedTitle ||
        c.groupMetadata?.subject ||
        c.contact?.name ||
        idRaw.replace('@g.us', '');

      const participantsCount =
        c.participants?.length ||
        c.groupMetadata?.participants?.length ||
        (Array.isArray(c.participants) ? c.participants.length : undefined);

      grupos.push({
        id: idRaw,
        name: nomeGrupo,
        isGroup: true,
        participantsCount,
      });
    }

    // Ordena alfabeticamente por nome do grupo
    grupos.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    return NextResponse.json({
      ok: true,
      grupos,
      conectado: true,
      membroConectado: Boolean(sessaoAlvo.membro_id === membro.id),
      membroTelefone: sessaoAlvo.phone_number || null,
      membroNome: sessaoAlvo.push_name || null,
      sessionName,
      sessionUuid,
      phone: sessaoAlvo.phone_number || null,
      pushName: sessaoAlvo.push_name || null,
      totalRawChats: rawChats.length,
      debugAttempts: grupos.length === 0 ? debugAttempts : undefined,
    });
  } catch (err: unknown) {
    console.error('Erro ao listar grupos do WhatsApp:', err);
    return respostaErro('Falha interna ao listar grupos do WhatsApp.', 500);
  }
}

// POST: Resolve links de convite de grupos (ex: https://chat.whatsapp.com/...)
// Obtém o JID (@g.us) e o Nome do grupo diretamente pelo gateway
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const linkOuCodigo = String(body.link || body.code || '').trim();
    const clienteId = body.cliente_id || null;

    if (!linkOuCodigo) {
      return respostaErro('Informe o link de convite ou código do grupo.', 400);
    }

    // Extrai o código do link (https://chat.whatsapp.com/CODIGO)
    const match = linkOuCodigo.match(/chat\.whatsapp\.com\/([a-zA-Z0-9_-]+)/i);
    const inviteCode = match ? match[1] : linkOuCodigo.replace(/^@/, '').trim();

    // Localiza sessão do membro ou da agência
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('agencia_id', membro.agencia_id)
      .eq('status', 'conectado');

    const sessaoAlvo =
      sessoes?.find((s: any) => s.membro_id === membro.id) ||
      sessoes?.find((s: any) => !s.cliente_id && !s.membro_id) ||
      sessoes?.[0];

    if (!sessaoAlvo) {
      return respostaErro('Nenhum WhatsApp conectado no momento para resolver o convite.', 400);
    }

    const { url: openwaUrl, headers } = getOpenWAConfig();
    if (!openwaUrl) {
      return respostaErro('OPENWA_API_URL não configurada no servidor.', 500);
    }

    const sessionName = sessaoAlvo.session_name;

    // Tenta obter info do convite via WAHA / OpenWA
    const endpointsJoinInfo = [
      `${openwaUrl}/api/sessions/${encodeURIComponent(sessionName)}/groups/join-info?code=${encodeURIComponent(inviteCode)}`,
      `${openwaUrl}/api/${encodeURIComponent(sessionName)}/groups/join-info?code=${encodeURIComponent(inviteCode)}`,
      `${openwaUrl}/api/groups/join-info?session=${encodeURIComponent(sessionName)}&code=${encodeURIComponent(inviteCode)}`,
    ];

    let groupInfo: { id: string; name: string } | null = null;

    for (const ep of endpointsJoinInfo) {
      try {
        const res = await fetch(ep, { headers, signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          const jid = data.id?._serialized || data.id || data.jid;
          if (jid && String(jid).includes('@g.us')) {
            groupInfo = {
              id: String(jid),
              name: data.subject || data.name || data.title || 'Grupo WhatsApp',
            };
            break;
          }
        }
      } catch {}
    }

    // Se o join-info não estiver disponível, tenta endpoint de join
    if (!groupInfo) {
      const endpointsJoin = [
        `${openwaUrl}/api/sessions/${encodeURIComponent(sessionName)}/groups/join`,
        `${openwaUrl}/api/${encodeURIComponent(sessionName)}/groups/join`,
        `${openwaUrl}/api/groups/join`,
      ];

      for (const ep of endpointsJoin) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers,
            body: JSON.stringify({ code: inviteCode, session: sessionName }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            const data = await res.json();
            const jid = data.id?._serialized || data.id || data.groupId || data.jid;
            if (jid && String(jid).includes('@g.us')) {
              groupInfo = {
                id: String(jid),
                name: data.subject || data.name || 'Grupo WhatsApp',
              };
              break;
            }
          }
        } catch {}
      }
    }

    if (!groupInfo) {
      return respostaErro(
        'Não foi possível obter o identificador do grupo pelo link fornecido. Verifique se o link é válido ou informe o JID (@g.us) diretamente.',
        400
      );
    }

    // Se foi passado cliente_id, já vincula no banco
    if (clienteId && ehUuid(clienteId)) {
      await serviceSupabase
        .from('clientes')
        .update({ whatsapp_grupo_id: groupInfo.id })
        .eq('id', clienteId);
    }

    return NextResponse.json({
      ok: true,
      grupo: groupInfo,
      mensagem: `Grupo "${groupInfo.name}" identificado com sucesso!`,
    });
  } catch (err: unknown) {
    console.error('Erro ao resolver link de convite do grupo:', err);
    return respostaErro('Falha interna ao processar convite do WhatsApp.', 500);
  }
}
