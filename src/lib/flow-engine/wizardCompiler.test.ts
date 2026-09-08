import { describe, it, expect } from 'vitest';
import { buildFlowFromAdvancedForm, decompileFlow, type QualificationStep } from './wizardCompiler';
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
});
