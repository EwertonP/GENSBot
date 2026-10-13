import { supabase as serviceSupabase } from '@/lib/supabase';
import { enviarMensagemOpenWA } from '@/lib/openwa-client';

interface NotificarGrupoAprovacaoParams {
  agenciaId: string;
  clienteId: string;
  tituloPost: string;
  tokenAprovacao: string;
  origemUrl?: string;
  responsavelId?: string | null;
}

/**
 * Dispara automaticamente a notificação com o link de aprovação no Grupo de WhatsApp do Cliente
 * quando um card é movido para a coluna "Aprovação" (status: revisao_cliente).
 */
export async function notificarGrupoAprovacaoConteudo({
  agenciaId,
  clienteId,
  tituloPost,
  tokenAprovacao,
  origemUrl,
  responsavelId,
}: NotificarGrupoAprovacaoParams): Promise<{ ok: boolean; enviado: boolean; erro?: string }> {
  try {
    // 1. Busca os dados do cliente e o grupo de WhatsApp configurado
    const { data: cliente, error } = await serviceSupabase
      .from('clientes')
      .select('id, nome, whatsapp_grupo_id, contatos:cliente_contatos(id, telefone, e_grupo_whatsapp)')
      .eq('id', clienteId)
      .maybeSingle();

    if (error || !cliente) {
      return { ok: false, enviado: false, erro: 'Cliente não encontrado' };
    }

    // Identifica o destino: busca primeiro o grupo configurado por este responsável
    let grupoJid: string | null = null;
    let notificar = true;

    if (responsavelId) {
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

    // Fallback para o grupo legado do cliente se o membro ainda não tiver linha específica
    if (!grupoJid) {
      grupoJid = (cliente.whatsapp_grupo_id || '').trim();
    }
    if (!grupoJid && Array.isArray(cliente.contatos)) {
      const contatoGrupo = cliente.contatos.find((c: any) => c.e_grupo_whatsapp && c.telefone);
      if (contatoGrupo?.telefone) {
        grupoJid = contatoGrupo.telefone.trim();
      }
    }

    if (!grupoJid) {
      return { ok: true, enviado: false, erro: 'Nenhum grupo de WhatsApp configurado para este cliente e responsável.' };
    }

    // 2. Prepara o link e o texto formatado da mensagem
    const baseUrl =
      origemUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://allingens.vercel.app');

    const linkAprovacao = `${baseUrl.replace(/\/$/, '')}/aprovacao/${tokenAprovacao}`;

    const textoNotificacao = [
      `🔔 *NOVO CONTEÚDO PRONTO PARA APROVAÇÃO!*`,
      ``,
      `Olá, equipe de *${cliente.nome}*! 👋`,
      ``,
      `Finalizamos a produção da publicação *"${tituloPost || 'Conteúdo do Mês'}"* e ela já está disponível para a sua revisão.`,
      ``,
      `👉 *Acesse e aprove com 1 clique:*`,
      `${linkAprovacao}`,
      ``,
      `_Você pode visualizar as artes/vídeos, sugerir ajustes ou aprovar diretamente no link acima._ 🚀`,
      ``,
      `*Equipe GENS*`,
    ].join('\n');

    // 3. Localiza a sessão conectada:
    // ISOLAMENTO TOTAL: Envia unicamente pelo WhatsApp conectado do responsável pela demanda.
    // NUNCA fazer fallback para sessões pessoais de outros membros/sócios!
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('session_name, membro_id, cliente_id, status')
      .eq('agencia_id', agenciaId)
      .eq('status', 'conectado');

    if (!sessoes || sessoes.length === 0) {
      return { ok: false, enviado: false, erro: 'Nenhuma sessão de WhatsApp conectada na agência.' };
    }

    let sessionName: string | null = null;
    if (responsavelId) {
      const sessaoDesigner = sessoes.find((s: any) => s.membro_id === responsavelId);
      if (sessaoDesigner) {
        sessionName = sessaoDesigner.session_name;
      }
    }

    // Permite fallback apenas se houver uma sessão geral oficial da agência (sem membro_id e sem cliente_id)
    if (!sessionName) {
      const sessaoAgencia = sessoes.find((s: any) => !s.cliente_id && !s.membro_id);
      if (sessaoAgencia) {
        sessionName = sessaoAgencia.session_name;
      }
    }

    if (!sessionName) {
      console.warn(`[WhatsApp Aprovação] O responsável pela demanda (${responsavelId}) não possui WhatsApp próprio conectado no Perfil. Disparo cancelado para não enviar do número de outro colega.`);
      return {
        ok: false,
        enviado: false,
        erro: 'O responsável pela demanda ainda não conectou o seu WhatsApp próprio no Perfil.',
      };
    }

    // 4. Envia a mensagem para o grupo de WhatsApp
    const resultado = await enviarMensagemOpenWA({
      sessionName,
      para: grupoJid,
      texto: textoNotificacao,
    });

    if (!resultado.ok) {
      console.warn(`[Aprovação WhatsApp] Falha ao enviar no grupo ${grupoJid}:`, resultado.erro);
      return { ok: false, enviado: false, erro: resultado.erro };
    }

    return { ok: true, enviado: true };
  } catch (err: unknown) {
    console.error('[Aprovação WhatsApp] Erro inesperado:', err);
    return { ok: false, enviado: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
