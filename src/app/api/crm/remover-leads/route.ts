import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { key, ids } = await req.json();

    if (key !== 'gensbot-delete-leads-sem-whatsapp-2026') {
      return NextResponse.json({ erro: 'Chave de segurança inválida' }, { status: 401 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ erro: 'Lista de IDs vazia' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Primeiro remover atividades associadas aos negócios para manter integridade referencial
    const { error: errAtiv } = await supabase
      .from('crm_atividades')
      .delete()
      .in('negocio_id', ids);

    // Depois remover os negócios
    const { data: deletados, error: errNeg } = await supabase
      .from('crm_negocios')
      .delete()
      .in('id', ids)
      .select('id, titulo');

    if (errNeg) {
      return NextResponse.json({ erro: errNeg.message, errAtiv: errAtiv?.message }, { status: 500 });
    }

    return NextResponse.json({
      sucesso: true,
      total_deletados: deletados?.length || 0,
      deletados
    });
  } catch (err: any) {
    return NextResponse.json({ erro: err.message }, { status: 500 });
  }
}
