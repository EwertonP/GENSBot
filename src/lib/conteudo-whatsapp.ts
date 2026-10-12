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

    // 3. Localiza qual sessão está conectada:
    // Prioridade Máxima:
    // a) Sessão do designer/responsável pela demanda (responsavelId)
    // b) Sessão do WhatsApp oficial da agência
    // c) Qualquer sessão ativa da agência
    const { data: sessoes } = await serviceSupabase
      .from('whatsapp_sessions')
      .select('session_name, membro_id, cliente_id, status')
      .eq('agencia_id', agenciaId)
      .eq('status', 'conectado');

    let sessionName = `agencia-${agenciaId}`;

    if (sessoes && sessoes.length > 0) {
      if (responsavelId) {
        const sessaoDesigner = sessoes.find((s: any) => s.membro_id === responsavelId);
        if (sessaoDesigner) {
          sessionName = sessaoDesigner.session_name;
        }
      }

      if (!sessionName.startsWith('membro-')) {
        const sessaoAgencia = sessoes.find((s: any) => !s.cliente_id && !s.membro_id);
        if (sessaoAgencia) {
          sessionName = sessaoAgencia.session_name;
        } else {
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
