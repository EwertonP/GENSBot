/**
 * Inicia o fluxo de autorização OAuth 2.0 do TikTok (Login Kit / Content Posting API).
 * Pode receber clienteId opcional no state para vincular a conta automaticamente ao cliente.
 */
export function conectarContaTikTok(clienteId?: string | null) {
  const clientKey = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    alert('Falta configurar a variável NEXT_PUBLIC_TIKTOK_CLIENT_KEY nas variáveis de ambiente da Vercel.');
    return;
  }

  const redirectUri = `${window.location.origin}/api/integrations/tiktok/callback`;
  const scopes = [
    'user.info.basic',
    'video.publish',
    'video.upload',
  ].join(',');

  let stateParam = '';
  if (clienteId) {
    stateParam = `&state=${encodeURIComponent(JSON.stringify({ clienteId }))}`;
  }

  window.location.href = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(
    scopes
  )}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}${stateParam}`;
}
