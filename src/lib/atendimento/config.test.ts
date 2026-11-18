import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configPublica, CONFIG_PADRAO, faltasParaLigar, salvarConfig, validarEntradaConfig, validarHorario } from './config';

describe('validarHorario', () => {
  it('aceita faixas válidas e descarta dias vazios', () => {
    expect(validarHorario({ seg: [{ de: '08:00', ate: '12:00' }, { de: '14:00', ate: '19:00' }], ter: [] })).toEqual({
      seg: [{ de: '08:00', ate: '12:00' }, { de: '14:00', ate: '19:00' }],
    });
  });
  it('recusa dia desconhecido, hora ruim, início depois do fim e excesso de faixas', () => {
    expect(validarHorario({ xyz: [] })).toBeNull();
    expect(validarHorario({ seg: [{ de: '8:00', ate: '12:00' }] })).toBeNull();
    expect(validarHorario({ seg: [{ de: '12:00', ate: '08:00' }] })).toBeNull();
    expect(validarHorario({ seg: [{ de: '25:00', ate: '26:00' }] })).toBeNull();
    expect(validarHorario({ seg: Array(5).fill({ de: '08:00', ate: '09:00' }) })).toBeNull();
    expect(validarHorario([])).toBeNull();
    expect(validarHorario(null)).toBeNull();
  });
});

describe('validarEntradaConfig', () => {
  it('só valida o que veio', () => {
    expect(validarEntradaConfig({})).toEqual({ ok: true, campos: {}, novaChaveOpenwa: null });
  });
  it('aceita uma configuração completa e normaliza o endereço do OpenWA', () => {
    const r = validarEntradaConfig({
      modo: 'simulacao',
      sessaoNome: 'cliente-lais',
      openwaUrl: 'wa.dralaisleal.com.br/',
      openwaKey: '  chave-secreta  ',
      respostaMinSegundos: '45',
      respostaMaxSegundos: 180,
      limiteRespostasHora: 12,
      pausaHumanoHoras: 6,
    });
    expect(r).toMatchObject({ ok: true, novaChaveOpenwa: 'chave-secreta' });
    expect((r as { campos: Record<string, unknown> }).campos).toMatchObject({
      modo: 'simulacao',
      sessao_nome: 'cliente-lais',
      openwa_url: 'https://wa.dralaisleal.com.br',
      resposta_min_segundos: 45,
      resposta_max_segundos: 180,
    });
  });
  it('recusa entradas ruins com mensagem', () => {
    expect(validarEntradaConfig({ modo: 'ligado' })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ sessaoNome: 'nome com espaço' })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ openwaUrl: 'http://10.0.0.5:2785' })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ respostaMinSegundos: 200, respostaMaxSegundos: 100 })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ respostaMinSegundos: -1 })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ respostaMinSegundos: 'abc' })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ limiteRespostasHora: 500 })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ pausaHumanoHoras: 100 })).toMatchObject({ ok: false });
  });
  it('chave do OpenWA vazia não apaga a atual; só removerOpenwaKey apaga', () => {
    expect(validarEntradaConfig({ openwaKey: '   ' })).toEqual({ ok: true, campos: {}, novaChaveOpenwa: null });
    expect(validarEntradaConfig({ removerOpenwaKey: true })).toMatchObject({ ok: true, campos: { openwa_key_cifrada: null } });
  });
});

describe('configPublica', () => {
  it('sem linha, devolve o padrão desligado em simulação', () => {
    expect(configPublica(null)).toEqual(CONFIG_PADRAO);
    expect(CONFIG_PADRAO).toMatchObject({ ligado: false, modo: 'simulacao' });
  });
  it('nunca mostra a chave; ligado vem do banco', () => {
    const p = configPublica({ ligado: true, modo: 'real', openwa_key_cifrada: 'enc:x', openwa_webhook_id: 'wh', sessao_nome: 's', openwa_url: 'https://wa.x.com' });
    expect(p.ligado).toBe(true);
    expect(p).toMatchObject({ temChaveOpenwa: true, webhookOpenwaRegistrado: true, modo: 'real' });
    expect(JSON.stringify(p)).not.toContain('enc:');
  });
});

describe('ligar o atendimento', () => {
  const pronto = { sessao_nome: 's', horario_atendimento: { seg: [{ de: '08:00', ate: '19:00' }] }, modo: 'simulacao' };
  const ok = { temChaveIA: true, tamInstrucoes: 300, webhookOpenwa: false };

  it('faltasParaLigar: lista o que falta e fica vazio quando está tudo', () => {
    expect(faltasParaLigar({ linha: null, temChaveIA: false, tamInstrucoes: 39, webhookOpenwa: false })).toHaveLength(4);
    expect(faltasParaLigar({ linha: pronto, ...ok })).toEqual([]);
    expect(faltasParaLigar({ linha: pronto, ...ok, tamInstrucoes: 99 })).toHaveLength(1);
    expect(faltasParaLigar({ linha: { ...pronto, horario_atendimento: {} }, ...ok })).toHaveLength(1);
  });
  it('modo real exige o OpenWA do cliente e o webhook', () => {
    expect(faltasParaLigar({ linha: { ...pronto, modo: 'real' }, ...ok })).toHaveLength(2);
    expect(faltasParaLigar({ linha: { ...pronto, modo: 'real', openwa_url: 'https://x.com.br', openwa_key_cifrada: 'k' }, ...ok, webhookOpenwa: true })).toEqual([]);
  });
  it('ligado precisa ser booleano', () => {
    expect(validarEntradaConfig({ ligado: 'sim' })).toMatchObject({ ok: false });
    expect(validarEntradaConfig({ ligado: true })).toMatchObject({ ok: true });
  });

  /** Banco mínimo: devolve a linha da tabela e guarda o que foi gravado. */
  const banco = (tabelas: Record<string, unknown>) => {
    const gravado: { linha?: Record<string, unknown> } = {};
    const db = {
      from: (t: string) => {
        const c: Record<string, unknown> = {
          select: () => c,
          eq: () => c,
          maybeSingle: async () => ({ data: tabelas[t] ?? null }),
          upsert: (l: Record<string, unknown>) => ((gravado.linha = l), { select: () => ({ single: async () => ({ data: l, error: null }) }) }),
        };
        return c;
      },
    } as unknown as SupabaseClient;
    return { db, gravado };
  };
  const ia = { api_key: 'enc', prompt_sistema: 'x'.repeat(200) };

  it('pedir para ligar sem pré-requisitos é recusado e diz o que falta', async () => {
    const { db, gravado } = banco({ atendimento_config: null, ai_agent_configs: null });
    const r = await salvarConfig(db, 'ag', 'cl', { ligado: true });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect((r as { erro: string }).erro).toContain('nome da sessão');
    expect(gravado.linha).toBeUndefined();
  });
  it('liga quando tudo está em ordem', async () => {
    const { db, gravado } = banco({ atendimento_config: pronto, ai_agent_configs: ia });
    const r = await salvarConfig(db, 'ag', 'cl', { ligado: true });
    expect(r).toMatchObject({ ok: true, desligadoSozinho: false, config: { ligado: true } });
    expect(gravado.linha?.ligado).toBe(true);
  });
  it('uma mudança que quebra um pré-requisito com o atendimento ligado desliga sozinho', async () => {
    const { db, gravado } = banco({ atendimento_config: { ...pronto, ligado: true }, ai_agent_configs: ia });
    const r = await salvarConfig(db, 'ag', 'cl', { horario: {} });
    expect(r).toMatchObject({ ok: true, desligadoSozinho: true, config: { ligado: false } });
    expect(gravado.linha?.ligado).toBe(false);
  });
  it('salvar outras coisas não muda o estado ligado', async () => {
    const { db, gravado } = banco({ atendimento_config: { ...pronto, ligado: true }, ai_agent_configs: ia });
    await salvarConfig(db, 'ag', 'cl', { limiteRespostasHora: 5 });
    expect(gravado.linha?.ligado).toBe(true);
  });
  it('desligar sempre pode', async () => {
    const { db, gravado } = banco({ atendimento_config: { ...pronto, ligado: true }, ai_agent_configs: null });
    await salvarConfig(db, 'ag', 'cl', { ligado: false });
    expect(gravado.linha?.ligado).toBe(false);
  });
});
