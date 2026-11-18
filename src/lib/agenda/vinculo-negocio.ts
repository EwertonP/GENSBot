/**
 * Descobre a qual negócio do CRM uma reserva pertence: primeiro pelo código que o
 * link de agendamento carregava; se não houver, pelo telefone (ignorando formato
 * e o 9º dígito). Toda consulta filtra por agencia_id, porque a service role
 * ignora o RLS.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { mesmoTelefone } from '@/lib/telefone';

export interface NegocioCandidato {
  id: string;
  telefone: string | null;
  status: string;
  atualizado_em?: string | null;
}

/** Entre os negócios do mesmo telefone, prefere o aberto e, depois, o mexido por último. */
export function escolherNegocio(candidatos: NegocioCandidato[], telefone: string): string | null {
  const doMesmoNumero = candidatos.filter((n) => mesmoTelefone(n.telefone, telefone));
  if (doMesmoNumero.length === 0) return null;
  const ordenados = [...doMesmoNumero].sort((a, b) => {
    const aberto = Number(b.status === 'aberto') - Number(a.status === 'aberto');
    if (aberto !== 0) return aberto;
    return String(b.atualizado_em ?? '').localeCompare(String(a.atualizado_em ?? ''));
  });
  return ordenados[0].id;
}

export async function acharNegocioDaReserva(
  db: SupabaseClient,
  { agenciaId, clienteId, telefone, negocioId }: { agenciaId: string; clienteId: string; telefone: string; negocioId: string | null }
): Promise<string | null> {
  if (negocioId) {
    const { data } = await db.from('crm_negocios').select('id').eq('id', negocioId).eq('agencia_id', agenciaId).maybeSingle();
    if (data?.id) return data.id as string;
  }
  if (!telefone) return null;

  // Os 8 últimos dígitos estreitam a busca sem depender do 9º dígito nem do código do país.
  const { data } = await db
    .from('crm_negocios')
    .select('id, telefone, status, atualizado_em')
    .eq('agencia_id', agenciaId)
    .eq('cliente_id', clienteId)
    .ilike('telefone', `%${telefone.slice(-8)}%`)
    .limit(50);
  return escolherNegocio((data ?? []) as NegocioCandidato[], telefone);
}
