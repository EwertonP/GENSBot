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
    // Prioridade:
    // a) Sessão do membro logado (designer / usuário atual)
    // b) Sessão geral da agência
    // c) Sessão específica do cliente (se requisitado)
    let query = serviceSupabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('agencia_id', membro.agencia_id)
      .eq('status', 'conectado');

    if (membroId) {
      query = query.eq('membro_id', membroId);
    } else if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data: sessoes } = await query;

    let sessaoAlvo = sessoes?.find((s: any) => s.membro_id === membro.id) || null;
    if (!sessaoAlvo) {
      sessaoAlvo = sessoes?.find((s: any) => !s.cliente_id && !s.membro_id) || null;
    }
    if (!sessaoAlvo && sessoes && sessoes.length > 0) {
      sessaoAlvo = sessoes[0];
    }

    // Se nenhuma sessão conectada foi encontrada via filtro restrito, tenta qualquer sessão conectada da agência
    if (!sessaoAlvo) {
      const { data: qualquerSessao } = await serviceSupabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('agencia_id', membro.agencia_id)
        .eq('status', 'conectado')
        .limit(1)
        .maybeSingle();

      sessaoAlvo = qualquerSessao || null;
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

    // Tenta obter lista de chats / grupos
    // Tenta endpoints comuns de gateways WhatsApp HTTP (OpenWA / WAHA)
    let rawChats: any[] = [];
    const endpointsParaTentar = [
      `${openwaUrl}/api/chats?session=${encodeURIComponent(sessionName)}`,
      `${openwaUrl}/api/${encodeURIComponent(sessionName)}/chats`,
      `${openwaUrl}/api/groups?session=${encodeURIComponent(sessionName)}`,
      `${openwaUrl}/api/${encodeURIComponent(sessionName)}/groups`,
      `${openwaUrl}/api/chats`,
    ];

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
