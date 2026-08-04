import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDashboardMetrics, getTokenHealth, buildAlerts } from '@/lib/dashboard-metrics';
import { sendEmail } from '@/lib/email';

// Não repete o mesmo alerta por e-mail antes desse número de dias.
const RENOTIFY_AFTER_DAYS = 3;

async function handleCheckAlerts(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const { data: accountRows, error: accountsError } = await supabase
      .from('instagram_accounts')
      .select('user_id, instagram_user_id');

    if (accountsError) throw accountsError;

    const userIds = Array.from(new Set((accountRows || []).map(r => r.user_id)));
    const results: { userId: string; sent: boolean; alertCount: number }[] = [];

    for (const userId of userIds) {
      try {
        const tokenHealth = await getTokenHealth(userId);
        const accountIds = (accountRows || [])
          .filter(r => r.user_id === userId)
          .map(r => r.instagram_user_id);

        const metrics = await getDashboardMetrics(userId, accountIds);
        const allAlerts = buildAlerts(tokenHealth, metrics.health, metrics.automationsRaw, metrics.automationRanking, userId);

        if (allAlerts.length === 0) {
          results.push({ userId, sent: false, alertCount: 0 });
          continue;
        }

        // Filtra só os alertas que ainda não foram notificados recentemente
        const { data: recentNotifications } = await supabase
          .from('alert_notifications')
          .select('alert_key, last_sent_at')
          .eq('user_id', userId)
          .in('alert_key', allAlerts.map(a => a.key));

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - RENOTIFY_AFTER_DAYS);

        const recentKeys = new Set(
          (recentNotifications || [])
            .filter(n => new Date(n.last_sent_at) > cutoff)
            .map(n => n.alert_key)
        );

        const newAlerts = allAlerts.filter(a => !recentKeys.has(a.key));

        if (newAlerts.length === 0) {
          results.push({ userId, sent: false, alertCount: 0 });
          continue;
        }

        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        const email = authUser?.user?.email;

        if (!email) {
          results.push({ userId, sent: false, alertCount: newAlerts.length });
          continue;
        }

        const bulletList = newAlerts.map(a => `${a.level === 'critical' ? '🔴' : '🟡'} ${a.message}`).join('\n');
        const emailResult = await sendEmail({
          to: email,
          subject: `GENSBot: ${newAlerts.length} alerta(s) precisam da sua atenção`,
          text: `Encontramos os seguintes pontos de atenção nas suas contas conectadas:\n\n${bulletList}\n\nAcesse o dashboard do GENSBot para mais detalhes.`,
          html: `<p>Encontramos os seguintes pontos de atenção nas suas contas conectadas:</p><ul>${newAlerts.map(a => `<li>${a.level === 'critical' ? '🔴' : '🟡'} ${a.message}</li>`).join('')}</ul><p>Acesse o dashboard do GENSBot para mais detalhes.</p>`,
        });

        if (emailResult.ok) {
          await supabase.from('alert_notifications').upsert(
            newAlerts.map(a => ({ user_id: userId, alert_key: a.key, last_sent_at: new Date().toISOString() })),
            { onConflict: 'user_id,alert_key' }
          );
        }

        results.push({ userId, sent: emailResult.ok, alertCount: newAlerts.length });
      } catch (err: any) {
        console.error('Erro ao processar alertas do usuário', userId, err);
        results.push({ userId, sent: false, alertCount: -1 });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('Erro geral no check-alerts:', err);
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleCheckAlerts(req);
}

export async function POST(req: Request) {
  return handleCheckAlerts(req);
}
