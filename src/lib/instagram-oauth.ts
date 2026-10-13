/**
 * Inicia o fluxo de autorização OAuth do Instagram / Meta para conectar uma nova conta.
 * Pode receber clienteId opcional no state para vincular a conta automaticamente ao cliente após a autorização.
 */
export function conectarContaInstagram(clienteId?: string | null) {
  const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
  if (!clientId) {
    alert('Falta configurar o NEXT_PUBLIC_INSTAGRAM_CLIENT_ID nas variáveis de ambiente.');
    return;
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const scopes = [
    'instagram_business_basic',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
    'instagram_business_manage_insights',
    'instagram_business_content_publish',
  ].join(',');

  let stateParam = '';
  if (clienteId) {
    stateParam = `&state=${encodeURIComponent(JSON.stringify({ clienteId }))}`;
  }

  window.location.href = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scopes}&response_type=code${stateParam}`;
}
