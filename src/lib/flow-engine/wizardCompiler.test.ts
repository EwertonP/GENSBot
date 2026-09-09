import { describe, it, expect } from 'vitest';
import { buildFlowFromAdvancedForm, decompileFlow, type QualificationStep, type WizardCondition, type WizardTail } from './wizardCompiler';
import type { Automation } from '@/types/automation';

// O decompilador é o caminho inverso de buildFlowFromAdvancedForm — essencial
// pra editar pelo Formulário Avançado uma automação sem perder o que já existe
// no flow_definition (ver o bug real desta sessão: editar e salvar zerava
// silenciosamente o fluxo inteiro). Testa via ida-e-volta: form -> flow ->
// form, o resultado tem que bater com o que entrou.

const baseForm: Automation = {
  name: 'Teste',
  active: true,
  triggers: ['dm', 'comment'],
  keywords: ['PMPE'],
  match_type: 'contains',
  specific_post_id: null,
  specific_story_id: null,
  public_replies: ['Te chamei no direct!'],
  welcome_dm: 'Oi! Posso te contar mais?',
  quick_reply_button: 'Quero saber mais',
  welcome_dm_timeout_minutes: 1440,
  welcome_dm_reminder_text: 'Ainda por aí?',
  link_text: 'Aqui está:',
  link_url: 'https://exemplo.com',
  link_button_label: 'Acessar',
  followups: [
    { id: 'f1', delay_minutes: 60, text: 'Follow-up 1', link_url: null, link_button_label: null },
  ],
};

const baseQuestions: QualificationStep[] = [
  { kind: 'question', text: 'É da área da saúde?', buttons: ['Sim', 'Não'], timeoutMinutes: 720, reminderText: 'Oi de novo!' },
  { kind: 'question', text: 'Qual sua área?', buttons: [], timeoutMinutes: 0, reminderText: '', saveReplyAsTagPrefix: 'area_' },
  { kind: 'message', text: 'Mensagem simples no meio do fluxo.' },
];

describe('decompileFlow', () => {
  it('reconstrói form + perguntas a partir de um flow construído pelo próprio wizard (ida e volta)', () => {
    const flow = buildFlowFromAdvancedForm(baseForm, baseQuestions);
    const result = decompileFlow(flow);

    expect(result.compatible).toBe(true);
    if (!result.compatible) return;

    expect(result.form.triggers).toEqual(baseForm.triggers);
    expect(result.form.keywords).toEqual(baseForm.keywords);
    expect(result.form.match_type).toBe(baseForm.match_type);
    expect(result.form.public_replies).toEqual(baseForm.public_replies);
    expect(result.form.welcome_dm).toBe(baseForm.welcome_dm);
    expect(result.form.quick_reply_button).toBe(baseForm.quick_reply_button);
    expect(result.form.welcome_dm_timeout_minutes).toBe(baseForm.welcome_dm_timeout_minutes);
    expect(result.form.welcome_dm_reminder_text).toBe(baseForm.welcome_dm_reminder_text);
    expect(result.form.link_text).toBe(baseForm.link_text);
    expect(result.form.link_url).toBe(baseForm.link_url);
    expect(result.form.link_button_label).toBe(baseForm.link_button_label);
    expect(result.form.followups).toHaveLength(1);
    expect(result.form.followups[0].text).toBe('Follow-up 1');
    expect(result.form.followups[0].delay_minutes).toBe(60);

    expect(result.questions).toHaveLength(3);
    expect(result.questions[0]).toMatchObject({ kind: 'question', text: 'É da área da saúde?', buttons: ['Sim', 'Não'], timeoutMinutes: 720 });
    expect(result.questions[1]).toMatchObject({ kind: 'question', text: 'Qual sua área?', buttons: [], saveReplyAsTagPrefix: 'area_' });
    expect(result.questions[2]).toEqual({ kind: 'message', text: 'Mensagem simples no meio do fluxo.' });
  });

  it('reconstrói corretamente quando a mensagem inicial não tem botão nem espera', () => {
    const form: Automation = { ...baseForm, quick_reply_button: null, welcome_dm_timeout_minutes: null, welcome_dm_reminder_text: null };
    const flow = buildFlowFromAdvancedForm(form, []);
    const result = decompileFlow(flow);

    expect(result.compatible).toBe(true);
    if (!result.compatible) return;
    expect(result.form.quick_reply_button).toBeNull();
    expect(result.form.welcome_dm_timeout_minutes).toBeNull();
    expect(result.questions).toHaveLength(0);
  });

  it('reconstrói a espera "sem prazo, sem lembrete" da mensagem inicial (só botão, sem timeout)', () => {
    const form: Automation = { ...baseForm, welcome_dm_timeout_minutes: null, welcome_dm_reminder_text: null };
    const flow = buildFlowFromAdvancedForm(form, []);
    const result = decompileFlow(flow);

    expect(result.compatible).toBe(true);
    if (!result.compatible) return;
    expect(result.form.quick_reply_button).toBe('Quero saber mais');
    expect(result.form.welcome_dm_timeout_minutes).toBeNull();
  });

  it('marca como incompatível um flow sem nó de gatilho', () => {
    const result = decompileFlow({ nodes: [], edges: [] });
    expect(result.compatible).toBe(false);
  });

  it('marca como incompatível um flow com ramificação condicional (nó de condição)', () => {
    const flow = buildFlowFromAdvancedForm(baseForm, []);
    // Insere um nó de condição entre o link e o fim, simulando uma automação
    // construída no Canvas com um ramo que o Formulário Avançado não sabe editar.
    flow.nodes.push({ id: 'branch', type: 'condition', position: { x: 0, y: 0 }, data: { conditionType: 'keyword', keywords: ['x'], match_type: 'contains' } });
    const linkNode = flow.nodes.find(n => n.type === 'sendMessage' && (n.data as any).link_url)!;
    flow.edges.push({ id: 'e-extra', source: linkNode.id, target: 'branch', sourceHandle: null });

    const result = decompileFlow(flow);
    expect(result.compatible).toBe(false);
  });

  // ---------------------------------------------------------------------
  // v1 de bifurcação no formulário guiado (uma condição, em qualquer ponto
  // da lista de perguntas, dividindo o resto do fluxo em dois ramos
  // independentes) — ver PLANO "Suporte a condição no formulário guiado".
  // ---------------------------------------------------------------------

  // timeoutMinutes/reminderText não-zero de propósito: com timeout 0 (aberta,
  // sem espera), o compilador normaliza pro timeout/lembrete padrão — o mesmo
  // comportamento que a pergunta 2 de `baseQuestions` já exercita acima (por
  // isso aquele teste usa toMatchObject, não toEqual, na pergunta normalizada).
  const trueBranch: WizardTail = {
    questions: [{ kind: 'question', text: 'Pergunta só do ramo verdadeiro', buttons: [], timeoutMinutes: 60, reminderText: 'Ainda aí?' }],
    link_text: 'Link do ramo verdadeiro',
    link_url: 'https://exemplo.com/verdadeiro',
    link_button_label: 'Ver oferta A',
    followups: [{ id: 'ft1', delay_minutes: 30, text: 'Follow-up do ramo verdadeiro', link_url: null, link_button_label: null }],
  };

  const falseBranch: WizardTail = {
    questions: [],
    link_text: 'Link do ramo falso',
    link_url: 'https://exemplo.com/falso',
    link_button_label: 'Ver oferta B',
    followups: [],
  };

  const conditionData: WizardCondition['condition'] = { conditionType: 'tag', tag: 'cliente', tagPresence: 'has' };

  /** Compara uma WizardTail reconstruída ignorando `id` de followup (gerado, não preservado). */
  function expectTailToMatch(actual: WizardTail, expected: WizardTail) {
    expect(actual.link_text).toBe(expected.link_text);
    expect(actual.link_url).toBe(expected.link_url);
    expect(actual.link_button_label).toBe(expected.link_button_label);
    expect(actual.questions).toHaveLength(expected.questions.length);
    expected.questions.forEach((q, i) => expect(actual.questions[i]).toMatchObject(q));
    expect(actual.followups).toHaveLength(expected.followups.length);
    expected.followups.forEach((f, i) => expect(actual.followups[i]).toMatchObject({ delay_minutes: f.delay_minutes, text: f.text, link_url: f.link_url, link_button_label: f.link_button_label }));
  }

  it('round-trip: condição logo após a mensagem inicial (splitAfterIndex 0)', () => {
    const wizardCondition: WizardCondition = { splitAfterIndex: 0, condition: conditionData, trueBranch, falseBranch };
    const flow = buildFlowFromAdvancedForm(baseForm, [], wizardCondition);
    const result = decompileFlow(flow);

    expect(result.compatible).toBe(true);
    if (!result.compatible) return;
    expect(result.questions).toHaveLength(0);
    expect(result.condition).not.toBeNull();
    expect(result.condition?.splitAfterIndex).toBe(0);
    expect(result.condition?.condition).toEqual(conditionData);
    if (!result.condition) return;
    expectTailToMatch(result.condition.trueBranch, trueBranch);
    expectTailToMatch(result.condition.falseBranch, falseBranch);
  });

  it('round-trip: condição antes da última pergunta (perguntas antes do split preservadas)', () => {
    const wizardCondition: WizardCondition = { splitAfterIndex: baseQuestions.length, condition: conditionData, trueBranch, falseBranch };
    const flow = buildFlowFromAdvancedForm(baseForm, baseQuestions, wizardCondition);
    const result = decompileFlow(flow);

    expect(result.compatible).toBe(true);
    if (!result.compatible) return;
    expect(result.questions).toHaveLength(baseQuestions.length);
    baseQuestions.forEach((q, i) => expect(result.questions[i]).toMatchObject(q.kind === 'question' ? { kind: q.kind, text: q.text, buttons: q.buttons } : q));
    expect(result.condition?.splitAfterIndex).toBe(baseQuestions.length);
    if (!result.condition) return;
    expectTailToMatch(result.condition.trueBranch, trueBranch);
    expectTailToMatch(result.condition.falseBranch, falseBranch);
  });

  it('marca como incompatível uma condição aninhada dentro de um ramo', () => {
    const wizardCondition: WizardCondition = { splitAfterIndex: 0, condition: conditionData, trueBranch, falseBranch };
    const flow = buildFlowFromAdvancedForm(baseForm, [], wizardCondition);

    // Insere uma segunda condição dentro do ramo verdadeiro, entre a
    // pergunta e o link — simula um Canvas com condição aninhada.
    const trueBranchLinkNode = flow.nodes.find((n) => n.type === 'sendMessage' && (n.data as any).link_url === trueBranch.link_url)!;
    const incomingToLink = flow.edges.find((e) => e.target === trueBranchLinkNode.id)!;
    flow.nodes.push({ id: 'nested-branch', type: 'condition', position: { x: 0, y: 0 }, data: conditionData });
    incomingToLink.target = 'nested-branch';
    flow.edges.push({ id: 'e-nested-true', source: 'nested-branch', target: trueBranchLinkNode.id, sourceHandle: 'true' });
    flow.edges.push({ id: 'e-nested-false', source: 'nested-branch', target: trueBranchLinkNode.id, sourceHandle: 'false' });

    const result = decompileFlow(flow);
    expect(result.compatible).toBe(false);
  });

  it('marca como incompatível um nó de condição sem exatamente uma saída "true" e uma "false"', () => {
    const wizardCondition: WizardCondition = { splitAfterIndex: 0, condition: conditionData, trueBranch, falseBranch };
    const flow = buildFlowFromAdvancedForm(baseForm, [], wizardCondition);

    const conditionNode = flow.nodes.find((n) => n.type === 'condition')!;
    // Remove a saída 'false', deixando só a 'true' — estrutura que o
    // Formulário Avançado não sabe representar.
    flow.edges = flow.edges.filter((e) => !(e.source === conditionNode.id && e.sourceHandle === 'false'));

    const result = decompileFlow(flow);
    expect(result.compatible).toBe(false);
  });
});
