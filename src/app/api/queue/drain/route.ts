import { NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { drainQueue } from '@/lib/drain';

// Botão "Processar fila agora" do dashboard — chama a lógica de drenagem
// diretamente (sem HTTP interno) e exige usuário logado.
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const result = await drainQueue();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Erro no drenagem manual da fila:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
