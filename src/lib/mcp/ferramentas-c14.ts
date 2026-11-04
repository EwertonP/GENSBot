/**
 * Ferramentas do MCP — Onda C14: agendar e publicar no Instagram.
 *
 * Publicar é público e não tem volta. Travas: só master; a conta precisa estar
 * vinculada a um cliente da agência; se veio demanda, ela é desse cliente; o token
 * precisa estar válido; e o Claude repete o @ em `confirmar_conta`. `publicar_agora`
 * ainda exige `confirmar: true`, que só vale depois do "aprovado" do Ewerton no chat.
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { resolverConta, str, lista } from './ferramentas-c3';
import { erroLimiteColaboradores, type PublishMediaType } from '../instagram-publish';
import { criarPublicacao } from '../publicacao';
import type { PublishAutomationConfig } from '../publish-automation';
import type { ContextoMcp } from './oauth';

type Args = Record<string, unknown>;

const TIPOS: PublishMediaType[] = ['IMAGE', 'CAROUSEL', 'REELS', 'STORIES'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COM_FUSO = /(Z|[+-]\d{2}:?\d{2})$/i;

function exigirMaster(ctx: ContextoMcp) {
  if (ctx.papel !== 'master') throw new ErroFerramenta('Só o master publica e agenda.');
}

export function dataComFuso(v: unknown, campo: string): string {
  const s = str(v, 40);
  if (!s || !COM_FUSO.test(s) || Number.isNaN(Date.parse(s))) {
    throw new ErroFerramenta(`"${campo}" precisa ser data ISO com fuso, ex.: 2026-11-10T18:00:00-03:00.`);
  }
  return new Date(s).toISOString();
}

interface ContaVerificada {
  userId: string;
  instagramUserId: string;
  username: string;
  accessToken: string;
  cliente: { id: string; nome: string };
}

/** Verificação de conta obrigatória antes de agendar ou publicar. */
export async function verificarConta(ctx: ContextoMcp, args: Args, demandaClienteId?: string | null): Promise<ContaVerificada> {
  const conta = await resolverConta(ctx, str(args.conta, 100));
  const username = (conta.instagram_username || '').toLowerCase();
  if (str(args.confirmar_conta, 100).replace(/^@/, '').toLowerCase() !== username) {
    throw new ErroFerramenta(`"confirmar_conta" precisa repetir o @ da conta onde vai publicar (@${conta.instagram_username}). Confira se é a do cliente certo.`);
  }

  const { data: cliente } = await db.from('clientes').select('id, nome').eq('agencia_id', ctx.agenciaId).eq('instagram_account_id', conta.id).maybeSingle();
  if (!cliente) throw new ErroFerramenta(`A conta @${conta.instagram_username} não está vinculada a nenhum cliente. Vincule na tela antes de publicar.`);
  if (demandaClienteId && demandaClienteId !== cliente.id) {
    throw new ErroFerramenta(`Essa demanda é de outro cliente, e a conta @${conta.instagram_username} é de ${cliente.nome}. Publicação cancelada.`);
  }

  const { data: tok } = await db.from('instagram_accounts').select('access_token, token_expires_at').eq('id', conta.id).maybeSingle();
  if (!tok?.access_token) throw new ErroFerramenta('Essa conta não tem token do Instagram. Reconecte na tela.');
  if (tok.token_expires_at && new Date(tok.token_expires_at).getTime() < Date.now()) {
    throw new ErroFerramenta('O token dessa conta expirou. Reconecte a conta na tela.');
  }
  return { userId: conta.user_id, instagramUserId: conta.instagram_user_id, username: conta.instagram_username || '', accessToken: tok.access_token, cliente };
}

async function demandaDaAgencia(ctx: ContextoMcp, id: string) {
  if (!UUID_RE.test(id)) throw new ErroFerramenta('"demanda_id" precisa ser um id (uuid) válido.');
  const { data } = await db.from('conteudo_items').select('id, titulo, status, cliente_id, legenda, arquivos, scheduled_post_id').eq('id', id).eq('agencia_id', ctx.agenciaId).maybeSingle();
  if (!data) throw new ErroFerramenta('Demanda não encontrada nesta agência.');
  if (data.status === 'publicado') throw new ErroFerramenta('Essa demanda já foi publicada.');
  return data;
}

function urlsHttps(v: unknown, campo: string): string[] {
  const urls = lista(v, 10, 2000);
  if (urls.some((u) => !/^https:\/\//i.test(u))) throw new ErroFerramenta(`"${campo}" só aceita URLs https.`);
  return urls;
}

export function validarMidias(tipo: PublishMediaType, urls: string[]) {
  if (urls.length === 0) throw new ErroFerramenta('Sem mídia: mande "midias" ou anexe na demanda (anexar_midia_demanda).');
  if (tipo === 'CAROUSEL' && (urls.length < 2 || urls.length > 10)) throw new ErroFerramenta('Carrossel precisa de 2 a 10 mídias.');
  if (tipo !== 'CAROUSEL' && urls.length !== 1) throw new ErroFerramenta(`${tipo} usa exatamente 1 mídia.`);
}

function montarAutomacao(a: unknown): PublishAutomationConfig | null {
  if (!a || typeof a !== 'object') return null;
  const x = a as Args;
  if (x.copy_humanizada !== true) throw new ErroFerramenta('A automação do post exige copy_humanizada = true (passe o texto da DM pelo humanizer).');
  const palavras = lista(x.palavras_chave, 10, 40);
  const dm = str(x.mensagem_dm, 1000);
  if (palavras.length === 0 || !dm) throw new ErroFerramenta('Automação do post: informe "palavras_chave" e "mensagem_dm".');
  return {
    enabled: true,
    keywords: palavras,
    match_type: 'contains',
    welcome_dm: dm,
    link_button_label: str(x.texto_botao, 40) || null,
    link_url: str(x.link, 2000) || null,
    public_replies: lista(x.respostas_publicas, 5, 200),
  };
}

const PROPS_COMUNS = {
  conta: { type: 'string', description: 'username do Instagram (listar_contas_instagram).' },
  confirmar_conta: { type: 'string', description: 'Repita o @ da conta onde vai sair. Precisa bater com a conta resolvida.' },
  tipo: { type: 'string', enum: TIPOS, description: 'IMAGE, CAROUSEL (2 a 10), REELS ou STORIES.' },
  midias: { type: 'array', items: { type: 'string' }, description: 'URLs https na ordem. Omita pra usar os arquivos anexados na demanda.' },
  legenda: { type: 'string', description: 'Legenda completa (máx. 2200). Omita pra usar a da demanda.' },
  demanda_id: { type: 'string', description: 'Demanda da esteira (uuid). Precisa ser do mesmo cliente da conta.' },
  colaboradores: { type: 'array', items: { type: 'string' }, description: 'Até 3 @ de colaboradores.' },
  capa_url: { type: 'string', description: 'Capa do Reels (https).' },
  local_id: { type: 'string' },
  local_nome: { type: 'string' },
  audio: { type: 'string', description: 'Nome do áudio do Reels.' },
  automacao: {
    type: 'object',
    description: 'Opcional: automação de DM ligada ao post (nasce ativa, vinculada ao post).',
    properties: {
      palavras_chave: { type: 'array', items: { type: 'string' } },
      mensagem_dm: { type: 'string' },
      texto_botao: { type: 'string' },
      link: { type: 'string' },
      respostas_publicas: { type: 'array', items: { type: 'string' } },
      copy_humanizada: { type: 'boolean' },
    },
    additionalProperties: false,
  },
};

async function prepararPublicacao(ctx: ContextoMcp, args: Args) {
  exigirMaster(ctx);
  const tipo = str(args.tipo, 20) as PublishMediaType;
  if (!TIPOS.includes(tipo)) throw new ErroFerramenta(`"tipo" deve ser um de: ${TIPOS.join(', ')}.`);

  const demanda = args.demanda_id ? await demandaDaAgencia(ctx, str(args.demanda_id, 64)) : null;
  const conta = await verificarConta(ctx, args, demanda?.cliente_id);

  let urls = urlsHttps(args.midias, 'midias');
  if (urls.length === 0 && demanda?.arquivos) {
    urls = [...(demanda.arquivos as { url: string; ordem: number }[])].sort((a, b) => a.ordem - b.ordem).map((a) => a.url);
  }
  validarMidias(tipo, urls);

  const legenda = (str(args.legenda, 2200) || demanda?.legenda || '').toString();
  if (legenda.length > 2200) throw new ErroFerramenta('Legenda passa de 2200 caracteres.');
  const colab = lista(args.colaboradores, 10, 60).map((c) => c.replace(/^@/, ''));
  const limite = erroLimiteColaboradores(colab);
  if (limite) throw new ErroFerramenta(limite);
  const capa = str(args.capa_url, 2000);
  if (capa && !/^https:\/\//i.test(capa)) throw new ErroFerramenta('"capa_url" precisa ser https.');

  return {
    conta,
    demanda,
    dados: {
      userId: conta.userId,
      instagramUserId: conta.instagramUserId,
      accessToken: conta.accessToken,
      mediaType: tipo,
      mediaUrl: urls[0],
      mediaUrls: tipo === 'CAROUSEL' ? urls : null,
      caption: legenda || null,
      collaborators: colab.length ? colab : null,
      coverUrl: capa || null,
      locationId: str(args.local_id, 60) || null,
      locationName: str(args.local_nome, 120) || null,
      audioName: str(args.audio, 120) || null,
      conteudoItemId: demanda?.id || null,
      automation: montarAutomacao(args.automacao),
    },
  };
}

function resumo(r: Awaited<ReturnType<typeof criarPublicacao>>, conta: ContaVerificada) {
  const base = { conta: `@${conta.username}`, cliente: conta.cliente.nome };
  switch (r.situacao) {
    case 'agendado':
      return { ...base, situacao: 'agendado', post_id: r.post.id, para: r.post.scheduled_at };
    case 'publicado':
      return { ...base, situacao: 'publicado', post_id: r.post.id, link: r.link, aviso: r.post.aviso || null, automacao_criada: Boolean(r.post.created_automation_id) };
    case 'processando':
      return { ...base, situacao: 'processando', post_id: r.post?.id, aviso: 'A Meta ainda processa o vídeo. O cron finaliza em instantes; acompanhe em listar_fila_publicacao.' };
    default:
      throw new ErroFerramenta(`A Meta recusou a publicação: ${r.erro}`);
  }
}

export const FERRAMENTAS_C14: Ferramenta[] = [
  {
    name: 'agendar_post',
    title: 'Agendar post',
    description:
      'Agenda um post no Instagram de um cliente pra uma data futura (o cron publica na hora marcada). Verifica se a conta é do cliente certo (repita o @ em confirmar_conta). Se veio demanda_id, move a demanda pra "agendamento". Só master.',
    inputSchema: {
      type: 'object',
      properties: { ...PROPS_COMUNS, data_hora: { type: 'string', description: 'ISO com fuso, ex.: 2026-11-10T18:00:00-03:00. Precisa estar ao menos 2 min no futuro.' } },
      required: ['conta', 'confirmar_conta', 'tipo', 'data_hora'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      const quando = dataComFuso(args.data_hora, 'data_hora');
      if (new Date(quando).getTime() < Date.now() + 2 * 60_000) throw new ErroFerramenta('"data_hora" precisa estar ao menos 2 minutos no futuro. Pra publicar agora, use publicar_agora.');
      const p = await prepararPublicacao(ctx, args);
      return resumo(await criarPublicacao({ ...p.dados, scheduledAt: quando }), p.conta);
    },
  },
  {
    name: 'publicar_agora',
    title: 'Publicar agora',
    description:
      'PUBLICA NA HORA no Instagram do cliente, sem fila. Público e sem volta: só chame depois do "aprovado" explícito do Ewerton no chat pra essa peça, com confirmar: true. Verifica conta, cliente e demanda. Devolve o link do post; em Reels pode devolver "processando".',
    inputSchema: {
      type: 'object',
      properties: { ...PROPS_COMUNS, confirmar: { type: 'boolean', description: 'true somente após o aprovado no chat.' } },
      required: ['conta', 'confirmar_conta', 'tipo', 'confirmar'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      if (args.confirmar !== true) throw new ErroFerramenta('Publicar é público e não tem volta. Confirme com o Ewerton no chat e envie confirmar = true.');
      const p = await prepararPublicacao(ctx, args);
      return resumo(await criarPublicacao({ ...p.dados, scheduledAt: null }), p.conta);
    },
  },
  {
    name: 'editar_post_agendado',
    title: 'Editar post agendado',
    description: 'Muda legenda, data, mídias ou colaboradores de um post que ainda NÃO publicou (agendado ou com falha). Post já no feed não se edita pela API da Meta. Só master.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'id (uuid) do post em listar_fila_publicacao.' },
        legenda: { type: 'string' },
        data_hora: { type: 'string', description: 'ISO com fuso.' },
        midias: { type: 'array', items: { type: 'string' } },
        colaboradores: { type: 'array', items: { type: 'string' } },
      },
      required: ['post_id'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      exigirMaster(ctx);
      const post = await postDaAgencia(ctx, str(args.post_id, 64));
      const upd: Record<string, unknown> = {};
      const item: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (args.legenda !== undefined) {
        const l = str(args.legenda, 2200);
        upd.caption = l;
        item.legenda = l;
      }
      if (args.data_hora !== undefined) {
        const q = dataComFuso(args.data_hora, 'data_hora');
        upd.scheduled_at = q;
        upd.status = 'scheduled';
        item.data_programada = q;
      }
      if (args.midias !== undefined) {
        const urls = urlsHttps(args.midias, 'midias');
        validarMidias(post.media_type as PublishMediaType, urls);
        upd.media_url = urls[0];
        upd.media_urls = post.media_type === 'CAROUSEL' ? urls : null;
      }
      if (args.colaboradores !== undefined) {
        const c = lista(args.colaboradores, 10, 60).map((x) => x.replace(/^@/, ''));
        const limite = erroLimiteColaboradores(c);
        if (limite) throw new ErroFerramenta(limite);
        upd.collaborators = c.length ? c : null;
      }
      if (Object.keys(upd).length === 0) throw new ErroFerramenta('Nada pra mudar. Mande legenda, data_hora, midias ou colaboradores.');
      if (upd.status === 'scheduled') upd.error_message = null;
      const { error } = await db.from('scheduled_posts').update(upd).eq('id', post.id);
      if (error) throw new Error(error.message);
      await db.from('conteudo_items').update(item).eq('scheduled_post_id', post.id);
      return { post_id: post.id, alterado: Object.keys(upd).filter((k) => k !== 'status' && k !== 'error_message') };
    },
  },
  {
    name: 'cancelar_post_agendado',
    title: 'Cancelar post agendado',
    description: 'Tira da fila um post que ainda não publicou (agendado ou com falha) e solta a demanda. Não apaga post que já está no feed. Só master.',
    inputSchema: { type: 'object', properties: { post_id: { type: 'string' } }, required: ['post_id'], additionalProperties: false },
    somenteLeitura: false,
    async executar(args: Args, ctx) {
      exigirMaster(ctx);
      const post = await postDaAgencia(ctx, str(args.post_id, 64));
      await db
        .from('conteudo_items')
        .update({ scheduled_post_id: null, data_programada: null, status: 'agendamento', atualizado_em: new Date().toISOString() })
        .eq('scheduled_post_id', post.id);
      const { error } = await db.from('scheduled_posts').delete().eq('id', post.id);
      if (error) throw new Error(error.message);
      return { cancelado: post.id };
    },
  },
];

/** Post ainda não publicado, de uma conta da agência. */
async function postDaAgencia(ctx: ContextoMcp, id: string) {
  if (!UUID_RE.test(id)) throw new ErroFerramenta('"post_id" precisa ser um id (uuid) válido.');
  const { data: post } = await db.from('scheduled_posts').select('id, status, media_type, instagram_user_id').eq('id', id).maybeSingle();
  if (!post) throw new ErroFerramenta('Post não encontrado.');
  await resolverConta(ctx, post.instagram_user_id); // escopo da agência
  if (post.status === 'published') throw new ErroFerramenta('Esse post já está no feed. A API da Meta não edita nem apaga post publicado: faça pelo app do Instagram.');
  if (post.status === 'publishing') throw new ErroFerramenta('Esse post está sendo publicado agora. Espere terminar.');
  return post;
}
