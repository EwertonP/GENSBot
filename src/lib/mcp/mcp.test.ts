import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { pkceConfere, redirectUriValida, metadataRecurso } from './oauth';
import { ErroFerramenta, validarAvaliacao } from './ferramentas';
import { listarFerramentas, processarMensagem } from './servidor';

const ctx = { tokenId: 't', clientId: 'c', membroId: 'm', agenciaId: 'a', papel: 'master' as const, nome: 'Teste' };

describe('PKCE', () => {
  const verifier = 'a'.repeat(43);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  it('aceita o verifier certo e recusa o errado', () => {
    expect(pkceConfere(verifier, challenge)).toBe(true);
    expect(pkceConfere('b'.repeat(43), challenge)).toBe(false);
    expect(pkceConfere('curto', challenge)).toBe(false);
  });
});

describe('redirectUriValida', () => {
  it('aceita https e localhost, recusa o resto', () => {
    expect(redirectUriValida('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(redirectUriValida('http://localhost:6274/callback')).toBe(true);
    expect(redirectUriValida('http://evil.com/cb')).toBe(false);
    expect(redirectUriValida('https://x.com/cb#frag')).toBe(false);
    expect(redirectUriValida('javascript:alert(1)')).toBe(false);
  });
});

describe('metadata', () => {
  it('aponta o recurso para /api/mcp', () => {
    expect(metadataRecurso('https://app.test').resource).toBe('https://app.test/api/mcp');
  });
});

describe('validarAvaliacao (trava do MetodoViral)', () => {
  const ok = { notas: { gancho: 9, cta: 10, clareza: 9 }, conformidade: 'ok', humanizado: true };
  it('aprova média ≥ 9 com humanizer', () => {
    expect(validarAvaliacao('post', ok)).toMatchObject({ media: 9.33, menor_nota: 9 });
  });
  it('recusa média baixa, nota < 7, sem humanizer ou sem scorecard', () => {
    expect(() => validarAvaliacao('reel', { ...ok, notas: { a: 8, b: 9 } })).toThrow(ErroFerramenta);
    expect(() => validarAvaliacao('reel', { ...ok, notas: { a: 10, b: 10, c: 10, d: 6 } })).toThrow(/< 7/);
    expect(() => validarAvaliacao('post', { ...ok, humanizado: false })).toThrow(/humanizer/);
    expect(() => validarAvaliacao('story', undefined)).toThrow(/scorecard/);
  });
  it('avulso pode vir sem scorecard', () => {
    expect(validarAvaliacao('avulso', undefined)).toBeNull();
  });
});

describe('servidor JSON-RPC', () => {
  it('initialize negocia a versão e ping responde', async () => {
    const r = (await processarMensagem({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, ctx)) as {
      result: { protocolVersion: string };
    };
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(await processarMensagem({ jsonrpc: '2.0', id: 2, method: 'ping' }, ctx)).toEqual({ jsonrpc: '2.0', id: 2, result: {} });
  });
  it('notificação não gera resposta; método desconhecido dá -32601', async () => {
    expect(await processarMensagem({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx)).toBeNull();
    const r = (await processarMensagem({ jsonrpc: '2.0', id: 3, method: 'xyz' }, ctx)) as { error: { code: number } };
    expect(r.error.code).toBe(-32601);
  });
  it('lista ferramentas com schema e dica de somente leitura', () => {
    const tools = listarFerramentas();
    expect(tools.map((t) => t.name)).toContain('criar_demandas_lote');
    for (const t of tools) expect(t.inputSchema).toMatchObject({ type: 'object' });
    expect(tools.find((t) => t.name === 'listar_clientes')?.annotations.readOnlyHint).toBe(true);
  });
});

describe('C2: formulários e aprovações', async () => {
  const { montarCampos, entrouEmAprovacao } = await import('./ferramentas-c2');
  it('adiciona boas-vindas e agradecimento e exige opções em escolha', () => {
    const campos = montarCampos('f', [
      { tipo: 'text', label: 'Seu nome?' },
      { tipo: 'choice', label: 'Serviço?', opcoes: ['A', 'B'] },
    ]);
    expect(campos.map((c) => c.tipo)).toEqual(['welcome', 'text', 'choice', 'thank_you']);
    expect(campos.map((c) => c.ordem)).toEqual([0, 1, 2, 3]);
    expect((campos[2].opcoes as { label: string }[]).map((o) => o.label)).toEqual(['A', 'B']);
    expect(() => montarCampos('f', [{ tipo: 'choice', label: 'X', opcoes: ['só uma'] }])).toThrow(/2 opções/);
    expect(() => montarCampos('f', [{ tipo: 'foto', label: 'X' }])).toThrow(/tipo/);
    expect(() => montarCampos('f', [])).toThrow();
  });
  it('acha quando a demanda entrou em aprovação', () => {
    const h = [
      { tipo: 'status', para_status: 'revisao_cliente', criado_em: '2026-09-01' },
      { tipo: 'status', para_status: 'revisao_interna', criado_em: '2026-09-02' },
      { tipo: 'status', para_status: 'revisao_cliente', criado_em: '2026-09-05' },
    ];
    expect(entrouEmAprovacao(h)).toBe('2026-09-05');
    expect(entrouEmAprovacao(null)).toBeNull();
  });
  it('servidor expõe as 24 ferramentas', () => {
    expect(listarFerramentas()).toHaveLength(29);
  });
});

describe('C3: automações', async () => {
  const { montarFormulario } = await import('./ferramentas-c3');
  const { buildFlowFromAdvancedForm, decompileFlow } = await import('../flow-engine/wizardCompiler');
  const base = {
    nome: 'Captação EU QUERO',
    gatilhos: ['comment', 'dm'],
    palavras_chave: ['EU QUERO'],
    respostas_publicas: ['Te chamei no direct!'],
    mensagem_inicial: 'Oi! Vi seu comentário.',
    botao_inicial: 'Quero saber',
    perguntas: [{ texto: 'Qual seu segmento?', botoes: ['Saúde', 'Varejo'] }, { texto: 'Seu e-mail?', salvar_em_campo: 'email' }],
    link: { texto: 'Marca aqui:', url: 'https://cal.com/gens', botao: 'Agendar' },
    followups: [{ texto: 'Ainda com dúvida?', apos_minutos: 1440 }],
    copy_humanizada: true,
  };
  it('exige humanizer, gatilho válido e palavra-chave', () => {
    expect(() => montarFormulario({ ...base, copy_humanizada: false })).toThrow(/humanizer/);
    expect(() => montarFormulario({ ...base, gatilhos: ['whatsapp'] })).toThrow(/gatilhos/);
    expect(() => montarFormulario({ ...base, palavras_chave: [] })).toThrow(/palavras_chave/);
    expect(() => montarFormulario({ ...base, link: { url: 'javascript:alert(1)' } })).toThrow(/URL/);
  });
  it('sempre pausada e compila num fluxo que a tela consegue reabrir', () => {
    const { form, perguntas } = montarFormulario(base);
    expect(form.active).toBe(false);
    const flow = buildFlowFromAdvancedForm(form, perguntas);
    const volta = decompileFlow(flow);
    expect(volta.compatible).toBe(true);
    if (volta.compatible) {
      expect(volta.form.welcome_dm).toBe('Oi! Vi seu comentário.');
      expect(volta.form.keywords).toEqual(['EU QUERO']);
      expect(volta.questions).toHaveLength(2);
      expect(volta.form.link_url).toBe('https://cal.com/gens');
      expect(volta.form.followups).toHaveLength(1);
    }
  });
});
