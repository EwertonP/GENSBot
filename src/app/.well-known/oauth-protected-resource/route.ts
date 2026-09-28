import { metadataRecurso, origemDaRequisicao } from '@/lib/mcp/oauth';

export function GET(req: Request) {
  return Response.json(metadataRecurso(origemDaRequisicao(req)), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
  });
}
