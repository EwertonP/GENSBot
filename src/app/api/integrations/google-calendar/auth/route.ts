import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro } from '@/lib/clientes-server';
import { gerarGoogleAuthUrl, getGoogleOAuthConfig } from '@/lib/google-calendar';

export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id') || null;

  const { clientId } = getGoogleOAuthConfig();
  if (!clientId) {
    return respostaErro('GOOGLE_CLIENT_ID não está configurado na Vercel.', 400);
  }

  const host = req.headers.get('host') || 'allingens.vercel.app';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const redirectUri = `${protocol}://${host}/api/integrations/google-calendar/callback`;

  try {
    const url = gerarGoogleAuthUrl({
      agenciaId: membro.agencia_id,
      clienteId,
      redirectUri,
    });

    return NextResponse.redirect(url);
  } catch (err: unknown) {
    return respostaErro(err instanceof Error ? err.message : 'Falha ao iniciar autenticação Google.', 500);
  }
}
