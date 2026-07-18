import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function handleRefresh(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const { data: config, error: configError } = await supabase
      .from('config')
      .select('*')
      .single();

    if (configError || !config || !config.instagram_token) {
      return NextResponse.json({ error: 'Configuração do Instagram não encontrada.' }, { status: 404 });
    }

    const currentToken = config.instagram_token;

    // Renovar o token longo
    const refreshResponse = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
    );

    const refreshData = await refreshResponse.json();

    if (!refreshResponse.ok || !refreshData.access_token) {
      console.error('Erro ao renovar token:', refreshData);
      throw new Error('Falha ao renovar o token longo do Instagram.');
    }

    const newToken = refreshData.access_token;
    const expiresIn = refreshData.expires_in || 5184000;
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    // Atualizar no banco
    const { error: updateError } = await supabase.from('config').upsert({
      id: true,
      instagram_token: newToken,
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, expires_at: expiresAt.toISOString() });
  } catch (err: any) {
    console.error('Erro na renovação de token cron:', err);
    return NextResponse.json({ error: err.message || 'Erro desconhecido' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleRefresh(req);
}

export async function POST(req: Request) {
  return handleRefresh(req);
}
