import type { TriggerNodeConfig, ConditionNodeConfig, ActionNodeConfig } from '@/types/flow';

/** Movida de src/app/api/webhook/route.ts (era local ali) — usada tanto pelo caminho legado quanto pelo motor de fluxo novo. */
export function matchesKeywords(text: string, keywords: string[], matchType: string): boolean {
  if (matchType === 'any' || keywords.length === 0) return true;

  const normalizedText = text.trim().toLowerCase();

  if (matchType === 'exact') {
    return keywords.some((kw) => normalizedText === kw.trim().toLowerCase());
  }

  if (matchType === 'contains') {
    return keywords.some((kw) => normalizedText.includes(kw.trim().toLowerCase()));
  }

  return false;
}

export interface TriggerEvalContext {
  triggerType: 'dm' | 'story' | 'story_mention' | 'comment';
  text: string;
  mediaId?: string | null;
  storyId?: string | null;
}

/** Generaliza a checagem de trigger+specific_post/story_id+keywords que hoje é feita inline no loop de automações do webhook. */
export function evaluateTriggerNode(config: TriggerNodeConfig, ctx: TriggerEvalContext): boolean {
  if (!config.triggerTypes.includes(ctx.triggerType)) return false;
  if (ctx.triggerType === 'comment' && config.specific_post_id && config.specific_post_id !== ctx.mediaId) return false;
  if (ctx.triggerType === 'story' && config.specific_story_id && config.specific_story_id !== ctx.storyId) return false;
  // story_mention não valida palavra-chave — mesmo comportamento do caminho legado (route.ts, isStoryMention).
  if (ctx.triggerType === 'story_mention') return true;
  return matchesKeywords(ctx.text, config.keywords, config.match_type);
}

export interface ContactSnapshot {
  tags?: string[] | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  username?: string | null;
}

export function evaluateConditionNode(
  config: ConditionNodeConfig,
  ctx: { text: string; contact: ContactSnapshot | null },
): 'true' | 'false' {
  switch (config.conditionType) {
    case 'keyword':
      return matchesKeywords(ctx.text, config.keywords || [], config.match_type || 'contains') ? 'true' : 'false';
    case 'tag': {
      const has = !!config.tag && (ctx.contact?.tags || []).includes(config.tag);
      return (config.tagPresence === 'not_has' ? !has : has) ? 'true' : 'false';
    }
    case 'contact_field': {
      const value = config.field ? ((ctx.contact?.[config.field] as string | null | undefined) ?? '') : '';
      if (config.operator === 'is_empty') return !value ? 'true' : 'false';
      if (config.operator === 'not_empty') return value ? 'true' : 'false';
      if (config.operator === 'equals') return value === config.value ? 'true' : 'false';
      return 'false';
    }
    default:
      return 'false';
  }
}

/** Calcula as mutações a aplicar em `contacts` para um nó `action`. Não escreve no banco — quem chama decide como persistir. */
export function applyActionNode(
  config: ActionNodeConfig,
  contact: ContactSnapshot | null,
): Partial<Record<'tags' | 'email' | 'phone' | 'name', unknown>> {
  const currentTags = contact?.tags || [];
  switch (config.actionType) {
    case 'add_tag':
      if (!config.tag || currentTags.includes(config.tag)) return {};
      return { tags: [...currentTags, config.tag] };
    case 'remove_tag':
      if (!config.tag) return {};
      return { tags: currentTags.filter((t) => t !== config.tag) };
    case 'set_field':
      if (!config.field) return {};
      return { [config.field]: config.value ?? null };
    default:
      return {};
  }
}
