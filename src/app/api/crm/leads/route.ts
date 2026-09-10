import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getProspeccaoClient } from '@/lib/prospeccao-client';

// Ferramenta interna única da agência (sem client_id no schema do Prospecção
// Gens) — qualquer usuário autenticado no GENSBot pode ver o CRM inteiro,
// sem escopo por conta de Instagram como o resto do app.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  const client = getProspeccaoClient();
  if (!client) {
    return NextResponse.json(
      { error: 'CRM não configurado. Faltam PROSPECCAO_SUPABASE_URL/PROSPECCAO_SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.' },
      { status: 503 }
    );
  }

  const { data, error } = await client
    .from('leads')
    .select('id, name, category, city, state, phone, whatsapp_phone, instagram_handle, email, google_rating, score, status, created_at')
    .order('score', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
