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
    // 1. Localiza a sessão conectada estritamente do membro logado (ou membro_id solicitado)
    // NUNCA fazer fallback para sessões de outros membros, garantindo isolamento total
    const alvoMembroId = membroId && ehUuid(membroId) ? membroId : membro.id;

    const { data: todasSessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('agencia_id', membro.agencia_id)
      .eq('status', 'conectado');

    const sessoes = todasSessoes || [];

    // Prioridade 1: Sessão do membro logado
    let sessaoAlvo = sessoes.find((s: any) => s.membro_id === alvoMembroId) || null;

    // Prioridade 2: Sessão oficial geral da agência (sem membro_id e sem cliente_id)
    if (!sessaoAlvo) {
      sessaoAlvo = sessoes.find((s: any) => !s.cliente_id && !s.membro_id) || null;
    }

    // Busca se este membro já possui um grupo configurado para este cliente
    let grupoConfigurado: string | null = null;
    let notificarAgendamento = true;

    if (clienteId && ehUuid(clienteId)) {
      const { data: vinculoGrupo } = await serviceSupabase
        .from('cliente_membro_whatsapp_grupos')
        .select('whatsapp_grupo_id, notificar_agendamento')
        .eq('cliente_id', clienteId)
        .eq('membro_id', alvoMembroId)
        .maybeSingle();

      if (vinculoGrupo) {
        grupoConfigurado = vinculoGrupo.whatsapp_grupo_id;
        notificarAgendamento = vinculoGrupo.notificar_agendamento ?? true;
      }
    }

    if (!sessaoAlvo) {
      return NextResponse.json({
        ok: true,
        grupos: [],
        conectado: false,
        membroConectado: false,
        grupoConfigurado,
        notificarAgendamento,
        mensagem: 'Seu WhatsApp pessoal ainda não está conectado no seu Perfil.',
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
      grupoConfigurado,
      notificarAgendamento,
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

    // Localiza sessão estritamente do membro logado (ou agência geral)
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('agencia_id', membro.agencia_id)
      .eq('status', 'conectado');

    const sessaoAlvo =
      sessoes?.find((s: any) => s.membro_id === membro.id) ||
      sessoes?.find((s: any) => !s.cliente_id && !s.membro_id);

    if (!sessaoAlvo) {
      return respostaErro('Seu WhatsApp pessoal ainda não está conectado no seu Perfil.', 400);
    }

    const { url: openwaUrl, headers } = getOpenWAConfig();
    if (!openwaUrl) {
      return respostaErro('OPENWA_API_URL não configurada no servidor.', 500);
    }

    const sessionName = sessaoAlvo.session_name;

    const { obterSessionUuidOpenWA, resolverConviteGrupoOpenWA } = await import('@/lib/openwa-client');
    const { sessionUuid } = await obterSessionUuidOpenWA(sessionName);
    const effectiveSessionId = sessionUuid || sessionName;

    const groupInfo = await resolverConviteGrupoOpenWA({
      sessionId: effectiveSessionId,
      linkOuCodigo,
    });

    if (!groupInfo) {
      return respostaErro(
        'Não foi possível obter o identificador do grupo pelo link fornecido. Verifique se o link é válido ou informe o JID (@g.us) diretamente.',
        400
      );
    }

    // Se foi passado cliente_id, vincula para este membro específico
    if (clienteId && ehUuid(clienteId)) {
      await serviceSupabase
        .from('cliente_membro_whatsapp_grupos')
        .upsert({
          cliente_id: clienteId,
          membro_id: membro.id,
          whatsapp_grupo_id: groupInfo.id,
          notificar_agendamento: true,
          atualizado_em: new Date().toISOString(),
        }, { onConflict: 'cliente_id,membro_id' });
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
