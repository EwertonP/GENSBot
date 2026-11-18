import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { validarCron } from '@/lib/segredos';
import { processarFila } from '@/lib/atendimento/fila';

export const maxDuration = 60;

/** Worker da fila de respostas do atendimento (encadeado pelo cron `drain`, a cada minuto). */
async function tratar(req: Request) {
  const negado = validarCron(req);
  if (negado) return negado;
  try {
    return NextResponse.json({ ok: true, ...(await processarFila({ db })) });
  } catch (err) {
    console.error('[Cron atendimento-fila] Falhou:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Falha interna no worker do atendimento.' }, { status: 500 });
  }
}

export const GET = tratar;
export const POST = tratar;
