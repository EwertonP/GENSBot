import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase as db } from '@/lib/supabase';
import { ETAPAS_ONBOARDING_PADRAO, type EtapaOnboarding } from '@/lib/clientes';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório.' }, { status: 400 });
  }

  try {
    const { data: link, error: linkErr } = await db
      .from('cliente_onboarding_links')
      .select('id, cliente_id, expira_em')
      .eq('token', token)
      .maybeSingle();

    if (linkErr) {
      if (linkErr.code === '42P01') {
        return NextResponse.json(
          { error: 'Tabela de onboarding não migrada.' },
          { status: 503 }
        );
      }
      throw linkErr;
    }

    if (!link) {
      return NextResponse.json(
        { error: 'Link de onboarding não encontrado ou expirado.' },
        { status: 404 }
      );
    }

    const agora = new Date().toISOString();

    // 1. Marca conclusão no link de onboarding
    await db
      .from('cliente_onboarding_links')
      .update({
        concluido_em: agora,
        atualizado_em: agora,
      })
      .eq('id', link.id);

    // 2. Busca o cliente para garantir token de portal e atualizar etapas de onboarding
    const { data: cliente } = await db
      .from('clientes')
      .select('id, token_portal, onboarding_etapas')
      .eq('id', link.cliente_id)
      .maybeSingle();

    let portalToken = cliente?.token_portal;
    if (!portalToken) {
      portalToken = crypto.randomBytes(16).toString('hex');
    }

    // Atualiza checklist operacional marcando acessos_coletados = true
    const etapasAtuais: EtapaOnboarding[] =
      Array.isArray(cliente?.onboarding_etapas) && cliente.onboarding_etapas.length > 0
        ? cliente.onboarding_etapas
        : ETAPAS_ONBOARDING_PADRAO;

    const novasEtapas = etapasAtuais.map((etapa) => {
      if (etapa.id === 'acessos_coletados') {
        return {
          ...etapa,
          concluida: true,
          concluida_em: etapa.concluida_em || agora,
        };
      }
      return etapa;
    });

    await db
      .from('clientes')
      .update({
        token_portal: portalToken,
        onboarding_etapas: novasEtapas,
        atualizado_em: agora,
      })
      .eq('id', link.cliente_id);

    return NextResponse.json({
      sucesso: true,
      token_portal: portalToken,
      portalUrl: `/portal/${portalToken}`,
    });
  } catch (err) {
    console.error('Erro na rota POST /api/onboarding/public/[token]/concluir:', err);
    return NextResponse.json(
      { error: 'Erro ao concluir onboarding.' },
      { status: 500 }
    );
  }
}
