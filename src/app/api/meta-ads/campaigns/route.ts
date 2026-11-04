import { NextResponse } from 'next/server';
import { getContextoAgencia } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import {
  alterarOrcamentoCampanha,
  alterarStatusCampanha,
  listarCampanhas,
  normalizarAdAccountId,
} from '@/lib/meta-ads/client';

async function obterTokenMeta(): Promise<string | null> {
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

  if (!adAccountId) {
    return NextResponse.json({ error: 'Parâmetro adAccountId é obrigatório.' }, { status: 400 });
  }

  const token = await obterTokenMeta();
  if (!token) {
    return NextResponse.json({ error: 'Nenhum token Meta ativo disponível.' }, { status: 401 });
  }

  try {
    const campanhas = await listarCampanhas(normalizarAdAccountId(adAccountId), token);
    return NextResponse.json({ ok: true, campanhas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar campanhas.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const ctx = await getContextoAgencia();
  if (!ctx.ok) return ctx.response;

  const body = await req.json();
  const { campaignId, status, dailyBudget } = body;

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId é obrigatório.' }, { status: 400 });
  }

  const token = await obterTokenMeta();
  if (!token) {
    return NextResponse.json({ error: 'Nenhum token Meta ativo disponível.' }, { status: 401 });
  }

  try {
    if (status && (status === 'ACTIVE' || status === 'PAUSED')) {
      await alterarStatusCampanha(campaignId, status, token);
    }

    if (typeof dailyBudget === 'number' && dailyBudget > 0) {
      await alterarOrcamentoCampanha(campaignId, dailyBudget, token);
    }

    return NextResponse.json({ ok: true, message: 'Campanha atualizada com sucesso.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao atualizar campanha.' }, { status: 500 });
  }
}
