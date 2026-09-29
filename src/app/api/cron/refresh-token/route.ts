import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cacheProfilePicture } from '@/lib/profile-picture';
import { sendEmail } from '@/lib/email';

// A Meta deixa renovar qualquer token com mais de 24h. Renovar com 30 dias de folga
// dá ~30 tentativas diárias antes de vencer se a renovação falhar.
const JANELA_RENOVACAO_DIAS = 30;

async function handleRefresh(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    // Renova toda conta cujo token vence nos próximos JANELA_RENOVACAO_DIAS dias
    // (um token novo tem 60 dias, então só entra aqui depois de ~30 dias de uso).
    const soon = new Date();
    soon.setDate(soon.getDate() + JANELA_RENOVACAO_DIAS);

    const { data: accounts, error: accountsError } = await supabase
      .from('instagram_accounts')
      .select('id, user_id, instagram_user_id, instagram_username, access_token, token_expires_at')
      .lte('token_expires_at', soon.toISOString());

    if (accountsError) throw accountsError;

    const results = [];
    const falhas: { user_id: string; conta: string; vence_em: string | null; motivo: string }[] = [];

    // `return` cedo aqui (versão anterior) impedia o loop de foto de perfil logo
    // abaixo de rodar sempre que nenhum token estivesse perto de expirar — ou
    // seja, quase sempre, já que o token dura 60 dias e a foto expira bem antes.
    if (!accounts || accounts.length === 0) {
      results.push({ status: 'nenhum_token_a_renovar' });
    } else {
      for (const account of accounts) {
        if (!account.access_token) {
          results.push({ instagram_user_id: account.instagram_user_id, status: 'skipped', reason: 'sem_token' });
          continue;
        }

        try {
          const refreshResponse = await fetch(
            `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${account.access_token}`
          );
          const refreshData = await refreshResponse.json();

          if (!refreshResponse.ok || !refreshData.access_token) {
            console.error('Erro ao renovar token:', account.instagram_user_id, refreshData);
            results.push({ instagram_user_id: account.instagram_user_id, status: 'failed', error: refreshData?.error?.message });
            falhas.push({
              user_id: account.user_id,
              conta: account.instagram_username || account.instagram_user_id,
              vence_em: account.token_expires_at,
              motivo: refreshData?.error?.message || `HTTP ${refreshResponse.status}`,
            });
            continue;
          }

          const expiresIn = refreshData.expires_in || 5184000;
          const expiresAt = new Date();
          expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

          const { error: updateError } = await supabase
            .from('instagram_accounts')
            .update({
              access_token: refreshData.access_token,
              token_expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', account.id);

          if (updateError) throw updateError;

          results.push({ instagram_user_id: account.instagram_user_id, status: 'refreshed', expires_at: expiresAt.toISOString() });
        } catch (err: any) {
          console.error('Erro ao renovar token da conta', account.instagram_user_id, err);
          results.push({ instagram_user_id: account.instagram_user_id, status: 'failed', error: err.message });
          falhas.push({
            user_id: account.user_id,
            conta: account.instagram_username || account.instagram_user_id,
            vence_em: account.token_expires_at,
            motivo: err.message || 'erro desconhecido',
          });
        }
      }
    }

    const avisos = await avisarFalhas(falhas);

    // Foto de perfil da Meta expira em poucos dias (bem antes do token), então
    // atualiza independente de expiração de token — pra toda conta, não só as
    // que entraram no filtro de renovação acima (ver cacheProfilePicture).
    const { data: allAccounts, error: allAccountsError } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_user_id, access_token');

    const photoResults: { instagram_user_id: string; status: string }[] = [];

    if (!allAccountsError && allAccounts) {
      for (const account of allAccounts) {
        if (!account.access_token) {
          photoResults.push({ instagram_user_id: account.instagram_user_id, status: 'sem_token' });
          continue;
        }

        const meResponse = await fetch(
          `https://graph.instagram.com/v25.0/me?fields=profile_picture_url&access_token=${account.access_token}`
        );
        if (!meResponse.ok) {
          photoResults.push({ instagram_user_id: account.instagram_user_id, status: 'falha_me' });
          continue;
        }
        const meData = await meResponse.json();

        const cachedUrl = await cacheProfilePicture(account.instagram_user_id, meData.profile_picture_url);
        if (!cachedUrl) {
          photoResults.push({ instagram_user_id: account.instagram_user_id, status: 'falha_cache' });
          continue;
        }

        await supabase
          .from('instagram_accounts')
          .update({ profile_picture_url: cachedUrl, updated_at: new Date().toISOString() })
          .eq('id', account.id);
        photoResults.push({ instagram_user_id: account.instagram_user_id, status: 'atualizada' });
      }
    }

    return NextResponse.json({ success: true, results, avisos, photoResults });
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

/**
 * Renovação que falha não pode ficar só no log: avisa o dono da conta por e-mail
 * (no máximo 1x por dia por conta, controlado em alert_notifications).
 */
async function avisarFalhas(falhas: { user_id: string; conta: string; vence_em: string | null; motivo: string }[]) {
  const avisos: { user_id: string; enviado: boolean }[] = [];
  const porDono = new Map<string, typeof falhas>();
  for (const f of falhas) porDono.set(f.user_id, [...(porDono.get(f.user_id) || []), f]);

  const umDiaAtras = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  for (const [userId, lista] of porDono) {
    const chaves = lista.map((f) => `token_refresh_falhou:${f.conta}`);
    const { data: recentes } = await supabase
      .from('alert_notifications')
      .select('alert_key')
      .eq('user_id', userId)
      .in('alert_key', chaves)
      .gte('last_sent_at', umDiaAtras);
    const jaAvisadas = new Set((recentes || []).map((r) => r.alert_key));
    const pendentes = lista.filter((f) => !jaAvisadas.has(`token_refresh_falhou:${f.conta}`));
    if (pendentes.length === 0) continue;

    const { data: dono } = await supabase.auth.admin.getUserById(userId);
    const email = dono?.user?.email;
    if (!email) {
      avisos.push({ user_id: userId, enviado: false });
      continue;
    }

    const linhas = pendentes.map((f) => {
      const vence = f.vence_em ? new Date(f.vence_em).toLocaleDateString('pt-BR') : 'data desconhecida';
      return `@${f.conta}: vence em ${vence} (${f.motivo})`;
    });
    const res = await sendEmail({
      to: email,
      subject: `GENSBot: a renovação do token do Instagram falhou (${pendentes.length} conta${pendentes.length > 1 ? 's' : ''})`,
      text: `A renovação automática do acesso ao Instagram falhou hoje:\n\n${linhas.join('\n')}\n\nO GENSBot tenta de novo todo dia. Se continuar falhando até a data de vencimento, a conta precisa ser reconectada em Clientes.`,
    });
    if (res.ok) {
      await supabase.from('alert_notifications').upsert(
        pendentes.map((f) => ({ user_id: userId, alert_key: `token_refresh_falhou:${f.conta}`, last_sent_at: new Date().toISOString() })),
        { onConflict: 'user_id,alert_key' }
      );
    }
    avisos.push({ user_id: userId, enviado: res.ok });
  }
  return avisos;
}
