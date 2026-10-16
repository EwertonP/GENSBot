import { supabase as serviceSupabase } from '@/lib/supabase';
import { enviarMensagemOpenWA } from '@/lib/openwa-client';

interface NotificarGrupoAprovacaoParams {
  agenciaId: string;
  clienteId: string;
  conteudoId?: string;
  tituloPost: string;
  tokenAprovacao?: string | null;
  origemUrl?: string;
  responsavelId?: string | null;
  remetenteId?: string | null;
  forcarReenvio?: boolean;
}

// Cache em memória para evitar disparo duplicado acidental por concorrência ou duplo-clique
const ultimosDisparosAprovacao = new Map<string, number>();
const COOLDOWN_DISPARO_MS = 15000; // 15 segundos de cooldown entre disparos automáticos para o mesmo post

/**
 * Dispara automaticamente a notificação com o link de aprovação no Grupo de WhatsApp do Cliente
 * quando um card é movido para a coluna "Aprovação" (status: revisao_cliente).
 */
export async function notificarGrupoAprovacaoConteudo({
  agenciaId,
  clienteId,
  conteudoId,
  tituloPost,
  tokenAprovacao,
  origemUrl,
  responsavelId,
  remetenteId,
  forcarReenvio = false,
}: NotificarGrupoAprovacaoParams): Promise<{
  ok: boolean;
  enviado: boolean;
  erro?: string;
  aviso?: string;
  jaEnviadoRecentemente?: boolean;
}> {
  try {
    // 0. Trava contra disparo duplicado (concorrência / cliques rápidos)
    const chaveDisparo = conteudoId || (tokenAprovacao ? `token:${tokenAprovacao}` : `cli:${clienteId}`);
    const agora = Date.now();
    const ultimoDisparo = ultimosDisparosAprovacao.get(chaveDisparo);

    if (!forcarReenvio && ultimoDisparo && agora - ultimoDisparo < COOLDOWN_DISPARO_MS) {
      const segundosAtras = Math.round((agora - ultimoDisparo) / 1000);
      console.log(`[Aprovação WhatsApp] Disparo ignorado para "${tituloPost}" (${chaveDisparo}) pois já foi enviado há ${segundosAtras}s.`);
      return {
        ok: true,
        enviado: false,
        jaEnviadoRecentemente: true,
        aviso: 'Mensagem de aprovação já foi disparada recentemente para este post.',
      };
    }

    // 1. Busca os dados do cliente e o grupo de WhatsApp configurado
    const { data: cliente, error } = await serviceSupabase
      .from('clientes')
      .select('id, nome, whatsapp_grupo_id, contatos:cliente_contatos(id, telefone, e_grupo_whatsapp)')
      .eq('id', clienteId)
      .maybeSingle();

    if (error || !cliente) {
      return { ok: false, enviado: false, erro: 'Cliente não encontrado' };
    }

    // Identifica o destino: resolve de forma robusta o JID do grupo
    let grupoJid: string | null = null;
    let notificar = true;

    // A. Busca primeiro nas preferências do remetente logado (quem está finalizando/enviando a demanda)
    if (remetenteId) {
      const { data: vinculoRemetente } = await serviceSupabase
        .from('cliente_membro_whatsapp_grupos')
        .select('whatsapp_grupo_id, notificar_agendamento')
        .eq('cliente_id', clienteId)
        .eq('membro_id', remetenteId)
        .maybeSingle();

      if (vinculoRemetente?.whatsapp_grupo_id) {
        grupoJid = vinculoRemetente.whatsapp_grupo_id.trim();
        notificar = vinculoRemetente.notificar_agendamento ?? true;
      }
    }

    // B. Se o remetente não tiver grupo específico configurado, tenta o responsável pela demanda
    if (!grupoJid && responsavelId && responsavelId !== remetenteId) {
      const { data: vinculoMembro } = await serviceSupabase
        .from('cliente_membro_whatsapp_grupos')
        .select('whatsapp_grupo_id, notificar_agendamento')
        .eq('cliente_id', clienteId)
        .eq('membro_id', responsavelId)
        .maybeSingle();

      if (vinculoMembro?.whatsapp_grupo_id) {
        grupoJid = vinculoMembro.whatsapp_grupo_id.trim();
        notificar = vinculoMembro.notificar_agendamento ?? true;
      }
    }

    if (!notificar) {
      return { ok: true, enviado: false, erro: 'Notificações automáticas desativadas para este membro e cliente.' };
    }

    // C. Se ainda não achou, verifica se algum outro membro da agência já configurou o grupo deste cliente
    if (!grupoJid) {
      const { data: qualquerVinculo } = await serviceSupabase
        .from('cliente_membro_whatsapp_grupos')
        .select('whatsapp_grupo_id')
        .eq('cliente_id', clienteId)
        .not('whatsapp_grupo_id', 'is', null)
        .neq('whatsapp_grupo_id', '')
        .limit(1)
        .maybeSingle();

      if (qualquerVinculo?.whatsapp_grupo_id) {
        grupoJid = qualquerVinculo.whatsapp_grupo_id.trim();
      }
    }

    // D. Fallback para o grupo legado do cliente cadastrado na tabela clientes
    if (!grupoJid) {
      grupoJid = (cliente.whatsapp_grupo_id || '').trim();
    }

    // E. Fallback para contatos do cliente marcados como grupo de WhatsApp
    if (!grupoJid && Array.isArray(cliente.contatos)) {
      const contatoGrupo = cliente.contatos.find((c: any) => c.e_grupo_whatsapp && c.telefone);
      if (contatoGrupo?.telefone) {
        grupoJid = contatoGrupo.telefone.trim();
      }
    }

    // F. Fallback para qualquer telefone de contato do cliente
    if (!grupoJid && Array.isArray(cliente.contatos)) {
      const primeiroContato = cliente.contatos.find((c: any) => c.telefone);
      if (primeiroContato?.telefone) {
        grupoJid = primeiroContato.telefone.trim();
      }
    }

    if (!grupoJid) {
      return {
        ok: false,
        enviado: false,
        erro: 'Nenhum grupo ou número de WhatsApp configurado para este cliente. Vincule o grupo no Perfil do Cliente.',
      };
    }

    // 2. Garante o token de aprovação
    let token = tokenAprovacao;
    if (!token && conteudoId) {
      const { data: it } = await serviceSupabase
        .from('conteudo_items')
        .select('token_aprovacao')
        .eq('id', conteudoId)
        .maybeSingle();
      if (it?.token_aprovacao) {
        token = it.token_aprovacao;
      } else {
        token = crypto.randomUUID();
        await serviceSupabase
          .from('conteudo_items')
          .update({ token_aprovacao: token })
          .eq('id', conteudoId);
      }
    }

    // 3. Prepara o link e o texto formatado da mensagem
    let baseUrl =
      origemUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://allingens.vercel.app');

    // Se baseUrl for localhost ou vazia, WhatsApp e Meta não conseguem acessar nem gerar prévia
    if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_APP_URL
        : 'https://allingens.vercel.app';
    }

    const linkAprovacao = token
      ? `${baseUrl.replace(/\/$/, '')}/aprovacao/${token}`
      : `${baseUrl.replace(/\/$/, '')}/aprovacao`;

    const textoNotificacao = [
      `Olá! 👋 Aqui é da Agência GENS.`,
      ``,
      `Preparamos a nova publicação "${tituloPost || 'Conteúdo do Mês'}" para a sua aprovação:`,
      ``,
      `👉 Acesse e aprove com 1 clique:`,
      `${linkAprovacao}`,
      ``,
      `Você pode navegar pelos slides, assistir ao vídeo e sugerir ajustes direto no link! 🚀`,
    ].join('\n');

    // 4. Localiza a sessão conectada:
    // Prioriza o remetente (quem está executando e enviando), depois o responsável pela demanda
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('session_name, membro_id, cliente_id, status')
      .eq('agencia_id', agenciaId)
      .eq('status', 'conectado');

    if (!sessoes || sessoes.length === 0) {
      return {
        ok: false,
        enviado: false,
        erro: 'Nenhuma sessão de WhatsApp conectada no momento. Conecte seu WhatsApp no Perfil.',
      };
    }

    let sessionName: string | null = null;

    // 4.1 Prioridade 1: WhatsApp do membro logado que está enviando a demanda
    if (remetenteId) {
      const sessaoRemetente = sessoes.find((s: any) => s.membro_id === remetenteId);
      if (sessaoRemetente) {
        sessionName = sessaoRemetente.session_name;
      }
    }

    // 4.2 Prioridade 2: WhatsApp do designer responsável pela demanda
    if (!sessionName && responsavelId) {
      const sessaoDesigner = sessoes.find((s: any) => s.membro_id === responsavelId);
      if (sessaoDesigner) {
        sessionName = sessaoDesigner.session_name;
      }
    }

    // 4.3 Prioridade 3: Sessão geral da agência (sem membro_id e sem cliente_id)
    if (!sessionName) {
      const sessaoAgencia = sessoes.find((s: any) => !s.cliente_id && !s.membro_id);
      if (sessaoAgencia) {
        sessionName = sessaoAgencia.session_name;
      }
    }

    // 4.4 Prioridade 4: Se só houver uma sessão conectada na agência (ex: dono ou sócio único conectado)
    if (!sessionName && sessoes.length === 1) {
      sessionName = sessoes[0].session_name;
    }

    if (!sessionName) {
      return {
        ok: false,
        enviado: false,
        erro: 'Conecte o seu WhatsApp próprio no Perfil para enviar aprovações automáticas.',
      };
    }

    // 5. Envia a mensagem para o grupo de WhatsApp via OpenWA
    const resultado = await enviarMensagemOpenWA({
      sessionName,
      para: grupoJid,
      texto: textoNotificacao,
    });

    if (!resultado.ok) {
      console.warn(`[Aprovação WhatsApp] Falha ao enviar no grupo ${grupoJid}:`, resultado.erro);
      return { ok: false, enviado: false, erro: resultado.erro };
    }

    // Registra no cache de disparos recentes para bloquear repetições acidentais
    ultimosDisparosAprovacao.set(chaveDisparo, Date.now());

    return { ok: true, enviado: true };
  } catch (err: unknown) {
    console.error('[Aprovação WhatsApp] Erro inesperado:', err);
    return { ok: false, enviado: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
