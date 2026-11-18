import { describe, expect, it } from 'vitest';
import { configPublica, CONFIG_PADRAO, validarEntradaConfig, validarHorario } from './config';

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
  it('nunca mostra a chave nem aceita ligado=true do banco', () => {
    const p = configPublica({ ligado: true, modo: 'real', openwa_key_cifrada: 'enc:x', openwa_webhook_id: 'wh', sessao_nome: 's', openwa_url: 'https://wa.x.com' });
    expect(p.ligado).toBe(false);
    expect(p).toMatchObject({ temChaveOpenwa: true, webhookOpenwaRegistrado: true, modo: 'real' });
    expect(JSON.stringify(p)).not.toContain('enc:');
  });
});
