import { NextResponse } from 'next/server';
import { isR2Configured, getPresignedUploadUrl } from '@/lib/r2';
import { sanitizeFileName } from '@/lib/storage-upload';

export async function POST(req: Request) {
  try {
    // Se o R2 não estiver configurado nas variáveis de ambiente, sinaliza fallback para o Supabase
    if (!isR2Configured()) {
      return NextResponse.json({ provider: 'supabase' });
    }

    const body = await req.json();
    const { filename, contentType, folder = 'uploads' } = body || {};

    if (!filename) {
      return NextResponse.json({ error: 'filename é obrigatório.' }, { status: 400 });
    }

    const cleanName = sanitizeFileName(filename);
    const key = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${cleanName}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({
      provider: 'r2',
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error: any) {
    console.error('Erro ao gerar presigned URL no R2:', error);
    // Em caso de falha de configuração ou rede no R2, permite fallback gracioso para o Supabase
    return NextResponse.json({ provider: 'supabase', error: error?.message });
  }
}
