import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getActiveInstagramAccountForUser, listInstagramAccountsForUser, getUserIdsInSameAgency } from '@/lib/instagram-account';
import { buildUtmUrl } from '@/lib/utm';

function withShortUrl<T extends { short_code?: string | null }>(req: Request, link: T) {
  const origin = new URL(req.url).origin;
  return { ...link, short_url: link.short_code ? `${origin}/r/${link.short_code}` : null };
}

// GET: Antes listava TODOS os links UTM do usuário juntos, misturando clientes
// diferentes numa mesma tela — quem gerencia várias contas via um único login
// via o link de um cliente aparecendo pra outro. Agora escopa por conta, igual
// /api/contacts e /api/status: uma conta específica (ou a mais recente, se
// nenhuma vier na URL) por padrão, ou todas juntas só com `?account=all`.
export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const agencyUserIds = await getUserIdsInSameAgency(user.id);
    const userIds = agencyUserIds.length > 0 ? agencyUserIds : [user.id];

    const accountParam = new URL(req.url).searchParams.get('account');
    const isAggregate = accountParam === 'all';

    let accountIds: string[] = [];
    if (isAggregate) {
      const allAccounts = await listInstagramAccountsForUser(user.id);
      accountIds = allAccounts.map(a => a.instagram_user_id);
    } else {
      const account = await getActiveInstagramAccountForUser(user.id, accountParam);
      accountIds = account?.instagram_user_id ? [account.instagram_user_id] : [];
    }

    if (accountIds.length === 0) return NextResponse.json([]);

    const { data, error } = await supabase
      .from('utm_links')
      .select('*')
      .in('user_id', userIds)
      .in('instagram_user_id', accountIds)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Cliente de cada link: conta de Instagram do link -> cliente ligado a essa conta.
    const { data: contas } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_user_id, instagram_username')
      .in('instagram_user_id', accountIds);
    const contaIds = (contas || []).map(c => c.id);
    const { data: clientes } = contaIds.length
      ? await supabase.from('clientes').select('nome, cor, foto_url, instagram_account_id').in('instagram_account_id', contaIds)
      : { data: [] };
    const clientePorIgUser = new Map(
      (contas || []).map(c => {
        const cliente = (clientes || []).find(cl => cl.instagram_account_id === c.id);
        return [
          c.instagram_user_id,
          {
            nome: cliente?.nome || (c.instagram_username ? `@${c.instagram_username}` : null),
            cor: cliente?.cor || null,
            foto_url: cliente?.foto_url || null,
          },
        ];
      })
    );

    return NextResponse.json(
      (data || []).map(link => ({ ...withShortUrl(req, link), cliente: clientePorIgUser.get(link.instagram_user_id) || null }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    if (!body.base_url) {
      return NextResponse.json({ error: 'URL de destino é obrigatória.' }, { status: 400 });
    }

    let generatedUrl: string;
    try {
      generatedUrl = buildUtmUrl(body.base_url, {
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
        utm_term: body.utm_term,
        utm_content: body.utm_content,
      });
    } catch {
      return NextResponse.json({ error: 'URL de destino inválida.' }, { status: 400 });
    }

    const accountParam = new URL(req.url).searchParams.get('account');
    const config = await getActiveInstagramAccountForUser(user.id, accountParam);

    // Código curto pro redirect de rastreamento (src/app/r/[code]) — 6 chars em base36
    // (~2 bilhões de combinações) é suficiente pro volume deste produto; um retry
    // simples cobre a rara colisão em vez de precisar checar disponibilidade antes.
    let insertResult: { data: any; error: any } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = crypto.randomBytes(4).toString('hex').slice(0, 6);
      insertResult = await supabase
        .from('utm_links')
        .insert({
          user_id: user.id,
          instagram_user_id: config?.instagram_user_id || null,
          name: body.name || null,
          base_url: body.base_url,
          utm_source: body.utm_source || null,
          utm_medium: body.utm_medium || null,
          utm_campaign: body.utm_campaign || null,
          utm_term: body.utm_term || null,
          utm_content: body.utm_content || null,
          generated_url: generatedUrl,
          short_code: shortCode,
          automation_id: body.automation_id || null,
        })
        .select()
        .single();

      if (!insertResult.error || insertResult.error.code !== '23505') break;
    }

    if (!insertResult || insertResult.error) {
      return NextResponse.json({ error: insertResult?.error?.message || 'Erro ao gerar o link.' }, { status: 500 });
    }
    return NextResponse.json(withShortUrl(req, insertResult.data));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
