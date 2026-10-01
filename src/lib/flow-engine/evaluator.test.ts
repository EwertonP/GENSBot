import { describe, it, expect } from 'vitest';
import {
  matchesKeywords,
  evaluateTriggerNode,
  personalizeText,
  deriveAutomationTag,
  evaluateConditionNode,
  applyActionNode,
  applyWaitForReplyCapture,
  validateEmail,
  normalizePhone,
  stepCaptureLead,
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

  it('saveReplyToField com nome fora de email/phone/name vira chave em flow_state, não coluna solta', () => {
    const config = { saveReplyToField: 'regiao' };
    expect(applyWaitForReplyCapture(config, '  Recife  ', null)).toEqual({ flow_state: { regiao: 'Recife' } });
  });
});

describe('validateEmail', () => {
  it('aceita e normaliza e-mail válido', () => {
    expect(validateEmail('  Fulano.Silva@Gmail.com ')).toBe('fulano.silva@gmail.com');
  });
  it('recusa texto que não é e-mail', () => {
    expect(validateEmail('não')).toBeNull();
    expect(validateEmail('fulano@gmail')).toBeNull();
    expect(validateEmail('fulano gmail.com')).toBeNull();
    expect(validateEmail('fulano@gmail.c')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it.each([
    ['(81) 99999-8888', '+5581999998888'],
    ['81999998888', '+5581999998888'],
    ['081999998888', '+5581999998888'],
    ['+55 81 9 9999 8888', '+5581999998888'],
    ['5581999998888', '+5581999998888'],
    ['(81) 3333-4444', '+558133334444'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
  it('aceita número estrangeiro com +', () => {
    expect(normalizePhone('+351 912 345 678')).toBe('+351912345678');
  });
  it('recusa o que não é telefone', () => {
    expect(normalizePhone('quero o raio-x')).toBeNull();
    expect(normalizePhone('99998888')).toBeNull(); // sem DDD
    expect(normalizePhone('81899998888')).toBeNull(); // 11 dígitos sem o 9
    expect(normalizePhone('(00) 99999-8888')).toBeNull(); // DDD inválido
  });
});

describe('stepCaptureLead', () => {
  const config = {
    fields: ['email', 'phone'] as ('email' | 'phone')[],
    askText: { email: 'qual seu e-mail?', phone: 'qual seu WhatsApp?' },
    invalidText: { email: 'e-mail inválido', phone: 'telefone inválido' },
    maxAttempts: 2,
    skipIfKnown: true,
  };

  it('ao entrar, pergunta o primeiro campo', () => {
    const step = stepCaptureLead('n1', config, null, null);
    expect(step).toMatchObject({ kind: 'ask', text: 'qual seu e-mail?', state: { field: 'email', attempts: 0 } });
  });

  it('pula o campo que o contato já tem', () => {
    const step = stepCaptureLead('n1', config, { email: 'ja@tem.com' }, null);
    expect(step).toMatchObject({ kind: 'ask', text: 'qual seu WhatsApp?', state: { field: 'phone' } });
  });

  it('segue direto pelo done quando já tem tudo', () => {
    const step = stepCaptureLead('n1', config, { email: 'ja@tem.com', phone: '+5581999998888' }, null);
    expect(step).toEqual({ kind: 'done', collected: [], mutation: {} });
  });

  it('e-mail válido grava e pergunta o telefone', () => {
    const entry = stepCaptureLead('n1', config, null, null);
    if (entry.kind !== 'ask') throw new Error('esperava ask');
    const step = stepCaptureLead('n1', config, null, entry.state, 'Fulano@Gmail.com');
    expect(step).toMatchObject({ kind: 'ask', text: 'qual seu WhatsApp?', mutation: { email: 'fulano@gmail.com' }, state: { field: 'phone', collected: ['email'] } });
  });

  it('resposta inválida reenvia o aviso e conta a tentativa', () => {
    const state = { node_id: 'n1', field: 'email' as const, attempts: 0, collected: [] };
    const step = stepCaptureLead('n1', config, null, state, 'não tenho');
    expect(step).toMatchObject({ kind: 'ask', text: 'e-mail inválido', state: { field: 'email', attempts: 1 } });
  });

  it('esgotou as tentativas: segue pelo failed', () => {
    const state = { node_id: 'n1', field: 'email' as const, attempts: 1, collected: [] };
    expect(stepCaptureLead('n1', config, null, state, 'não tenho').kind).toBe('failed');
  });

  it('último campo válido: done com tudo que foi coletado', () => {
    const state = { node_id: 'n1', field: 'phone' as const, attempts: 0, collected: ['email' as const] };
    const step = stepCaptureLead('n1', config, { email: 'fulano@gmail.com' }, state, '81 99999-8888');
    expect(step).toEqual({ kind: 'done', collected: ['email', 'phone'], mutation: { phone: '+5581999998888' } });
  });

  it('com skipIfKnown desligado, pergunta mesmo já tendo o dado', () => {
    const step = stepCaptureLead('n1', { ...config, skipIfKnown: false }, { email: 'ja@tem.com' }, null);
    expect(step).toMatchObject({ kind: 'ask', text: 'qual seu e-mail?' });
  });

  it('estado de outro bloco é ignorado (começa do zero)', () => {
    const state = { node_id: 'outro', field: 'phone' as const, attempts: 1, collected: ['email' as const] };
    expect(stepCaptureLead('n1', config, null, state)).toMatchObject({ kind: 'ask', text: 'qual seu e-mail?' });
  });
});
