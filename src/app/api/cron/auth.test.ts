import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const trabalho = vi.hoisted(() => vi.fn(async () => ({ data: [], error: null })));

vi.mock('@/lib/drain', () => ({ drainQueue: trabalho }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/profile-picture', () => ({ cacheProfilePicture: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      trabalho();
      const p: unknown = new Proxy(() => undefined, {
        get: (_a, prop) => (prop === 'then' ? (ok: (v: unknown) => void) => ok({ data: [], error: null }) : () => p),
      });
      return p;
    },
  },
}));

import { GET as drain } from './drain/route';
import { GET as checkAlerts } from './check-alerts/route';
import { GET as refreshToken } from './refresh-token/route';

const rotas = { drain, 'check-alerts': checkAlerts, 'refresh-token': refreshToken };
const chamar = (fn: (r: Request) => Promise<Response>, headers: Record<string, string> = {}) =>
  fn(new Request('http://localhost/api/cron/x', { headers }));

describe.each(Object.entries(rotas))('cron %s', (_nome, handler) => {
  beforeEach(() => {
    trabalho.mockClear();
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('em produção sem CRON_SECRET recusa até o antigo local_secret', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await chamar(handler, { Authorization: 'Bearer local_secret' });
    expect(res.status).toBe(500);
    expect(trabalho).not.toHaveBeenCalled();
  });

  it('em produção recusa segredo errado sem executar o trabalho', async () => {
    vi.stubEnv('CRON_SECRET', 's3gredo');
    const res = await chamar(handler, { Authorization: 'Bearer outro' });
    expect(res.status).toBe(401);
    expect(trabalho).not.toHaveBeenCalled();
  });
});
