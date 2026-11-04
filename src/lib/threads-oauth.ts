/**
 * Inicia o fluxo de autorização OAuth do Threads (Meta) para conectar uma conta ao GENSBot.
 * Pode receber clienteId opcional no state para vincular a conta automaticamente ao cliente.
 */
export function conectarContaThreads(clienteId?: string | null) {
  const clientId = process.env.NEXT_PUBLIC_THREADS_CLIENT_ID || '2437920840075028';

  const redirectUri = `${window.location.origin}/api/integrations/threads/callback`;
  const scopes = [
    'threads_basic',
    'threads_content_publish',
    'threads_manage_insights',
  ].join(',');

  let stateParam = '';
  if (clienteId) {
    stateParam = `&state=${encodeURIComponent(JSON.stringify({ clienteId }))}`;
  }

  window.location.href = `https://threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scopes}&response_type=code${stateParam}`;
}
