import { describe, it, expect, vi, beforeEach } from 'vitest';

const enviadas: { endpoint: string; corpo: string }[] = [];
let falhaPorEndpoint: Record<string, number> = {};
const removidos: string[] = [];
const atualizados: string[] = [];
let inscricoes: { endpoint: string; p256dh: string; auth: string }[] = [];

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, corpo: string) => {
      if (falhaPorEndpoint[sub.endpoint]) throw Object.assign(new Error('falhou'), { statusCode: falhaPorEndpoint[sub.endpoint] });
      enviadas.push({ endpoint: sub.endpoint, corpo });
    }),
  },
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: async () => ({ data: inscricoes, error: null }) }),
      update: () => ({ eq: async (_c: string, v: string) => { atualizados.push(v); return {}; } }),
      delete: () => ({ eq: async (_c: string, v: string) => { removidos.push(v); return {}; } }),
    }),
  },
}));

import { endpointValido, enviarPush, pushConfigurado } from './push';

const FCM = 'https://fcm.googleapis.com/fcm/send/abc';
const APPLE = 'https://web.push.apple.com/xyz';

beforeEach(() => {
  enviadas.length = 0; removidos.length = 0; atualizados.length = 0; falhaPorEndpoint = {};
  inscricoes = [{ endpoint: FCM, p256dh: 'k', auth: 'a' }, { endpoint: APPLE, p256dh: 'k', auth: 'a' }];
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:a@b.com';
});

describe('endpointValido', () => {
  it('aceita os serviços de push dos navegadores', () => {
    for (const u of [FCM, APPLE, 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=1']) expect(endpointValido(u)).toBe(true);
  });
  it('recusa http, hosts internos e domínios parecidos', () => {
    for (const u of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.com/x', 'https://evilfcm.googleapis.com.br/x', 'nao-e-url', '', null, 42]) expect(endpointValido(u)).toBe(false);
  });
});

describe('enviarPush', () => {
  it('sem chaves VAPID não envia nem falha', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushConfigurado()).toBe(false);
    expect(await enviarPush('u1', { title: 't', body: 'b' })).toEqual({ enviados: 0, removidas: 0, falhas: 0 });
    expect(enviadas).toHaveLength(0);
  });

  it('envia para todos os aparelhos e registra o uso', async () => {
    const r = await enviarPush('u1', { title: 'Oi', body: 'Corpo', url: '/?tab=esteira', tag: 'x' });
    expect(r).toEqual({ enviados: 2, removidas: 0, falhas: 0 });
    expect(JSON.parse(enviadas[0].corpo)).toMatchObject({ title: 'Oi', body: 'Corpo', url: '/?tab=esteira', tag: 'x' });
    expect(atualizados.sort()).toEqual([APPLE, FCM].sort());
  });

  it('remove inscrição expirada (410/404) e conta outras falhas à parte', async () => {
    falhaPorEndpoint[FCM] = 410;
    falhaPorEndpoint[APPLE] = 500;
    const r = await enviarPush('u1', { title: 't', body: 'b' });
    expect(r).toEqual({ enviados: 0, removidas: 1, falhas: 1 });
    expect(removidos).toEqual([FCM]);
  });

  it('sem inscrições não faz nada', async () => {
    inscricoes = [];
    expect(await enviarPush('u1', { title: 't', body: 'b' })).toEqual({ enviados: 0, removidas: 0, falhas: 0 });
  });

  it('corta título e corpo longos', async () => {
    await enviarPush('u1', { title: 'T'.repeat(300), body: 'B'.repeat(900) });
    const c = JSON.parse(enviadas[0].corpo);
    expect(c.title.length).toBe(80);
    expect(c.body.length).toBe(240);
  });
});
