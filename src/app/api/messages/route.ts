import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Buscar histórico de mensagens de um contato
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({ error: 'contact_id é obrigatório.' }, { status: 400 });
    }

    const { data: config } = await supabase.from('config').select('instagram_user_id').single();
    if (!config || !config.instagram_user_id) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .eq('instagram_user_id', config.instagram_user_id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Enviar mensagem direta (intervenção humana)
export async function POST(req: Request) {
  try {
    const { contact_id, text } = await req.json();

    if (!contact_id || !text) {
      return NextResponse.json({ error: 'contact_id e text são obrigatórios.' }, { status: 400 });
    }

    // 1. Buscar token ativo do Instagram
    const { data: config } = await supabase.from('config').select('*').single();
    if (!config || !config.instagram_token || !config.instagram_user_id) {
      return NextResponse.json({ error: 'Configuração ou token do Instagram não encontrado.' }, { status: 404 });
    }

    // 2. Enviar mensagem via Graph API da Meta
    const apiEndpoint = 'https://graph.instagram.com/v25.0/me/messages';
    const requestBody = {
      recipient: { id: contact_id },
      message: { text },
    };

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.instagram_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const resData = await res.json();

    if (!res.ok) {
      const errorMsg = resData.error?.message || 'Erro ao enviar mensagem pelo Instagram Graph API.';
      return NextResponse.json({ error: errorMsg }, { status: res.status });
    }

    // 3. Salvar no histórico como outbound
    const { data: message, error: dbError } = await supabase
      .from('messages')
      .insert({
        instagram_user_id: config.instagram_user_id,
        contact_id,
        direction: 'outbound',
        text,
        payload: resData,
      })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json(message);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
