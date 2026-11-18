import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOpenWAConfig, montarConfigOpenWA } from './openwa-client';

afterEach(() => vi.unstubAllEnvs());

/** A implementação de ANTES da refatoração, copiada literalmente, para provar que nada mudou. */
function configAntiga(env: Record<string, string | undefined>) {
  let url = env.OPENWA_API_URL?.trim().replace(/\/$/, '') || null;
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
  const key = env.OPENWA_API_KEY || env.API_MASTER_KEY || null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (key) {
    headers['X-API-Key'] = key;
    headers['Authorization'] = `Bearer ${key}`;
  }
  return { url, key, headers };
}

describe('getOpenWAConfig (caminho por variável de ambiente, usado pelas aprovações da agência)', () => {
  const casos: Array<Record<string, string | undefined>> = [
    {},
    { OPENWA_API_URL: 'https://wa.exemplo.com' },
    { OPENWA_API_URL: 'wa.exemplo.com/', OPENWA_API_KEY: 'k1' },
    { OPENWA_API_URL: '  http://10.0.0.5:2785/  ', API_MASTER_KEY: 'mestre' },
    { OPENWA_API_URL: 'https://wa.exemplo.com', OPENWA_API_KEY: 'k1', API_MASTER_KEY: 'mestre' },
    { OPENWA_API_KEY: 'sem-url' },
  ];

  it.each(casos.map((c, i) => [i, c] as const))('caso %i devolve exatamente o mesmo de antes', (_i, env) => {
    for (const nome of ['OPENWA_API_URL', 'OPENWA_API_KEY', 'API_MASTER_KEY']) vi.stubEnv(nome, env[nome] ?? '');
    // stubEnv com '' equivale a "vazio"; a versão antiga trata '' e ausente do mesmo jeito (|| null).
    expect(getOpenWAConfig()).toEqual(configAntiga(env));
  });
});

describe('montarConfigOpenWA (configuração por cliente)', () => {
  it('normaliza o endereço e monta os cabeçalhos', () => {
    expect(montarConfigOpenWA('wa.clinica.com.br/', 'abc')).toEqual({
      url: 'https://wa.clinica.com.br',
      key: 'abc',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-Key': 'abc', Authorization: 'Bearer abc' },
    });
  });
  it('sem endereço ou chave devolve nulos e não inventa cabeçalho de autenticação', () => {
    const c = montarConfigOpenWA(null, undefined);
    expect(c.url).toBeNull();
    expect(c.key).toBeNull();
    expect(c.headers).not.toHaveProperty('X-API-Key');
  });
});
