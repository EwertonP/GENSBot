import { supabase as serviceSupabase } from '@/lib/supabase';
import { enviarMensagemOpenWA } from '@/lib/openwa-client';

interface NotificarGrupoAprovacaoParams {
  agenciaId: string;
  clienteId: string;
  tituloPost: string;
  tokenAprovacao: string;
  origemUrl?: string;
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

    // Identifica o destino: campo whatsapp_grupo_id ou contato marcado como grupo
    let grupoJid = (cliente.whatsapp_grupo_id || '').trim();
    if (!grupoJid && Array.isArray(cliente.contatos)) {
      const contatoGrupo = cliente.contatos.find((c: any) => c.e_grupo_whatsapp && c.telefone);
      if (contatoGrupo?.telefone) {
        grupoJid = contatoGrupo.telefone.trim();
      }
    }

    if (!grupoJid) {
      // Cliente não possui grupo de WhatsApp cadastrado — segue sem erro
      return { ok: true, enviado: false, erro: 'Nenhum grupo de WhatsApp configurado para este cliente.' };
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

    // 3. Localiza qual sessão está conectada (sessão do cliente ou sessão da agência)
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('session_name, cliente_id, status')
      .eq('agencia_id', agenciaId)
      .eq('status', 'conectado');

    let sessionName = `cliente-${clienteId}`;

    if (sessoes && sessoes.length > 0) {
      // Se houver sessão específica do cliente conectada, usa ela
      const sessaoCliente = sessoes.find((s: any) => s.cliente_id === clienteId);
      if (sessaoCliente) {
        sessionName = sessaoCliente.session_name;
      } else {
        // Caso contrário, usa a sessão conectada da agência
        const sessaoAgencia = sessoes.find((s: any) => !s.cliente_id);
        if (sessaoAgencia) {
          sessionName = sessaoAgencia.session_name;
        } else {
          // Usa a primeira sessão conectada disponível
          sessionName = sessoes[0].session_name;
        }
      }
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
