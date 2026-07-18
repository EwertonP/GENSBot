import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: config } = await supabase.from('config').select('*').single();
    if (!config || !config.instagram_token || !config.instagram_user_id) {
      return NextResponse.json({ error: 'Instagram não conectado.' }, { status: 400 });
    }

    const response = await fetch(
      `https://graph.instagram.com/v25.0/${config.instagram_user_id}/media?fields=id,media_type,media_url,thumbnail_url,caption,permalink,timestamp&limit=25&access_token=${config.instagram_token}`
    );
    const data = await response.json();

    if (!response.ok) {
      console.error('Erro ao buscar mídias do Instagram:', data);
      return NextResponse.json({ error: data.error?.message || 'Erro ao buscar posts.' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Erro na API de mídias:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
