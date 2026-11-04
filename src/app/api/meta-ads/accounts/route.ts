import { NextResponse } from 'next/server';
import { getContextoAgencia } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { listarContasAnuncios } from '@/lib/meta-ads/client';
import { MetaAdAccount } from '@/lib/meta-ads/types';

export async function GET() {
  const ctx = await getContextoAgencia();
  if (!ctx.ok) return ctx.response;

  try {
    // 1. Busca tokens Meta disponíveis da agência
    const { data: contasMeta, error: errContas } = await serviceSupabase
      .from('instagram_accounts')
      .select('id, access_token, instagram_username')
      .not('access_token', 'is', null)
      .limit(20);

    if (errContas) throw errContas;

    if (!contasMeta || contasMeta.length === 0) {
      return NextResponse.json({
        ok: true,
        accounts: [],
        message: 'Nenhuma conta Meta conectada com token de acesso ativo.',
      });
    }

    const contasEncontradas = new Map<string, MetaAdAccount & { tokenFonteId: string }>();

    for (const c of contasMeta) {
      if (!c.access_token) continue;
      try {
        const adsList = await listarContasAnuncios(c.access_token);
        for (const ad of adsList) {
          if (!contasEncontradas.has(ad.id)) {
            contasEncontradas.set(ad.id, { ...ad, tokenFonteId: c.id });
          }
        }
      } catch (err: any) {
        // Token pode ter expirado ou usuário não ter contas de anúncio, ignora e segue
        console.warn(`[Meta Ads] Conta @${c.instagram_username} não retornou ad accounts:`, err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      accounts: Array.from(contasEncontradas.values()),
    });
  } catch (err: any) {
    console.error('[Meta Ads] Erro ao listar contas:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao carregar contas de anúncios do Meta Ads.' },
      { status: 500 }
    );
  }
}
