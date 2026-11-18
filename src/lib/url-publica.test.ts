import { describe, expect, it } from 'vitest';
import { URL_PRODUCAO, urlPublicaDoApp, urlWebhookAgenda, urlWebhookWhatsapp } from './url-publica';

describe('urlPublicaDoApp', () => {
  it('usa NEXT_PUBLIC_APP_URL quando é https e não é localhost', () => {
    expect(urlPublicaDoApp({ NEXT_PUBLIC_APP_URL: 'https://app.gens.com.br/' })).toBe('https://app.gens.com.br');
  });
  it('cai na produção sem variável, com localhost ou com http', () => {
    expect(urlPublicaDoApp({})).toBe(URL_PRODUCAO);
    expect(urlPublicaDoApp({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })).toBe(URL_PRODUCAO);
    expect(urlPublicaDoApp({ NEXT_PUBLIC_APP_URL: 'https://localhost:3000' })).toBe(URL_PRODUCAO);
    expect(urlPublicaDoApp({ NEXT_PUBLIC_APP_URL: 'http://app.gens.com.br' })).toBe(URL_PRODUCAO);
  });
});

describe('urls de webhook', () => {
  it('agenda leva o token no caminho', () => {
    expect(urlWebhookAgenda('abc', 'https://x.com')).toBe('https://x.com/api/webhook/agenda/abc');
  });
  it('whatsapp leva o nome da sessão na query, escapado', () => {
    expect(urlWebhookWhatsapp('cliente-123', 'https://x.com')).toBe('https://x.com/api/webhook/whatsapp?session=cliente-123');
    expect(urlWebhookWhatsapp('a b&c', 'https://x.com')).toBe('https://x.com/api/webhook/whatsapp?session=a%20b%26c');
  });
});
