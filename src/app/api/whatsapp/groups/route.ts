import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
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

    // Tenta obter lista de chats / grupos por todos os formatos de rotas do gateway
    let rawChats: any[] = [];
    const endpointsParaTentar: string[] = [];

    for (const id of identifiers) {
      endpointsParaTentar.push(
        `${openwaUrl}/api/chats?session=${encodeURIComponent(id)}`,
        `${openwaUrl}/api/${encodeURIComponent(id)}/chats`,
        `${openwaUrl}/api/groups?session=${encodeURIComponent(id)}`,
        `${openwaUrl}/api/${encodeURIComponent(id)}/groups`
      );
    }
    endpointsParaTentar.push(`${openwaUrl}/api/chats`);
    endpointsParaTentar.push(`${openwaUrl}/api/groups`);

    for (const endpoint of endpointsParaTentar) {
      try {
        const res = await fetch(endpoint, {
          headers,
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            rawChats = data;
            break;
          } else if (data && Array.isArray(data.chats) && data.chats.length > 0) {
            rawChats = data.chats;
            break;
          } else if (data && Array.isArray(data.groups) && data.groups.length > 0) {
            rawChats = data.groups;
            break;
          }
        }
      } catch {
        // Tenta o próximo endpoint
      }
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
        c.name ||
        c.formattedTitle ||
        c.subject ||
        c.groupMetadata?.subject ||
        c.contact?.name ||
        idRaw.replace('@g.us', '');

      const participantsCount =
        c.participants?.length ||
        c.groupMetadata?.participants?.length ||
        undefined;

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
      sessionName,
      phone: sessaoAlvo.phone_number || null,
      pushName: sessaoAlvo.push_name || null,
    });
  } catch (err: unknown) {
    console.error('Erro ao listar grupos do WhatsApp:', err);
    return respostaErro('Falha interna ao listar grupos do WhatsApp.', 500);
  }
}
