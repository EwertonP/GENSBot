import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getProspeccaoClient } from '@/lib/prospeccao-client';

const LEAD_STATUSES = ['novo', 'qualificado', 'contatado', 'promovido', 'descartado'] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const client = getProspeccaoClient();
  if (!client) {
    return NextResponse.json({ error: 'CRM não configurado.' }, { status: 503 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status?: (typeof LEAD_STATUSES)[number] };

  if (status && !LEAD_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
  }

  const { data, error } = await client
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
