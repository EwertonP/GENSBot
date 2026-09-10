import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { supabase } from '@/lib/supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB — folga acima do limite prático de vídeo do Instagram

// POST: não recebe mais o arquivo em si — o corpo da requisição passando pela
// função serverless da Vercel tem limite de ~4.5MB, bem abaixo de um vídeo de
// Reels, e o upload falhava com "Request Entity Too Large" (texto puro, não
// JSON, por isso o front via "Unexpected token 'R'..." ao tentar parsear).
// Agora só pede nome/tipo/tamanho do arquivo e devolve uma signed upload URL do
// Supabase Storage: o navegador manda os bytes direto pro Supabase, sem passar
// pela função serverless.
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { fileName, fileType, fileSize } = await req.json();

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'Nome e tipo do arquivo são obrigatórios.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json({ error: 'Formato não suportado. Use JPG, PNG ou MP4.' }, { status: 400 });
    }
    if (typeof fileSize === 'number' && fileSize > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 100MB).' }, { status: 400 });
    }

    const ext = fileName.split('.').pop() || (fileType.startsWith('video') ? 'mp4' : 'jpg');
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabase.storage.from('post-media').createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Erro ao preparar o upload.' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from('post-media').getPublicUrl(path);

    return NextResponse.json({
      path: data.path,
      token: data.token,
      url: publicUrlData.publicUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
