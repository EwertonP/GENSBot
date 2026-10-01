import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getUserIdsInSameAgency } from '@/lib/instagram-account';

/** Devolve o flow_definition completo de uma versão específica — usado pelo botão "Ver" (read-only) do histórico. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const agencyUserIds = await getUserIdsInSameAgency(user.id);
    const userIds = agencyUserIds.length > 0 ? agencyUserIds : [user.id];

    const { id, versionId } = await params;

    const { data, error } = await supabase
      .from('automation_versions')
      .select('*')
      .eq('id', versionId)
      .eq('automation_id', id)
      .in('user_id', userIds)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
