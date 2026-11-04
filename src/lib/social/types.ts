/**
 * Tipos e contratos universais para publicação em múltiplas redes sociais:
 * Instagram, Threads e TikTok.
 */

export type SocialPlatform = 'instagram' | 'threads' | 'tiktok';

export type SocialMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT';

export type TikTokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY';

export interface TikTokPublishOptions {
  /** Nível de privacidade do post. Padrão: PUBLIC_TO_EVERYONE */
  privacyLevel?: TikTokPrivacyLevel;
  /** Se deve desativar comentários no TikTok */
  disableComment?: boolean;
  /** Se deve desativar duetos */
  disableDuet?: boolean;
  /** Se deve desativar costura (stitch) */
  disableStitch?: boolean;
  /** Adicionar música recomendada automaticamente no modo carrossel de fotos */
  autoAddMusic?: boolean;
  /**
   * Se true, posta diretamente no perfil público (DIRECT_POST).
   * Se false, envia para a caixa de entrada do app TikTok do criador como rascunho (UPLOAD_TO_INBOX).
   * Padrão: true.
   */
  directPost?: boolean;
}

export interface UnifiedPublishPayload {
  mediaType: SocialMediaType;
  /** URL pública da mídia (R2) para imagem única ou vídeo */
  mediaUrl?: string | null;
  /** Lista de URLs públicas para carrossel (2 a 10 no IG, 2 a 20 no Threads, 1 a 35 no TikTok) */
  mediaUrls?: string[] | null;
  /** Legenda ou texto principal do post */
  caption?: string | null;
  /** Título do vídeo/carrossel (utilizado pelo TikTok) */
  title?: string | null;
  /** URL da imagem de capa (thumbnail) para vídeos */
  coverUrl?: string | null;
  /** Opções específicas para publicação no TikTok */
  tiktokOptions?: TikTokPublishOptions;
}

export interface SocialAccountCredentials {
  platform: SocialPlatform;
  /** ID da conta na plataforma (instagram_user_id, threads_user_id ou open_id) */
  accountId: string;
  /** Token de acesso OAuth válido */
  accessToken: string;
  /** Handle/usuário (@) */
  username?: string | null;
}

export interface PlatformPublishResult {
  platform: SocialPlatform;
  status: 'published' | 'processing' | 'failed';
  externalId?: string | null;
  permalink?: string | null;
  error?: string | null;
  warnings?: string[];
}

export interface ISocialProvider {
  readonly platform: SocialPlatform;
  publish(
    credentials: SocialAccountCredentials,
    payload: UnifiedPublishPayload
  ): Promise<PlatformPublishResult>;
}
