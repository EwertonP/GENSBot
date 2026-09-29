/**
 * Publicação de conteúdo no Instagram (posts, reels, stories) via Graph API.
 * Fluxo em 2 passos exigido pela Meta: cria um container de mídia, aguarda
 * ele ficar pronto (vídeo precisa de processamento) e então publica.
 * Reaproveitado tanto pela publicação imediata (api/instagram/publish)
 * quanto pelo worker de agendamento (api/cron/publish-scheduled).
 */

const GRAPH_BASE = 'https://graph.instagram.com/v25.0';

export type PublishMediaType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';

export interface UserTag {
  username: string;
}

interface CreateContainerParams {
  instagramUserId: string;
  accessToken: string;
  mediaType: PublishMediaType;
  mediaUrl: string;
  caption?: string | null;
  collaborators?: string[] | null;
  userTags?: UserTag[] | null;
  locationId?: string | null;
  coverUrl?: string | null;
  audioName?: string | null;
  /** Recebe avisos não fatais (ex.: localização descartada) para o chamador registrar. */
  avisos?: string[];
}

interface PublishParams extends CreateContainerParams {
  /** Só usado quando mediaType === 'CAROUSEL' — 2 a 10 URLs, na ordem de exibição. */
  mediaUrls?: string[] | null;
}

/** A Meta só aceita até 3 @usernames em `collaborators` (feed, Reels e carrossel). */
export const MAX_COLABORADORES = 3;

/** subcode da Meta para "user(s) cannot be accessed": perfil privado ou @ inválido. */
const SUBCODE_COLABORADOR_INVALIDO = 2207018;

export const AVISO_LOCALIZACAO_DESCARTADA = 'A Meta recusou a localização escolhida; o post foi publicado sem ela.';

/** Erro da Graph API com os campos que a Meta devolve. `message` já vem em português quando dá. */
export class MetaApiError extends Error {
  code?: number;
  subcode?: number;
  /** Mensagem original da Meta, sem tradução (usada para decidir fallbacks). */
  rawMessage: string;
  colaboradoresInvalidos: string[];

  constructor(
    message: string,
    info: { rawMessage: string; code?: number; subcode?: number; colaboradoresInvalidos?: string[] }
  ) {
    super(message);
    this.name = 'MetaApiError';
    this.rawMessage = info.rawMessage;
    this.code = info.code;
    this.subcode = info.subcode;
    this.colaboradoresInvalidos = info.colaboradoresInvalidos || [];
  }

  get ehColaboradorInvalido() {
    return this.subcode === SUBCODE_COLABORADOR_INVALIDO || this.colaboradoresInvalidos.length > 0;
  }

  get ehLocalizacaoInvalida() {
    return !this.ehColaboradorInvalido && /location/i.test(this.rawMessage);
  }
}

/** "The following user(s) cannot be accessed: a, b" -> ['a', 'b'] */
export function extrairColaboradoresInvalidos(userMessage?: string | null): string[] {
  if (!userMessage) return [];
  const depois = userMessage.split(':').slice(1).join(':');
  return depois
    .split(',')
    .map((n) => n.trim().replace(/^@/, '').replace(/[.\s]+$/, ''))
    .filter(Boolean);
}

export function mensagemColaboradoresInvalidos(nomes: string[]): string {
  const lista = nomes.length > 0 ? nomes.map((n) => `@${n}`).join(', ') : 'um dos colaboradores';
  return `A Meta recusou ${nomes.length > 1 ? 'os colaboradores' : 'o colaborador'} ${lista}: o perfil é privado ou o @ está errado. Só perfis públicos podem ser colaboradores. Remova ${nomes.length > 1 ? 'esses @' : 'esse @'} e tente de novo.`;
}

async function graphFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    const erro = data.error || {};
    const raw: string = erro.message || `Erro na Graph API (${res.status}).`;
    const invalidos =
      erro.error_subcode === SUBCODE_COLABORADOR_INVALIDO ? extrairColaboradoresInvalidos(erro.error_user_msg) : [];
    const amigavel = erro.error_subcode === SUBCODE_COLABORADOR_INVALIDO ? mensagemColaboradoresInvalidos(invalidos) : raw;
    throw new MetaApiError(amigavel, {
      rawMessage: raw,
      code: erro.code,
      subcode: erro.error_subcode,
      colaboradoresInvalidos: invalidos,
    });
  }
  return data;
}

/**
 * Cria um container de imagem só para a Meta validar os colaboradores (não publica nada;
 * a Meta descarta o container sozinha em 24h). Se a checagem em si falhar por outro motivo
 * (imagem, rede, limite), não bloqueia o usuário: devolve `verificado: false`.
 */
export async function validarColaboradores({
  instagramUserId,
  accessToken,
  collaborators,
  sampleImageUrl,
}: {
  instagramUserId: string;
  accessToken: string;
  collaborators: string[];
  sampleImageUrl: string;
}): Promise<{ ok: true; verificado: boolean } | { ok: false; invalidos: string[]; mensagem: string }> {
  const params = new URLSearchParams({
    access_token: accessToken,
    image_url: sampleImageUrl,
    collaborators: JSON.stringify(collaborators.slice(0, MAX_COLABORADORES)),
  });
  try {
    await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return { ok: true, verificado: true };
  } catch (err) {
    if (err instanceof MetaApiError && err.ehColaboradorInvalido) {
      return { ok: false, invalidos: err.colaboradoresInvalidos, mensagem: err.message };
    }
    console.warn('Checagem de colaboradores não conclusiva:', err instanceof Error ? err.message : err);
    return { ok: true, verificado: false };
  }
}

export async function createMediaContainer({
  instagramUserId,
  accessToken,
  mediaType,
  mediaUrl,
  caption,
  collaborators,
  userTags,
  locationId,
  coverUrl,
  audioName,
  avisos,
}: CreateContainerParams): Promise<string> {
  const params = new URLSearchParams({ access_token: accessToken });
  if (caption) params.set('caption', caption);
  // Colaboradores só fazem sentido em Post/Reels/Carrossel — em Story a
  // marcação é só user_tags (a Graph API aceita até 5 colaboradores).
  if (collaborators && collaborators.length > 0 && mediaType !== 'STORIES') {
    params.set('collaborators', JSON.stringify(collaborators.slice(0, MAX_COLABORADORES)));
  }
  if (userTags && userTags.length > 0) {
    params.set('user_tags', JSON.stringify(userTags));
  }
  if (locationId) {
    params.set('location_id', locationId);
  }

  if (mediaType === 'STORIES') {
    params.set('media_type', 'STORIES');
    if (mediaUrl.match(/\.(mp4|mov)(\?|$)/i)) {
      params.set('video_url', mediaUrl);
    } else {
      params.set('image_url', mediaUrl);
    }
  } else if (mediaType === 'REELS') {
    params.set('media_type', 'REELS');
    params.set('video_url', mediaUrl);
    if (coverUrl) params.set('cover_url', coverUrl);
    if (audioName) params.set('audio_name', audioName);
  } else if (mediaType === 'VIDEO') {
    params.set('media_type', 'REELS'); // feed de vídeo é publicado como REELS na API atual
    params.set('video_url', mediaUrl);
    if (coverUrl) params.set('cover_url', coverUrl);
    if (audioName) params.set('audio_name', audioName);
  } else {
    params.set('image_url', mediaUrl);
  }

  try {
    const data = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    return data.id as string;
  } catch (err: any) {
    // Se a Meta rejeitar o location_id (ex: id que não é uma página de local), publica sem ele
    // e registra o aviso: o post não pode ficar preso por causa de um enfeite.
    if (locationId && err instanceof MetaApiError && err.ehLocalizacaoInvalida) {
      console.warn('Meta Graph API rejeitou location_id, tentando sem localização:', err.rawMessage);
      avisos?.push(AVISO_LOCALIZACAO_DESCARTADA);
      params.delete('location_id');
      const fallbackData = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      return fallbackData.id as string;
    }
    throw err;
  }
}

/**
 * Carrossel: cada item vira um container filho (`is_carousel_item:true`,
 * sem caption próprio — a legenda é só do container pai), depois um
 * container pai `media_type:CAROUSEL` referenciando os filhos. Reels não
 * pode entrar em carrossel (limitação da própria Graph API), por isso
 * cada item aqui é sempre IMAGE ou VIDEO de feed.
 */
export async function createCarouselContainer({
  instagramUserId,
  accessToken,
  mediaUrls,
  caption,
  collaborators,
  userTags,
  locationId,
  avisos,
}: {
  instagramUserId: string;
  accessToken: string;
  mediaUrls: string[];
  caption?: string | null;
  collaborators?: string[] | null;
  userTags?: UserTag[] | null;
  locationId?: string | null;
  avisos?: string[];
}): Promise<string> {
  if (mediaUrls.length < 2 || mediaUrls.length > 10) {
    throw new Error('Carrossel precisa de 2 a 10 itens de mídia.');
  }

  const childResults = await Promise.all(
    mediaUrls.map(async (url) => {
      const isVideo = Boolean(url.match(/\.(mp4|mov)(\?|$)/i));
      const params = new URLSearchParams({ access_token: accessToken, is_carousel_item: 'true' });
      if (isVideo) {
        params.set('media_type', 'VIDEO');
        params.set('video_url', url);
      } else {
        params.set('image_url', url);
      }
      const data = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      return { id: data.id as string, isVideo };
    })
  );

  // Vídeos dentro de carrossel precisam estar FINISHED pela Meta antes de criar o container pai
  const videoChildren = childResults.filter((c) => c.isVideo);
  if (videoChildren.length > 0) {
    await Promise.all(videoChildren.map((vc) => waitForContainerReady(vc.id, accessToken)));
  }

  const childIds = childResults.map((c) => c.id);

  const parentParams = new URLSearchParams({
    access_token: accessToken,
    media_type: 'CAROUSEL',
    children: childIds.join(','),
  });
  if (caption) parentParams.set('caption', caption);
  if (collaborators && collaborators.length > 0) {
    parentParams.set('collaborators', JSON.stringify(collaborators.slice(0, MAX_COLABORADORES)));
  }
  if (userTags && userTags.length > 0) {
    parentParams.set('user_tags', JSON.stringify(userTags));
  }
  if (locationId) {
    parentParams.set('location_id', locationId);
  }

  try {
    const parentData = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: parentParams.toString(),
    });
    return parentData.id as string;
  } catch (err: any) {
    if (locationId && err instanceof MetaApiError && err.ehLocalizacaoInvalida) {
      console.warn('Meta Graph API rejeitou location_id no carrossel, tentando sem localização:', err.rawMessage);
      avisos?.push(AVISO_LOCALIZACAO_DESCARTADA);
      parentParams.delete('location_id');
      const fallbackData = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: parentParams.toString(),
      });
      return fallbackData.id as string;
    }
    throw err;
  }
}

/**
 * Vídeo/reels/story precisam de processamento assíncrono pela Meta antes
 * de poderem ser publicados — faz polling do status_code até FINISHED
 * (ou ERROR/EXPIRED), com timeout pra não travar o worker indefinidamente.
 */
export async function waitForContainerReady(
  creationId: string,
  accessToken: string,
  { timeoutMs = 120_000, intervalMs = 3_000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  // Checar o status imediatamente após criar o container (sem nenhuma espera)
  // bate numa corrida documentada da própria Meta: o ID do container ainda não
  // propagou pros servidores que respondem esse GET, e ela devolve "Media ID
  // is not available" mesmo o container tendo sido criado com sucesso — não é
  // um erro de processamento de verdade. Esperar um ciclo antes da primeira
  // checagem evita isso.
  await new Promise((resolve) => setTimeout(resolve, intervalMs));

  while (Date.now() < deadline) {
    const data = await graphFetch(
      `${GRAPH_BASE}/${creationId}?fields=status_code&access_token=${accessToken}`
    );

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Processamento da mídia falhou (status: ${data.status_code}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Tempo esgotado aguardando o processamento da mídia pela Meta.');
}

export async function publishContainer(
  instagramUserId: string,
  accessToken: string,
  creationId: string
): Promise<string> {
  const params = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
  const data = await graphFetch(`${GRAPH_BASE}/${instagramUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return data.id as string;
}

export async function publishPost(
  params: PublishParams
): Promise<{ igMediaId: string; avisos: string[]; localizacaoDescartada: boolean }> {
  const avisos: string[] = [];
  const resultado = (igMediaId: string) => ({
    igMediaId,
    avisos,
    localizacaoDescartada: avisos.includes(AVISO_LOCALIZACAO_DESCARTADA),
  });
  if (params.mediaType === 'CAROUSEL') {
    if (!params.mediaUrls || params.mediaUrls.length < 2) {
      throw new Error('Carrossel precisa de ao menos 2 itens de mídia.');
    }
    const creationId = await createCarouselContainer({
      instagramUserId: params.instagramUserId,
      accessToken: params.accessToken,
      mediaUrls: params.mediaUrls,
      caption: params.caption,
      collaborators: params.collaborators,
      userTags: params.userTags,
      locationId: params.locationId,
      avisos,
    });
    // O container pai do carrossel também passa por processamento antes
    // de poder ser publicado, mesmo quando todos os itens são imagem.
    await waitForContainerReady(creationId, params.accessToken);
    const igMediaId = await publishContainer(params.instagramUserId, params.accessToken, creationId);
    return resultado(igMediaId);
  }

  const creationId = await createMediaContainer({ ...params, avisos });

  // Imagem de feed não passa pelo processamento assíncrono de vídeo (sem
  // status_code pra dar polling), mas o ID do container ainda leva um
  // instante pra propagar nos servidores da Meta — publicar na sequência,
  // sem nenhuma espera, bate na mesma corrida do "Media ID is not
  // available" que afeta vídeo, só que aqui não tem status pra aguardar.
  if (params.mediaType === 'IMAGE') {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  } else {
    await waitForContainerReady(creationId, params.accessToken);
  }

  const igMediaId = await publishContainer(params.instagramUserId, params.accessToken, creationId);
  return resultado(igMediaId);
}

/** Mensagem de erro se a lista passa do limite da Meta; null se está ok. */
export function erroLimiteColaboradores(colaboradores: unknown): string | null {
  if (Array.isArray(colaboradores) && colaboradores.length > MAX_COLABORADORES) {
    return `A Meta aceita no máximo ${MAX_COLABORADORES} colaboradores por publicação (você marcou ${colaboradores.length}).`;
  }
  return null;
}
