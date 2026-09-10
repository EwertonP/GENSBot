import { NextResponse } from 'next/server';
import { drainQueue } from '@/lib/drain';

// Mesmo padrão de src/app/api/instagram/publish/route.ts — sem isso a Vercel corta
// em 10s (padrão do plano Hobby), curto demais pra drenar uma fila maior.
export const maxDuration = 60;

async function handleDrain(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET || 'local_secret';

  // Permitir execução local sem auth se for desenvolvimento, senão validar token
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Não autorizado', { status: 401 });
  }

  try {
    const result = await drainQueue();
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
