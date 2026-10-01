import { describe, it, expect, vi } from 'vitest';
import { buildFlowFromAdvancedForm, decompileFlow, type QualificationStep } from '../flow-engine/wizardCompiler';
import type { Automation } from '../../types/automation';

// Mesmo Supabase falso e genérico de ferramentas-c5.test.ts, com `.update()`/`.insert()`
// a mais: `update` marca uma mutação pendente que `then()` aplica nas linhas (de
// verdade, por referência — mutando `tabelas[nome]`) antes de resolver; `insert`
// empurra a linha nova direto na tabela.
const tabelas: Record<string, Record<string, unknown>[]> = {};

function filtrar(rows: Record<string, unknown>[], coluna: string, op: 'eq' | 'in', valor: unknown) {
  return rows.filter((r) => (op === 'eq' ? r[coluna] === valor : (valor as unknown[]).includes(r[coluna])));
}

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  let pendingUpdate: Record<string, unknown> | null = null;
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      rows = filtrar(rows, col, 'eq', val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = filtrar(rows, col, 'in', val);
      return chain;
    },
    update: (values: Record<string, unknown>) => {
      pendingUpdate = values;
      return chain;
    },
    insert: async (values: Record<string, unknown>) => {
      (tabelas[nome] ||= []).push(values);
      return { error: null };
    },
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
      if (pendingUpdate) for (const r of rows) Object.assign(r, pendingUpdate);
      resolve({ data: rows, error: null });
    },
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

import { FERRAMENTAS_C6 } from './ferramentas-c6';

const editar = FERRAMENTAS_C6[0];
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };
const ctxMembro = { tokenId: 't', clientId: 'c', membroId: 'm2', agenciaId: 'ag1', papel: 'membro' as const, nome: 'Membro' };

const AUTO_ID = 'a1111111-1111-1111-1111-111111111111';

const baseForm: Automation = {
  name: 'PMPE - Raio-X',
  active: false,
  triggers: ['comment', 'dm'],
  keywords: ['PMPE'],
  match_type: 'contains',
  specific_post_id: null,
  specific_story_id: null,
  public_replies: ['Te chamei no direct!'],
  welcome_dm: 'Oi! Quer saber mais?',
  quick_reply_button: 'Quero saber',
  link_text: 'Aqui está:',
  link_url: 'https://exemplo.com',
  link_button_label: 'Acessar',
  followups: [],
};

const umaPergunta: QualificationStep[] = [{ kind: 'question', text: 'Qual seu cargo?', buttons: ['Soldado', 'Oficial'], timeoutMinutes: 720, reminderText: 'Oi de novo!' }];

function seed(overrides: Record<string, unknown> = {}, perguntas = umaPergunta) {
  tabelas.membros = [
    { id: 'm1', agencia_id: 'ag1' },
    { id: 'm2', agencia_id: 'ag1' },
  ];
  tabelas.automation_versions = [];
  tabelas.automations = [
    {
      id: AUTO_ID,
      name: baseForm.name,
      active: false,
      user_id: 'm1',
      instagram_user_id: 'ig123',
      flow_version: 2,
      flow_definition: buildFlowFromAdvancedForm(baseForm, perguntas),
      ...overrides,
    },
  ];
}

describe('editar_automacao_parcial', () => {
  it('adicionar_captura insere o bloco sem mexer no resto — não exige humanizer (textos padrão)', async () => {
    seed();
    const r = (await editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'adicionar_captura', campos: ['email', 'phone'] }] }, ctxMaster)) as {
      versao: number;
      total_perguntas: number;
      operacoes_aplicadas: number;
    };
    expect(r).toMatchObject({ versao: 3, total_perguntas: 2, operacoes_aplicadas: 1 });

    // snapshot da versão anterior foi salvo intacto
    expect(tabelas.automation_versions).toHaveLength(1);
    expect(tabelas.automation_versions[0]).toMatchObject({ automation_id: AUTO_ID, version_number: 2 });

    // o fluxo salvo de verdade tem a captura, e ela vem DEPOIS da pergunta original
    const salvo = tabelas.automations[0];
    expect(salvo.flow_version).toBe(3);
    const decompilado = decompileFlow(salvo.flow_definition as Parameters<typeof decompileFlow>[0]);
    expect(decompilado.compatible).toBe(true);
    if (!decompilado.compatible) return;
    expect(decompilado.questions.map((q) => q.kind)).toEqual(['question', 'capture']);
    // o resto da automação não mudou
    expect(decompilado.form.welcome_dm).toBe(baseForm.welcome_dm);
    expect(decompilado.form.link_url).toBe(baseForm.link_url);
  });

  it('campos: só o que foi informado muda', async () => {
    seed();
    const r = (await editar.executar(
      { automacao_id: AUTO_ID, campos: { mensagem_inicial: 'Nova mensagem de boas-vindas', link: { botao: 'Garantir vaga' } }, copy_humanizada: true },
      ctxMaster,
    )) as { campos_alterados: string[] };
    expect(r.campos_alterados).toEqual(['mensagem_inicial', 'link']);

    const decompilado = decompileFlow(tabelas.automations[0].flow_definition as Parameters<typeof decompileFlow>[0]);
    if (!decompilado.compatible) throw new Error('esperava compatível');
    expect(decompilado.form.welcome_dm).toBe('Nova mensagem de boas-vindas');
    expect(decompilado.form.link_button_label).toBe('Garantir vaga');
    // preservado, não foi informado
    expect(decompilado.form.link_url).toBe(baseForm.link_url);
    expect(decompilado.form.keywords).toEqual(baseForm.keywords);
  });

  it('remove a captura existente', async () => {
    seed({}, [...umaPergunta, { kind: 'capture', config: { fields: ['email'], askText: { email: 'E-mail?', phone: '' }, invalidText: { email: 'Inválido', phone: '' }, maxAttempts: 3, skipIfKnown: true } }]);
    const r = (await editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'remover', posicao: 1 }] }, ctxMaster)) as { total_perguntas: number };
    expect(r.total_perguntas).toBe(1);
    const decompilado = decompileFlow(tabelas.automations[0].flow_definition as Parameters<typeof decompileFlow>[0]);
    if (!decompilado.compatible) throw new Error('esperava compatível');
    expect(decompilado.questions.map((q) => q.kind)).toEqual(['question']);
  });

  it('editar_texto exige copy_humanizada', async () => {
    seed();
    await expect(editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'editar_texto', posicao: 0, texto: 'Novo texto' }] }, ctxMaster)).rejects.toThrow(/humanizer/);
  });

  it('automação ativa é recusada', async () => {
    seed({ active: true });
    await expect(editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'adicionar_captura', campos: ['email'] }] }, ctxMaster)).rejects.toThrow(/ATIVA/);
  });

  it('automação sem flow_definition (formato antigo) é recusada', async () => {
    seed({ flow_definition: null });
    await expect(editar.executar({ automacao_id: AUTO_ID, campos: { mensagem_inicial: 'x' }, copy_humanizada: true }, ctxMaster)).rejects.toThrow(/formato antigo/);
  });

  it('automação com ramificação (condição) é recusada', async () => {
    const comCondicao = buildFlowFromAdvancedForm(baseForm, [], {
      splitAfterIndex: 0,
      condition: { conditionType: 'keyword', keywords: ['sim'], match_type: 'contains' },
      trueBranch: { questions: [], link_text: 'A', link_url: null, link_button_label: null, followups: [] },
      falseBranch: { questions: [], link_text: 'B', link_url: null, link_button_label: null, followups: [] },
    });
    seed({ flow_definition: comCondicao });
    await expect(editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'remover', posicao: 0 }] }, ctxMaster)).rejects.toThrow(/ramificação/);
  });

  it('posição fora do intervalo dá um erro claro', async () => {
    seed();
    await expect(editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'remover', posicao: 5 }] }, ctxMaster)).rejects.toThrow(/posicao.*5/);
  });

  it('membro não-master não edita automação de outro membro da mesma agência', async () => {
    seed();
    await expect(editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'adicionar_captura', campos: ['email'] }] }, ctxMembro)).rejects.toThrow(/só pode mexer nas automações que criou/);
  });

  it('automação de outra agência: nem aparece', async () => {
    seed();
    tabelas.membros = tabelas.membros.filter((m) => m.id !== 'm1'); // "m1" sai da agência de ctxMaster nesta chamada
    await expect(editar.executar({ automacao_id: AUTO_ID, operacoes: [{ tipo: 'adicionar_captura', campos: ['email'] }] }, ctxMaster)).rejects.toThrow('Automação não encontrada.');
  });

  it('sem campos nem operacoes, recusa', async () => {
    seed();
    await expect(editar.executar({ automacao_id: AUTO_ID }, ctxMaster)).rejects.toThrow(/campos.*operacoes/);
  });
});
