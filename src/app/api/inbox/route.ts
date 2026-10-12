import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getContextoAgencia } from '@/lib/clientes-server';
import { getActiveInstagramAccountForUser } from '@/lib/instagram-account';
import { ehUuid } from '@/lib/clientes';

export interface ConversaUnificada {
  id: string; // id do contato ou telefone
  canal: 'instagram' | 'whatsapp';
  contato_id: string;
  nome: string | null;
  username: string | null; // @instagram ou null
  telefone: string | null; // WhatsApp formatado
  foto_url: string | null;
  ultima_mensagem: string | null;
  ultima_direcao: 'inbound' | 'outbound';
  data_ultima_mensagem: string;
  ai_modo: 'ia' | 'humano' | null;
  negocio_id: string | null;
  negocio_estagio_id?: string | null;
  negocio_estagio_nome?: string | null;
  pipeline_id?: string | null;
}

/**
 * GET: Retorna a lista unificada de conversas:
 * 1. Instagram: Apenas contatos que chegaram por automação ou interagiram com IA SDR.
 * 2. WhatsApp: Todas as conversas reais do número business da clínica/agência.
 */
export async function GET(req: Request) {
  try {
    const authCtx = await getContextoAgencia();
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const canalFiltro = searchParams.get('canal'); // 'todos' | 'instagram' | 'whatsapp'
    let clienteId = searchParams.get('cliente_id');

    const membro = authCtx.ok ? authCtx.ctx.membro : null;
    if (membro && membro.papel === 'cliente') {
      clienteId = membro.cliente_id || null;
    }

    const conversasUnificadas: ConversaUnificada[] = [];

    // ==========================================
    // 1. CARREGAR CONVERSAS DO INSTAGRAM DIRECT
    // ==========================================
    if (canalFiltro !== 'whatsapp') {
      try {
        const accountParam = searchParams.get('account');
        const config = await getActiveInstagramAccountForUser(user.id, accountParam);

        if (config?.instagram_user_id) {
          // Filtra contatos que passaram por automação (last_automation_id NOT NULL)
          // OU têm sessão de IA registrada
          const { data: contacts } = await serviceSupabase
            .from('contacts')
            .select('instagram_id, name, username, profile_picture_url, phone, last_automation_id, last_response_at')
            .eq('instagram_user_id', config.instagram_user_id)
            .not('last_automation_id', 'is', null)
            .order('last_response_at', { ascending: false, nullsFirst: false })
            .limit(100);

          const contactIds = (contacts || []).map((c) => c.instagram_id);

          // Também busca contatos que têm sessão de IA mesmo sem automação fixa
          const { data: aiSessions } = await serviceSupabase
            .from('ai_contact_sessions')
            .select('contact_id, modo, negocio_id')
            .eq('instagram_user_id', config.instagram_user_id)
            .limit(100);

          const aiSessionByContact = new Map((aiSessions || []).map((s) => [s.contact_id, s]));

          // Unifica IDs de quem tem automação OU sessão de IA
          const todosIdsRelevantes = Array.from(
            new Set([...contactIds, ...(aiSessions || []).map((s) => s.contact_id)])
          );

          if (todosIdsRelevantes.length > 0) {
            // Busca última mensagem de cada um
            const { data: messages } = await serviceSupabase
              .from('messages')
              .select('contact_id, text, direction, created_at')
              .eq('instagram_user_id', config.instagram_user_id)
              .in('contact_id', todosIdsRelevantes)
              .order('created_at', { ascending: false })
              .limit(300);

            const lastByContact = new Map<string, { text: string | null; direction: string; created_at: string }>();
            for (const m of messages || []) {
              if (!m.contact_id || lastByContact.has(m.contact_id)) continue;
              lastByContact.set(m.contact_id, {
                text: m.text,
                direction: m.direction,
                created_at: m.created_at as string,
              });
            }

            // Mapeia dados dos contatos
            const contactMap = new Map((contacts || []).map((c) => [c.instagram_id, c]));

            for (const id of todosIdsRelevantes) {
              const c = contactMap.get(id);
              const last = lastByContact.get(id);
              const aiSession = aiSessionByContact.get(id);

              conversasUnificadas.push({
                id: `ig_${id}`,
                canal: 'instagram',
                contato_id: id,
                nome: c?.name || null,
                username: c?.username || null,
                telefone: c?.phone || null,
                foto_url: c?.profile_picture_url || null,
                ultima_mensagem: last?.text || 'Interação iniciada via direct',
                ultima_direcao: (last?.direction as 'inbound' | 'outbound') || 'inbound',
                data_ultima_mensagem: last?.created_at || c?.last_response_at || new Date().toISOString(),
                ai_modo: aiSession?.modo || (aiSession ? 'ia' : null),
                negocio_id: aiSession?.negocio_id || null,
              });
            }
          }
        }
      } catch (errIg) {
        console.warn('Erro ao carregar conversas do Instagram no Inbox:', errIg);
      }
    }

    // ==========================================
    // 2. CARREGAR CONVERSAS DO WHATSAPP (OPENWA)
    // ==========================================
    if (canalFiltro !== 'instagram') {
      try {
        const agenciaId = membro?.agencia_id || 'a6839f40-dc25-4c00-a662-8d90c100b8c2';

        let queryWa = serviceSupabase
          .from('whatsapp_mensagens')
          .select('remetente, conteudo, de_mim, nome_contato, timestamp_msg, negocio_id, cliente_id')
          .eq('agencia_id', agenciaId)
          .order('timestamp_msg', { ascending: false })
          .limit(500);

        if (clienteId && ehUuid(clienteId)) {
          queryWa = queryWa.eq('cliente_id', clienteId);
        }

        const { data: waMensagens } = await queryWa;

        const ultimasPorRemetente = new Map<string, any>();
        for (const m of waMensagens || []) {
          if (!m.remetente || ultimasPorRemetente.has(m.remetente)) continue;
          ultimasPorRemetente.set(m.remetente, m);
        }

        for (const [remetente, m] of ultimasPorRemetente.entries()) {
          conversasUnificadas.push({
            id: `wa_${remetente}`,
            canal: 'whatsapp',
            contato_id: remetente,
            nome: m.nome_contato || `WhatsApp +${remetente}`,
            username: null,
            telefone: remetente,
            foto_url: null,
            ultima_mensagem: m.conteudo || 'Mensagem de WhatsApp',
            ultima_direcao: m.de_mim ? 'outbound' : 'inbound',
            data_ultima_mensagem: m.timestamp_msg || new Date().toISOString(),
            ai_modo: null, // No WhatsApp a IA apenas escuta (Shadow CRM)
            negocio_id: m.negocio_id || null,
          });
        }
      } catch (errWa) {
        console.warn('Erro ao carregar conversas do WhatsApp no Inbox:', errWa);
      }
    }

    // ==========================================
    // 3. ENRIQUECER COM DADOS DO CRM (NEGÓCIOS)
    // ==========================================
    const negocioIds = conversasUnificadas
      .map((c) => c.negocio_id)
      .filter((id): id is string => Boolean(id && ehUuid(id)));

    if (negocioIds.length > 0) {
      const { data: negocios } = await serviceSupabase
        .from('crm_negocios')
        .select('id, pipeline_id, estagio_id, crm_estagios(nome)')
        .in('id', negocioIds);

      const negocioMap = new Map((negocios || []).map((n: any) => [n.id, n]));

      for (const conv of conversasUnificadas) {
        if (conv.negocio_id && negocioMap.has(conv.negocio_id)) {
          const neg: any = negocioMap.get(conv.negocio_id);
          conv.pipeline_id = neg.pipeline_id;
          conv.negocio_estagio_id = neg.estagio_id;
          conv.negocio_estagio_nome = neg.crm_estagios?.nome || null;
        }
      }
    }

    // Ordena toda a lista unificada cronologicamente (mais recente primeiro)
    conversasUnificadas.sort(
      (a, b) => new Date(b.data_ultima_mensagem).getTime() - new Date(a.data_ultima_mensagem).getTime()
    );

    return NextResponse.json(conversasUnificadas);
  } catch (err: unknown) {
    console.error('Erro na API unificada do Inbox:', err);
    return NextResponse.json({ error: 'Falha interna ao carregar inbox.' }, { status: 500 });
  }
}
