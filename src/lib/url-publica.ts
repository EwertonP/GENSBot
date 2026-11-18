/**
 * Endereço público do GENSBot para montar links que saem do sistema (webhooks, e-mails).
 *
 * NUNCA usa o host da requisição: os deploys de preview compartilham o banco e as
 * variáveis da produção, e um clique num preview cadastraria o endereço do preview
 * num serviço externo (Cal.com, OpenWA). Segue o mesmo padrão dos contratos e
 * documentos: NEXT_PUBLIC_APP_URL (se não for localhost) e, senão, a produção.
 */
export const URL_PRODUCAO = 'https://allingens.vercel.app';

export function urlPublicaDoApp(env: Record<string, string | undefined> = process.env): string {
  const configurada = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configurada && /^https:\/\//i.test(configurada) && !/localhost|127\.0\.0\.1/i.test(configurada)) {
    return configurada;
  }
  return URL_PRODUCAO;
}

/** Endereço que o Cal.com chama: um token por integração identifica o cliente. */
export function urlWebhookAgenda(token: string, base: string = urlPublicaDoApp()): string {
  return `${base}/api/webhook/agenda/${token}`;
}

/** Endereço que o OpenWA chama; o nome da sessão vai na URL porque o OpenWA só manda o UUID. */
export function urlWebhookWhatsapp(sessionName: string, base: string = urlPublicaDoApp()): string {
  return `${base}/api/webhook/whatsapp?session=${encodeURIComponent(sessionName)}`;
}
