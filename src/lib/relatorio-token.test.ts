import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.RELATORIO_TOKEN_SECRET = 'test-secret-de-pelo-menos-16';
});

describe('token do relatório público', async () => {
  const { gerarTokenRelatorio, verificarTokenRelatorio } = await import('./relatorio-token');
  const base = { accountId: '1784', period: 30 as const, clienteNome: '@clinica', ownerId: 'user-1' };

  it('gera e verifica um token válido', () => {
    const token = gerarTokenRelatorio(base);
    expect(token.startsWith('r2_')).toBe(true);
    expect(verificarTokenRelatorio(token)).toMatchObject(base);
  });

  it('recusa token com payload adulterado (outra conta)', () => {
    const token = gerarTokenRelatorio(base);
    const [payload, sig] = token.slice(3).split('.');
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString());
    forged.a = '9999';
    const forgedPayload = Buffer.from(JSON.stringify(forged)).toString('base64url');
    expect(verificarTokenRelatorio(`r2_${forgedPayload}.${sig}`)).toBeNull();
  });

  it('recusa links antigos sem assinatura e lixo', () => {
    const legacy = 'rel_' + Buffer.from(JSON.stringify({ a: '1784', m: '2026-08' })).toString('base64url');
    expect(verificarTokenRelatorio(legacy)).toBeNull();
    expect(verificarTokenRelatorio('r2_abc')).toBeNull();
    expect(verificarTokenRelatorio('')).toBeNull();
    expect(verificarTokenRelatorio(null)).toBeNull();
  });

  it('período inválido cai em 30 dias', () => {
    const token = gerarTokenRelatorio({ ...base, period: 30 });
    expect(verificarTokenRelatorio(token)?.period).toBe(30);
  });
});
