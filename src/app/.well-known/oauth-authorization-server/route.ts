import { metadataAuthServer, origemDaRequisicao } from '@/lib/mcp/oauth';

export function GET(req: Request) {
  return Response.json(metadataAuthServer(origemDaRequisicao(req)), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
  });
}
