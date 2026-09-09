import { describe, it, expect } from 'vitest';
import {
  matchesKeywords,
  evaluateTriggerNode,
  personalizeText,
  deriveAutomationTag,
  evaluateConditionNode,
  applyActionNode,
  applyWaitForReplyCapture,
} from './evaluator';

// Cobre só as funções puras do motor de fluxo (sem I/O) — a parte que já causou
// regressões reais nesta sessão (confirm sem wait, quick-reply sem texto pulando
// perguntas) e que é barata de testar sem precisar de banco/Instagram de verdade.

describe('matchesKeywords', () => {
  it('any tipo sempre bate, mesmo sem keywords', () => {
    expect(matchesKeywords('qualquer coisa', [], 'any')).toBe(true);
    expect(matchesKeywords('qualquer coisa', ['acne'], 'any')).toBe(true);
  });

  it('exact exige igualdade exata (case-insensitive, ignorando espaços nas pontas)', () => {
    expect(matchesKeywords('Acne', ['acne'], 'exact')).toBe(true);
    expect(matchesKeywords('  acne  ', ['acne'], 'exact')).toBe(true);
    expect(matchesKeywords('tenho acne', ['acne'], 'exact')).toBe(false);
  });

  it('contains bate por substring, case-insensitive', () => {
    expect(matchesKeywords('Tenho ACNE há anos', ['acne'], 'contains')).toBe(true);
    expect(matchesKeywords('manchas no rosto', ['acne', 'manchas'], 'contains')).toBe(true);
    expect(matchesKeywords('botox', ['acne', 'manchas'], 'contains')).toBe(false);
  });

  it('ignora acentos nos dois lados da comparação (texto e keyword)', () => {
    expect(matchesKeywords('Verao chegando', ['verão'], 'contains')).toBe(true);
    expect(matchesKeywords('Verão chegando', ['verao'], 'contains')).toBe(true);
    expect(matchesKeywords('nao vejo a hora do verão', ['não'], 'contains')).toBe(true);
    expect(matchesKeywords('Verao', ['verão'], 'exact')).toBe(true);
  });
});

describe('evaluateTriggerNode', () => {
  const baseConfig = { triggerTypes: ['comment' as const], keywords: ['acne'], match_type: 'contains' as const };

  it('rejeita tipo de gatilho que não bate', () => {
    expect(evaluateTriggerNode(baseConfig, { triggerType: 'dm', text: 'acne' })).toBe(false);
  });

  it('story_mention ignora keywords e sempre bate', () => {
    const config = { triggerTypes: ['story_mention' as const], keywords: ['acne'], match_type: 'contains' as const };
    expect(evaluateTriggerNode(config, { triggerType: 'story_mention', text: 'nada a ver' })).toBe(true);
  });

  it('comment com specific_post_id só bate pro post configurado', () => {
    const config = { ...baseConfig, specific_post_id: 'post123' };
    expect(evaluateTriggerNode(config, { triggerType: 'comment', text: 'acne', mediaId: 'post123' })).toBe(true);
    expect(evaluateTriggerNode(config, { triggerType: 'comment', text: 'acne', mediaId: 'outro_post' })).toBe(false);
  });

  it('valida keywords quando o tipo bate e não é story_mention', () => {
    expect(evaluateTriggerNode(baseConfig, { triggerType: 'comment', text: 'tenho acne' })).toBe(true);
    expect(evaluateTriggerNode(baseConfig, { triggerType: 'comment', text: 'botox' })).toBe(false);
  });
});

describe('personalizeText', () => {
  it('substitui {{primeiro_nome}} pelo primeiro nome do contato', () => {
    expect(personalizeText('Olá, {{primeiro_nome}}!', { name: 'Ewerton Monteiro' })).toBe('Olá, Ewerton!');
  });

  it('é case-insensitive e tolera espaços dentro das chaves', () => {
    expect(personalizeText('Oi {{ PRIMEIRO_NOME }}', { name: 'Lais' })).toBe('Oi Lais');
  });

  it('vira string vazia quando o nome do contato é desconhecido', () => {
    expect(personalizeText('Olá, {{primeiro_nome}}!', null)).toBe('Olá, !');
    expect(personalizeText('Olá, {{primeiro_nome}}!', { name: null })).toBe('Olá, !');
  });

  it('não mexe em texto sem o marcador', () => {
    expect(personalizeText('Mensagem sem marcador', { name: 'Ewerton' })).toBe('Mensagem sem marcador');
  });
});

describe('deriveAutomationTag', () => {
  it('gera a tag em CAIXA ALTA a partir do nome da automação', () => {
    expect(deriveAutomationTag('Acne')).toBe('ACNE');
    expect(deriveAutomationTag('Tratamento Capilar')).toBe('TRATAMENTO CAPILAR');
    expect(deriveAutomationTag('Botox e Preenchimento')).toBe('BOTOX E PREENCHIMENTO');
  });

  it('colapsa espaços duplos e remove das pontas', () => {
    expect(deriveAutomationTag('  Manchas   e  Melasma  ')).toBe('MANCHAS E MELASMA');
  });

  it('retorna null pra nome vazio', () => {
    expect(deriveAutomationTag('   ')).toBeNull();
  });
});

describe('evaluateConditionNode', () => {
  it('condição keyword delega pra matchesKeywords', () => {
    const config = { conditionType: 'keyword' as const, keywords: ['sim'], match_type: 'contains' as const };
    expect(evaluateConditionNode(config, { text: 'sim quero', contact: null })).toBe('true');
    expect(evaluateConditionNode(config, { text: 'não quero', contact: null })).toBe('false');
  });

  it('condição tag respeita has/not_has', () => {
    const hasConfig = { conditionType: 'tag' as const, tag: 'vip', tagPresence: 'has' as const };
    expect(evaluateConditionNode(hasConfig, { text: '', contact: { tags: ['vip'] } })).toBe('true');
    expect(evaluateConditionNode(hasConfig, { text: '', contact: { tags: [] } })).toBe('false');

    const notHasConfig = { conditionType: 'tag' as const, tag: 'vip', tagPresence: 'not_has' as const };
    expect(evaluateConditionNode(notHasConfig, { text: '', contact: { tags: [] } })).toBe('true');
  });

  it('condição contact_field cobre is_empty/not_empty/equals', () => {
    const isEmptyConfig = { conditionType: 'contact_field' as const, field: 'email' as const, operator: 'is_empty' as const };
    expect(evaluateConditionNode(isEmptyConfig, { text: '', contact: { email: null } })).toBe('true');
    expect(evaluateConditionNode(isEmptyConfig, { text: '', contact: { email: 'a@b.com' } })).toBe('false');

    const equalsConfig = { conditionType: 'contact_field' as const, field: 'email' as const, operator: 'equals' as const, value: 'a@b.com' };
    expect(evaluateConditionNode(equalsConfig, { text: '', contact: { email: 'a@b.com' } })).toBe('true');
  });
});

describe('applyActionNode', () => {
  it('add_tag adiciona sem duplicar', () => {
    const config = { actionType: 'add_tag' as const, tag: 'vip' };
    expect(applyActionNode(config, { tags: [] })).toEqual({ tags: ['vip'] });
    expect(applyActionNode(config, { tags: ['vip'] })).toEqual({});
  });

  it('remove_tag remove a tag da lista', () => {
    const config = { actionType: 'remove_tag' as const, tag: 'vip' };
    expect(applyActionNode(config, { tags: ['vip', 'acne'] })).toEqual({ tags: ['acne'] });
  });

  it('set_field seta o valor no campo indicado', () => {
    const config = { actionType: 'set_field' as const, field: 'email' as const, value: 'novo@email.com' };
    expect(applyActionNode(config, null)).toEqual({ email: 'novo@email.com' });
  });
});

describe('applyWaitForReplyCapture', () => {
  it('sem config de captura, não muda nada', () => {
    expect(applyWaitForReplyCapture({}, 'qualquer resposta', null)).toEqual({});
  });

  it('resposta vazia (só espaços) não gera mutação', () => {
    const config = { saveReplyToField: 'email' as const };
    expect(applyWaitForReplyCapture(config, '   ', null)).toEqual({});
  });

  it('saveReplyToField salva o texto (trimado) no campo indicado', () => {
    const config = { saveReplyToField: 'email' as const };
    expect(applyWaitForReplyCapture(config, '  a@b.com  ', null)).toEqual({ email: 'a@b.com' });
  });

  it('saveReplyAsTagPrefix normaliza a resposta numa tag com prefixo (acentos viram separador, não são dobrados)', () => {
    const config = { saveReplyAsTagPrefix: 'motivo_' };
    expect(applyWaitForReplyCapture(config, 'Ja tentei antes!', { tags: [] })).toEqual({ tags: ['motivo_ja_tentei_antes'] });
  });

  it('não duplica a tag se o contato já tiver', () => {
    const config = { saveReplyAsTagPrefix: 'motivo_' };
    expect(applyWaitForReplyCapture(config, 'Ja tentei antes!', { tags: ['motivo_ja_tentei_antes'] })).toEqual({});
  });
});
