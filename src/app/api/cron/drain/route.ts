import { NextResponse } from 'next/server';
import { drainQueue } from '@/lib/drain';
import { validarCron } from '@/lib/segredos';

// Mesmo padrão de src/app/api/instagram/publish/route.ts — sem isso a Vercel corta
// em 10s (padrão do plano Hobby), curto demais pra drenar uma fila maior.
export const maxDuration = 60;

async function handleDrain(req: Request) {
  const negado = validarCron(req);
  if (negado) return negado;
  const cronSecret = process.env.CRON_SECRET ?? '';

  try {
    const result = await drainQueue();

    // Drena também os follow-ups agendados do WhatsApp
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://allingens.vercel.app'}/api/cron/whatsapp-followup`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch(() => null);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Erro geral no drain worker:', err);
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleDrain(req);
}

export async function POST(req: Request) {
  return handleDrain(req);
}
