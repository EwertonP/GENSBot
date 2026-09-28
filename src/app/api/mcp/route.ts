import { origemDaRequisicao, validarAccessToken } from '@/lib/mcp/oauth';
import { processarMensagem } from '@/lib/mcp/servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function naoAutorizado(req: Request) {
  const origem = origemDaRequisicao(req);
  return Response.json(
    { error: 'invalid_token', error_description: 'Conecte o GENSBot pelo login OAuth.' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${origem}/.well-known/oauth-protected-resource/api/mcp"`,
      },
    }
  );
}

/** Streamable HTTP, modo sem estado: toda mensagem chega por POST e volta como JSON. */
export async function POST(req: Request) {
  const ctx = await validarAccessToken(req.headers.get('authorization'));
  if (!ctx) return naoAutorizado(req);
  ctx.origem = origemDaRequisicao(req);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }, { status: 400 });
  }

  const mensagens = Array.isArray(corpo) ? corpo : [corpo];
  const respostas = [];
  for (const m of mensagens) {
    const r = await processarMensagem(m, ctx);
    if (r) respostas.push(r);
  }

  // Só notificações: 202 sem corpo, como pede o transporte.
  if (respostas.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(corpo) ? respostas : respostas[0], { headers: { 'Cache-Control': 'no-store' } });
}

// Sem stream de eventos do servidor nem sessões: GET e DELETE não se aplicam.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
