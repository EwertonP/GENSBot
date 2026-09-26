import { NextRequest, NextResponse } from 'next/server';
import { getR2Client, isR2Configured } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    if (!isR2Configured()) {
      return new NextResponse('Storage R2 não configurado', { status: 503 });
    }

    const resolvedParams = await params;
    const key = (resolvedParams.key || []).join('/');

    if (!key) {
      return new NextResponse('Chave do arquivo ausente', { status: 400 });
    }

    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'gensbot-media',
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return new NextResponse('Arquivo não encontrado', { status: 404 });
    }

    const headers = new Headers();
    if (response.ContentType) headers.set('Content-Type', response.ContentType);
    if (response.ContentLength) headers.set('Content-Length', response.ContentLength.toString());
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    // Stream direto do R2 para o cliente
    const webStream = (response.Body as any).transformToWebStream();

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    if (error?.name === 'NoSuchKey') {
      return new NextResponse('Arquivo não encontrado', { status: 404 });
    }
    console.error('Erro ao servir mídia do R2:', error);
    return new NextResponse('Erro interno ao buscar mídia', { status: 500 });
  }
}
