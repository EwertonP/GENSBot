import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

/**
 * Restaura uma versão antiga como o flow_definition atual da automação.
 * Nunca é destrutivo: como o PUT de /api/automations/[id] sempre snapshota o
 * flow_definition anterior antes de sobrescrever, restaurar cria automaticamente
 * um novo snapshot do estado que estava valendo antes do restore.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { id, versionId } = await params;

    const { data: version, error: versionError } = await supabase
      .from('automation_versions')
      .select('flow_definition')
      .eq('id', versionId)
      .eq('automation_id', id)
      .eq('user_id', user.id)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Versão não encontrada.' }, { status: 404 });
    }

    const { data: current } = await supabase.from('automations').select('flow_definition, flow_version').eq('id', id).single();
    const previousVersion = current?.flow_version || 0;

    if (current?.flow_definition) {
      await supabase.from('automation_versions').insert({
        automation_id: id,
        user_id: user.id,
        version_number: previousVersion,
        flow_definition: current.flow_definition,
        label: 'Antes da restauração',
      });
    }

    const { data, error } = await supabase
      .from('automations')
      .update({
        flow_definition: version.flow_definition,
        flow_version: previousVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
