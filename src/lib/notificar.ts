/**
 * Notificações do app: grava na central (sino) e, conforme a preferência da
 * pessoa, manda push para os aparelhos dela. Nunca lança erro: um aviso que
 * falha não pode derrubar a ação que o gerou (publicar, aprovar, atribuir).
 */
import { supabase } from './supabase';
import { enviarPush } from './push';

export type TipoNotificacao = 'post_falhou' | 'cliente_aprovou' | 'cliente_pediu_ajuste' | 'demanda_atribuida' | 'lead_novo' | 'cliente_sugeriu_texto';

export const TIPOS_NOTIFICACAO: Record<TipoNotificacao, { rotulo: string; descricao: string; pushPadrao: boolean }> = {
  post_falhou: { rotulo: 'Post que falhou', descricao: 'Quando uma publicação não consegue sair no Instagram.', pushPadrao: true },
  cliente_aprovou: { rotulo: 'Cliente aprovou', descricao: 'Quando o cliente aprova uma peça sua.', pushPadrao: true },
  cliente_pediu_ajuste: { rotulo: 'Cliente pediu ajuste', descricao: 'Quando o cliente pede alteração numa peça sua.', pushPadrao: true },
  cliente_sugeriu_texto: { rotulo: 'Cliente sugeriu texto', descricao: 'Quando o cliente sugere uma mudança no texto de um post em planejamento.', pushPadrao: true },
  demanda_atribuida: { rotulo: 'Demanda atribuída a você', descricao: 'Quando alguém passa uma demanda para você.', pushPadrao: true },
  lead_novo: { rotulo: 'Lead novo', descricao: 'Quando uma automação sua captura um lead. Pode ser frequente.', pushPadrao: false },
};

export function tipoValido(t: unknown): t is TipoNotificacao {
  return typeof t === 'string' && t in TIPOS_NOTIFICACAO;
}

export interface DadosNotificacao {
  tipo: TipoNotificacao;
  titulo: string;
  corpo?: string;
  /** Caminho aberto ao tocar, ex.: "/?tab=esteira&item=<id>". */
  url?: string;
  /** Quem fez a ação não precisa ser avisado dela. */
  exceto?: string | null;
}

export async function notificar(destinatarios: string | null | undefined | (string | null | undefined)[], dados: DadosNotificacao): Promise<void> {
  try {
    const lista = (Array.isArray(destinatarios) ? destinatarios : [destinatarios]).filter((u): u is string => !!u && u !== dados.exceto);
    const ids = [...new Set(lista)];
    if (ids.length === 0) return;

    const titulo = dados.titulo.slice(0, 120);
    const corpo = (dados.corpo || '').slice(0, 400);
    const url = dados.url || '/';

    await supabase.from('notificacoes').insert(ids.map((user_id) => ({ user_id, tipo: dados.tipo, titulo, corpo, url })));

    const { data: prefs } = await supabase.from('notificacao_preferencias').select('user_id, push').eq('tipo', dados.tipo).in('user_id', ids);
    const porUsuario = new Map((prefs || []).map((p: { user_id: string; push: boolean }) => [p.user_id, p.push]));

    await Promise.all(
      ids
        .filter((u) => porUsuario.get(u) ?? TIPOS_NOTIFICACAO[dados.tipo].pushPadrao)
        .map((u) => enviarPush(u, { title: titulo, body: corpo, url, tag: dados.tipo })),
    );
  } catch (err) {
    console.error('[notificar] falhou:', (err as Error).message);
  }
}
