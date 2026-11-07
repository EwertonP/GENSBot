/**
 * Notificações do app: grava na central (sino) e, conforme a preferência da
 * pessoa, manda push para os aparelhos dela. Nunca lança erro: um aviso que
 * falha não pode derrubar a ação que o gerou (publicar, aprovar, atribuir).
 */
import { supabase } from './supabase';
import { enviarPush, type AcaoPush, type PrioridadePush } from './push';

export type TipoNotificacao = 'post_falhou' | 'cliente_aprovou' | 'cliente_pediu_ajuste' | 'demanda_atribuida' | 'lead_novo' | 'cliente_sugeriu_texto' | 'alerta_conta';

export const TIPOS_NOTIFICACAO: Record<TipoNotificacao, { rotulo: string; descricao: string; pushPadrao: boolean }> = {
  post_falhou: { rotulo: 'Post que falhou', descricao: 'Quando uma publicação não consegue sair no Instagram.', pushPadrao: true },
  cliente_aprovou: { rotulo: 'Cliente aprovou', descricao: 'Quando o cliente aprova uma peça sua.', pushPadrao: true },
  cliente_pediu_ajuste: { rotulo: 'Cliente pediu ajuste', descricao: 'Quando o cliente pede alteração numa peça sua.', pushPadrao: true },
  cliente_sugeriu_texto: { rotulo: 'Cliente sugeriu texto', descricao: 'Quando o cliente sugere uma mudança no texto de um post em planejamento.', pushPadrao: true },
  alerta_conta: { rotulo: 'Alerta de conta conectada', descricao: 'Quando o acesso ao Instagram de um cliente está vencendo ou a renovação falhou, ou quando as automações estão falhando.', pushPadrao: true },
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
  /** Imagem de prévia (https): capa ou primeiro slide do post. */
  imagem?: string | null;
  /** Até 2 botões na notificação (Android e computador). */
  acoes?: AcaoPush[];
  /** Urgente fica na tela e chega na hora; baixa chega sem som. Padrão: normal. */
  prioridade?: PrioridadePush;
  /** Mesma chave substitui a notificação anterior no aparelho (ex.: "item:<id>"). Padrão: o tipo. */
  agrupar?: string | null;
  /**
   * Janela (minutos) em que a mesma notificação (mesmo tipo e mesma url) para a
   * mesma pessoa não se repete. 0 desliga (padrão).
   */
  evitarRepetirMin?: number;
}

/** Quantas notificações a pessoa ainda não leu (número no ícone do app). */
async function contarNaoLidas(userId: string): Promise<number | undefined> {
  try {
    const { count, error } = await supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('lida_em', null);
    return error || count == null ? undefined : count;
  } catch {
    return undefined;
  }
}

/** Tira quem já recebeu a mesma notificação dentro da janela. */
async function semRepetidas(ids: string[], tipo: TipoNotificacao, url: string, janelaMin: number): Promise<string[]> {
  if (janelaMin <= 0) return ids;
  try {
    const desde = new Date(Date.now() - janelaMin * 60 * 1000).toISOString();
    const { data } = await supabase.from('notificacoes').select('user_id').in('user_id', ids).eq('tipo', tipo).eq('url', url).gte('criado_em', desde);
    const jaTem = new Set((data || []).map((r: { user_id: string }) => r.user_id));
    return ids.filter((u) => !jaTem.has(u));
  } catch {
    return ids;
  }
}

export async function notificar(destinatarios: string | null | undefined | (string | null | undefined)[], dados: DadosNotificacao): Promise<void> {
  try {
    const lista = (Array.isArray(destinatarios) ? destinatarios : [destinatarios]).filter((u): u is string => !!u && u !== dados.exceto);
    const titulo = dados.titulo.slice(0, 120);
    const corpo = (dados.corpo || '').slice(0, 400);
    const url = dados.url || '/';

    const ids = await semRepetidas([...new Set(lista)], dados.tipo, url, dados.evitarRepetirMin ?? 0);
    if (ids.length === 0) return;

    const { error: erroInsert } = (await supabase.from('notificacoes').insert(ids.map((user_id) => ({ user_id, tipo: dados.tipo, titulo, corpo, url })))) ?? {};
    if (erroInsert) console.error('[notificar] não gravou na central:', (erroInsert as { message?: string }).message);

    const { data: prefs } = await supabase.from('notificacao_preferencias').select('user_id, push').eq('tipo', dados.tipo).in('user_id', ids);
    const porUsuario = new Map((prefs || []).map((p: { user_id: string; push: boolean }) => [p.user_id, p.push]));

    await Promise.all(
      ids
        .filter((u) => porUsuario.get(u) ?? TIPOS_NOTIFICACAO[dados.tipo].pushPadrao)
        .map(async (u) =>
          enviarPush(u, {
            title: titulo,
            body: corpo,
            url,
            tag: dados.agrupar || dados.tipo,
            imagem: dados.imagem,
            acoes: dados.acoes,
            prioridade: dados.prioridade,
            naoLidas: await contarNaoLidas(u),
          }),
        ),
    );
  } catch (err) {
    console.error('[notificar] falhou:', (err as Error).message);
  }
}
