import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET || 'local_secret';
    
    // Obter host dinamicamente da requisição
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const url = `${protocol}://${host}/api/cron/drain`;

    // Chamar a API de cron do servidor passando a autorização segura
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      const text = await res.text();
      return NextResponse.json({ error: text || 'Erro ao processar a fila.' }, { status: res.status });
    }
  } catch (err: any) {
    console.error('Erro no proxy de drenagem manual da fila:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
