import { SupabaseClient } from '@supabase/supabase-js';

export interface PublishAutomationConfig {
  enabled: boolean;
  name?: string;
  keywords: string[];
  match_type?: 'contains' | 'exact' | 'any';
  welcome_dm: string;
  link_button_label?: string | null;
  link_url?: string | null;
  public_replies?: string[];
}

export interface DetectedTrigger {
  detected: boolean;
  keyword?: string;
  suggestedKeywords: string[];
  suggestedDm: string;
  suggestedPublicReply: string;
}

/**
 * Analisa a legenda da postagem procurando chamadas para ação típicas do Instagram
 * como "Comente QUERO", "Digite LINK", "Envie PREÇO", etc.
 */
export function detectarGatilhosDaLegenda(caption: string): DetectedTrigger {
  if (!caption || typeof caption !== 'string') {
    return {
      detected: false,
      suggestedKeywords: ['QUERO'],
      suggestedDm: 'Olá! Vi que você comentou no nosso post. Aqui está o acesso exclusivo ao que prometemos:',
      suggestedPublicReply: 'Te enviei as informações completas no seu Direct! 🚀 Confere lá.',
    };
  }

  // Regex para padrões de CTA em português:
  // "comente [PALAVRA]", "comente 'PALAVRA'", "digite [PALAVRA]", "envie [PALAVRA]", "responda [PALAVRA]"
  const ctaRegex = /(?:comente|digite|envie|mande|escreva|responda)\s+(?:a\s+palavra\s+)?["'“‘]?([A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{2,20})["'”’]?/i;
  const match = caption.match(ctaRegex);

  if (match && match[1]) {
    const rawWord = match[1].trim().toUpperCase();
    // Ignora palavras comuns que não são gatilhos reais (artigos/preposições)
    const stopWords = ['AQUI', 'ABAIXO', 'NOS', 'NOSSO', 'POST', 'FEED', 'DIRECT', 'SEU', 'SUA', 'PARA', 'COM'];
    if (!stopWords.includes(rawWord)) {
      return {
        detected: true,
        keyword: rawWord,
        suggestedKeywords: [rawWord],
        suggestedDm: `Olá! Vi que você comentou "${rawWord}" na nossa publicação. Aqui está o material exclusivo que você pediu:`,
        suggestedPublicReply: 'Acabei de te enviar no Direct! 🚀 Confere lá.',
      };
    }
  }

  return {
    detected: false,
    suggestedKeywords: ['QUERO'],
    suggestedDm: 'Olá! Vi que você comentou no nosso post. Aqui está o acesso exclusivo ao que prometemos:',
    suggestedPublicReply: 'Te enviei as informações no seu Direct! 🚀 Confere lá.',
  };
}

/**
 * Cria um registro em automations vinculado ao ig_media_id recém-publicado na Meta.
 */
export async function createAutomationForPublishedPost(
  supabaseClient: SupabaseClient,
  params: {
    userId: string;
    instagramUserId: string;
    igMediaId: string;
    postTitleOrCaption?: string | null;
    config: PublishAutomationConfig;
  }
): Promise<{ id: string } | null> {
  const { userId, instagramUserId, igMediaId, postTitleOrCaption, config } = params;

  if (!config.enabled) return null;

  const rawKeywords = config.keywords && config.keywords.length > 0 ? config.keywords : ['QUERO'];
  const sanitizedKeywords = rawKeywords.map((k) => k.trim()).filter(Boolean);
  if (sanitizedKeywords.length === 0) {
    sanitizedKeywords.push('QUERO');
  }

  const welcomeDm = config.welcome_dm?.trim() || 'Olá! Obrigado pelo seu comentário. Aqui está o que você pediu:';
  const postSnippet = (postTitleOrCaption || 'Post').slice(0, 30).trim();
  const autoName = config.name?.trim() || `Post: ${postSnippet} [${sanitizedKeywords.join(', ')}]`;

  const publicReplies = (config.public_replies || [])
    .map((r) => r.trim())
    .filter(Boolean);

  try {
    const { data, error } = await supabaseClient
      .from('automations')
      .insert({
        user_id: userId,
        instagram_user_id: instagramUserId,
        name: autoName,
        active: true,
        triggers: ['comments'],
        keywords: sanitizedKeywords,
        match_type: config.match_type || 'contains',
        specific_post_id: igMediaId,
        public_replies: publicReplies,
        welcome_dm: welcomeDm,
        link_button_label: config.link_button_label?.trim() || null,
        link_url: config.link_url?.trim() || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[publish-automation] Erro ao cadastrar automação para post publicado:', error);
      return null;
    }

    return { id: data.id };
  } catch (err) {
    console.error('[publish-automation] Exceção ao cadastrar automação para post publicado:', err);
    return null;
  }
}
