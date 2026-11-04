import { NextResponse } from 'next/server';

/**
 * Endpoint de desautorização chamado pela Meta caso o usuário
 * revogue as permissões do aplicativo pelo aplicativo do Threads/Meta.
 */
export async function POST(req: Request) {
  try {
    return NextResponse.json({ success: true, message: 'Deauthorized' });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
