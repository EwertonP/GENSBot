import { NextResponse } from 'next/server';
import { isR2Configured, deleteR2Objects } from '@/lib/r2';

export async function POST(req: Request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json({ success: true, deleted: [] });
    }

    const body = await req.json();
    const { urls } = body || {};

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: true, deleted: [] });
    }

    const deleted = await deleteR2Objects(urls);
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Erro na rota de deleção R2:', error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
