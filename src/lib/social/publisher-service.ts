import {
  ISocialProvider,
  PlatformPublishResult,
  SocialAccountCredentials,
  SocialPlatform,
  UnifiedPublishPayload,
} from './types';
import { InstagramProvider } from './providers/instagram-provider';
import { ThreadsProvider } from './providers/threads-provider';
import { TikTokProvider } from './providers/tiktok-provider';

export interface PublishRequestTarget {
  account: SocialAccountCredentials;
}

export interface MultiPlatformPublishResult {
  sucessoGeral: boolean;
  resultados: Record<SocialPlatform, PlatformPublishResult | null>;
  erros: string[];
}

/**
 * Orquestrador central de publicações multi-plataforma.
 * Gerencia os providers de cada rede (Instagram, Threads, TikTok) e executa
 * publicações isoladas ou simultâneas com tratamento de erro independente.
 */
export class PublisherService {
  private providers = new Map<SocialPlatform, ISocialProvider>();

  constructor() {
    this.registerProvider(new InstagramProvider());
    this.registerProvider(new ThreadsProvider());
    this.registerProvider(new TikTokProvider());
  }

  registerProvider(provider: ISocialProvider) {
    this.providers.set(provider.platform, provider);
  }

  getProvider(platform: SocialPlatform): ISocialProvider | undefined {
    return this.providers.get(platform);
  }

  /**
   * Valida as restrições de cada plataforma selecionada antes do disparo.
   */
  validatePayload(
    platforms: SocialPlatform[],
    payload: UnifiedPublishPayload
  ): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const p of platforms) {
      if (p === 'threads') {
        if (payload.caption && payload.caption.length > 500) {
          warnings.push('Threads: texto excede 500 caracteres e será truncado.');
        }
        if (payload.mediaType === 'CAROUSEL') {
          const total = payload.mediaUrls?.length || 0;
          if (total < 2 || total > 20) {
            errors.push(`Threads: carrossel exige entre 2 e 20 itens (recebido: ${total}).`);
          }
        }
      }

      if (p === 'instagram') {
        if (payload.mediaType === 'CAROUSEL') {
          const total = payload.mediaUrls?.length || 0;
          if (total < 2 || total > 10) {
            errors.push(`Instagram: carrossel exige entre 2 e 10 itens (recebido: ${total}).`);
          }
        }
        if (payload.mediaType === 'TEXT') {
          errors.push('Instagram: não aceita post somente de texto; requer imagem ou vídeo.');
        }
      }

      if (p === 'tiktok') {
        if (payload.mediaType === 'TEXT') {
          errors.push('TikTok: requer vídeo (Reels/TikTok) ou fotos (Photo Mode).');
        }
        if (payload.mediaType === 'CAROUSEL') {
          const total = payload.mediaUrls?.length || 0;
          if (total > 35) {
            warnings.push('TikTok: carrossel suporta no máximo 35 fotos; excesso será descartado.');
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Publica o conteúdo em todas as redes selecionadas concorrentemente.
   * A falha de uma rede não impede nem interrompe a publicação nas demais.
   */
  async publishToAll(
    targets: PublishRequestTarget[],
    payload: UnifiedPublishPayload
  ): Promise<MultiPlatformPublishResult> {
    const resultados: Record<SocialPlatform, PlatformPublishResult | null> = {
      instagram: null,
      threads: null,
      tiktok: null,
    };
    const erros: string[] = [];

    const tasks = targets.map(async ({ account }) => {
      const provider = this.getProvider(account.platform);
      if (!provider) {
        const msg = `Provedor para a plataforma '${account.platform}' não está registrado.`;
        erros.push(msg);
        resultados[account.platform] = {
          platform: account.platform,
          status: 'failed',
          error: msg,
        };
        return;
      }

      try {
        const res = await provider.publish(account, payload);
        resultados[account.platform] = res;
        if (res.status === 'failed' && res.error) {
          erros.push(`[${account.platform}] ${res.error}`);
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro inesperado na publicação.';
        erros.push(`[${account.platform}] ${errorMsg}`);
        resultados[account.platform] = {
          platform: account.platform,
          status: 'failed',
          error: errorMsg,
        };
      }
    });

    await Promise.allSettled(tasks);

    // Sucesso geral se ao menos uma rede publicou e nenhuma rede marcada falhou catastroficamente
    const algumSucesso = Object.values(resultados).some((r) => r?.status === 'published' || r?.status === 'processing');

    return {
      sucessoGeral: algumSucesso && erros.length === 0,
      resultados,
      erros,
    };
  }
}

export const publisherService = new PublisherService();
