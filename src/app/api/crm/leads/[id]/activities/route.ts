import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getProspeccaoClient } from '@/lib/prospeccao-client';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const client = getProspeccaoClient();
  if (!client) return NextResponse.json({ error: 'CRM não configurado.' }, { status: 503 });

  const { id } = await params;
  const { data, error } = await client
    .from('lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const client = getProspeccaoClient();
  if (!client) return NextResponse.json({ error: 'CRM não configurado.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const { body: noteText, channel } = body as { body?: string; channel?: string };

  if (!noteText?.trim()) {
    return NextResponse.json({ error: 'Nota vazia.' }, { status: 400 });
  }

  const { data, error } = await client
    .from('lead_activities')
    .insert({
      lead_id: id,
      channel: channel || 'nota',
      type: 'note',
      body: noteText.trim(),
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
