import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getAuthUser } from '@/lib/auth-api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
const MAX_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB — teto de vídeo de Reels da própria Meta

// POST: gera o client token que autoriza o navegador a mandar o arquivo direto
// pro Vercel Blob (multipart, sem passar pelo corpo desta função serverless —
// que tem limite de ~4.5MB, bem abaixo de um vídeo de Reels). Antes isso ia
// pelo Supabase Storage via signed URL; trocado pro Blob pra não depender do
// limite de upload configurado no projeto Supabase (50MB no plano free) e
// aproveitar o multipart nativo do Blob pra arquivo grande.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getAuthUser();
        if (!user) throw new Error('Não autenticado.');

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      // Sem onUploadCompleted: não precisamos de nada no banco quando o upload
      // termina — o front recebe a URL do blob direto no retorno de upload()
      // e segue pro /api/instagram/publish com ela.
    });

    return NextResponse.json(jsonResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
