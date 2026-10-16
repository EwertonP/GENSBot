import { describe, it, expect, afterEach, vi } from 'vitest';
import { segredoConfere, validarCron, validarWebhookOpenWA } from './segredos';

const req = (headers: Record<string, string> = {}) => new Request('http://localhost/x', { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('segredoConfere', () => {
  it('aceita o valor puro e o formato Bearer', () => {
    expect(segredoConfere('abc123', 'abc123')).toBe(true);
    expect(segredoConfere('Bearer abc123', 'abc123')).toBe(true);
  });

  it('recusa valor diferente, vazio ou de tamanho diferente', () => {
    expect(segredoConfere('abc124', 'abc123')).toBe(false);
    expect(segredoConfere('abc', 'abc123')).toBe(false);
    expect(segredoConfere(null, 'abc123')).toBe(false);
    expect(segredoConfere('', 'abc123')).toBe(false);
  });
});

describe('validarCron', () => {
  it('em produção sem CRON_SECRET recusa tudo, inclusive o antigo local_secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', '');
    const res = validarCron(req({ Authorization: 'Bearer local_secret' }));
    expect(res?.status).toBe(500);
  });

  it('em produção recusa segredo errado e aceita o certo', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 's3gredo');
    expect(validarCron(req({ Authorization: 'Bearer outro' }))?.status).toBe(401);
    expect(validarCron(req())?.status).toBe(401);
    expect(validarCron(req({ Authorization: 'Bearer s3gredo' }))).toBeNull();
  });

  it('fora de produção deixa passar para rodar localmente', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CRON_SECRET', '');
    expect(validarCron(req())).toBeNull();
  });
});

describe('validarWebhookOpenWA', () => {
  it('em produção sem OPENWA_WEBHOOK_SECRET recusa (antes deixava aberto)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPENWA_WEBHOOK_SECRET', '');
    expect(validarWebhookOpenWA(req())?.status).toBe(503);
  });

  it('em produção exige o segredo em x-openwa-secret ou Authorization', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPENWA_WEBHOOK_SECRET', 'wh-secret');
    expect(validarWebhookOpenWA(req())?.status).toBe(401);
    expect(validarWebhookOpenWA(req({ 'x-openwa-secret': 'errado' }))?.status).toBe(401);
    expect(validarWebhookOpenWA(req({ 'x-openwa-secret': 'wh-secret' }))).toBeNull();
    expect(validarWebhookOpenWA(req({ authorization: 'Bearer wh-secret' }))).toBeNull();
  });
});
