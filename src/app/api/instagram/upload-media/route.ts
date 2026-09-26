import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth-api';
import { sanitizeFileName } from '@/lib/storage-upload';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
      }

      const cleanName = sanitizeFileName(file.name);
      const path = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${cleanName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage.from('post-media').upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
      return NextResponse.json({ url: publicUrl, name: file.name });
    }

    return NextResponse.json(
      { error: 'Endpoint migrado para Supabase Storage. Use uploadMediaFile diretamente no frontend ou multipart/form-data.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

