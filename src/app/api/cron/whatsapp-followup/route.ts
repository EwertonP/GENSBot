import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';

export const maxDuration = 60;

/**
 * Worker Cron para drenar a régua de follow-up do WhatsApp
 * Executa disparos agendados onde agendado_para <= NOW() e status = 'pendente'
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const agoraIso = new Date().toISOString();

    // 1. Busca até 15 follow-ups pendentes no horário
    const { data: followups, error } = await serviceSupabase
      .from('whatsapp_followups')
      .select('id, agencia_id, cliente_id, telefone, mensagem, etapa')
      .eq('status', 'pendente')
      .lte('agendado_para', agoraIso)
      .limit(15);

    if (error) throw error;
    if (!followups || followups.length === 0) {
      return NextResponse.json({ message: 'Nenhum follow-up pendente para envio.' });
    }

    const { enviarMensagemOpenWA } = await import('@/lib/openwa-client');
    let enviados = 0;

    for (const item of followups) {
      const sessionName = item.cliente_id ? `cliente-${item.cliente_id}` : `agencia-${item.agencia_id}`;

      try {
        const resultado = await enviarMensagemOpenWA({
          sessionName,
          para: item.telefone,
          texto: item.mensagem,
        });

        if (resultado.ok) {
          await serviceSupabase
            .from('whatsapp_followups')
            .update({
              status: 'enviado',
              enviado_em: new Date().toISOString(),
            })
            .eq('id', item.id);

          // Registra a mensagem enviada no histórico
          await serviceSupabase.from('whatsapp_mensagens').insert({
            agencia_id: item.agencia_id,
            cliente_id: item.cliente_id,
            remetente: item.telefone,
            de_mim: true,
            tipo: 'texto',
            conteudo: item.mensagem,
            timestamp_msg: new Date().toISOString(),
          });

          enviados++;
        }
      } catch (errItem) {
        console.error(`Erro ao disparar follow-up id ${item.id}:`, errItem);
      }
    }

    return NextResponse.json({ sucesso: true, total: followups.length, enviados });
  } catch (err: unknown) {
    console.error('Erro no cron de whatsapp-followup:', err);
    return NextResponse.json({ error: 'Falha interna no cron de follow-up.' }, { status: 500 });
  }
}
