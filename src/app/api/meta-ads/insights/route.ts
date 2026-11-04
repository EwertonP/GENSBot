import { NextResponse } from 'next/server';
import { getContextoAgencia } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { normalizarAdAccountId, obterMetricasConta } from '@/lib/meta-ads/client';

async function obterTokenMeta(): Promise<string | null> {
  if (process.env.META_ADS_ACCESS_TOKEN) {
    return process.env.META_ADS_ACCESS_TOKEN;
  }
  const { data } = await serviceSupabase
    .from('instagram_accounts')
    .select('access_token')
    .not('access_token', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.access_token || null;
}

export async function GET(req: Request) {
  const ctx = await getContextoAgencia();
  if (!ctx.ok) return ctx.response;

  const { searchParams } = new URL(req.url);
  const adAccountId = searchParams.get('adAccountId');
  const datePreset = searchParams.get('datePreset') || 'this_month';

  if (!adAccountId) {
    return NextResponse.json({ error: 'Parâmetro adAccountId é obrigatório.' }, { status: 400 });
  }

  const token = await obterTokenMeta();
  if (!token) {
    return NextResponse.json({ error: 'Nenhum token Meta ativo disponível.' }, { status: 401 });
  }

  try {
    const insights = await obterMetricasConta(
      normalizarAdAccountId(adAccountId),
      token,
      datePreset
    );
    return NextResponse.json({ ok: true, insights });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar métricas de anúncios.' }, { status: 500 });
  }
}
