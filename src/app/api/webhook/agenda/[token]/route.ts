import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { descriptografarSegredo } from '@/lib/cripto';
import { hashDoEvento, interpretarWebhookCalcom, verificarAssinaturaCalcom } from '@/lib/agenda/webhook-calcom';
import { acharNegocioDaReserva } from '@/lib/agenda/vinculo-negocio';

const TOKEN = /^[A-Za-z0-9_-]{24,80}$/;
const MAX_CORPO = 256 * 1024;

/**
 * Webhook do Cal.com. O token na URL identifica a integração (e, com ela, a agência e o
 * cliente); a assinatura `x-cal-signature-256` prova que o corpo veio do Cal.com.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: integ } = await db
    .from('agenda_integracoes')
    .select('id, agencia_id, cliente_id, webhook_secret_cifrado, ativo')
    .eq('webhook_token', token)
    .maybeSingle();
  if (!integ) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // A assinatura vale sobre o corpo exato: ler como texto antes de qualquer JSON.parse.
  const corpo = await req.text();
  if (corpo.length > MAX_CORPO) return NextResponse.json({ error: 'corpo_grande' }, { status: 413 });

  // Falha fechada: sem segredo configurado, ninguém entra.
  const segredo = descriptografarSegredo(integ.webhook_secret_cifrado);
  if (!segredo) return NextResponse.json({ error: 'segredo_nao_configurado' }, { status: 503 });
  if (!verificarAssinaturaCalcom(corpo, req.headers.get('x-cal-signature-256'), segredo)) {
    return NextResponse.json({ error: 'assinatura_invalida' }, { status: 401 });
  }
  if (!integ.ativo) return NextResponse.json({ ok: true, ignored: 'integracao_inativa' });

  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ error: 'json_invalido' }, { status: 400 });
  }
  const reserva = interpretarWebhookCalcom(json);
  if (!reserva) return NextResponse.json({ ok: true, ignored: 'evento_sem_reserva' });

  // O Cal.com reenvia o mesmo corpo em novas tentativas: processa uma vez só.
  const hash = hashDoEvento(corpo);
  const { data: novos } = await db
    .from('agenda_webhook_eventos')
    .upsert({ integracao_id: integ.id, hash }, { onConflict: 'integracao_id,hash', ignoreDuplicates: true })
    .select('id');
  if (!novos || novos.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  const { data: atual } = await db
    .from('agenda_reservas')
    .select('id, evento_em, negocio_id, inicio, fim, titulo, nome_contato, email, telefone')
    .eq('integracao_id', integ.id)
    .eq('agencia_id', integ.agencia_id)
    .eq('uid', reserva.uid)
    .maybeSingle();

  // Evento mais velho que o que já temos (chegou fora de ordem): não desfaz o estado novo.
  if (atual?.evento_em && reserva.eventoEm && Date.parse(reserva.eventoEm) < Date.parse(atual.evento_em)) {
    return NextResponse.json({ ok: true, ignored: 'evento_antigo' });
  }

  // O cancelamento chega sem o código do negócio: mantém o vínculo feito na criação.
  const negocioId =
    atual?.negocio_id ??
    (await acharNegocioDaReserva(db, {
      agenciaId: integ.agencia_id,
      clienteId: integ.cliente_id,
      telefone: reserva.telefone,
      negocioId: reserva.negocioId,
    }));

  const agora = new Date().toISOString();
  const { error } = await db.from('agenda_reservas').upsert(
    {
      agencia_id: integ.agencia_id,
      cliente_id: integ.cliente_id,
      integracao_id: integ.id,
      uid: reserva.uid,
      status: reserva.status,
      // Um evento incompleto (o cancelamento, por exemplo) não apaga o que já estava guardado.
      inicio: reserva.inicio ?? atual?.inicio ?? null,
      fim: reserva.fim ?? atual?.fim ?? null,
      titulo: reserva.titulo ?? atual?.titulo ?? null,
      nome_contato: reserva.nomeContato ?? atual?.nome_contato ?? null,
      email: reserva.email ?? atual?.email ?? null,
      telefone: reserva.telefone || atual?.telefone || null,
      negocio_id: negocioId,
      gatilho_ultimo: reserva.gatilho,
      evento_em: reserva.eventoEm,
      motivo_cancelamento: reserva.motivoCancelamento,
      remarcada_de_uid: reserva.remarcadaDeUid,
      atualizado_em: agora,
    },
    { onConflict: 'integracao_id,uid' }
  );

  if (error) {
    console.error('[Webhook agenda] Falha ao gravar a reserva:', error.message);
    // Libera o hash para a nova tentativa do Cal.com não ser tratada como repetida.
    await db.from('agenda_webhook_eventos').delete().eq('integracao_id', integ.id).eq('hash', hash);
    return NextResponse.json({ error: 'falha_ao_gravar' }, { status: 500 });
  }

  // Remarcação: a reserva antiga deixa de valer.
  if (reserva.remarcadaDeUid) {
    await db
      .from('agenda_reservas')
      .update({ status: 'remarcada', atualizado_em: agora })
      .eq('integracao_id', integ.id)
      .eq('agencia_id', integ.agencia_id)
      .eq('uid', reserva.remarcadaDeUid);
  }

  return NextResponse.json({ ok: true });
}
