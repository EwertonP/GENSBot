import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';
import { getUserIdsInSameAgency } from '@/lib/instagram-account';

/** Lista o histórico de versões de uma automação (Fase 5), mais recente primeiro. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const agencyUserIds = await getUserIdsInSameAgency(user.id);
    const userIds = agencyUserIds.length > 0 ? agencyUserIds : [user.id];

    const { id } = await params;

    const { data, error } = await supabase
      .from('automation_versions')
      .select('id, version_number, label, created_at')
      .eq('automation_id', id)
      .in('user_id', userIds)
      .order('version_number', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
