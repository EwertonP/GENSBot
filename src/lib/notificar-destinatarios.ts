/**
 * Quem deve receber cada aviso. Centraliza a resolução para os pontos do
 * sistema não repetirem "responsável + co-responsáveis" nem esquecerem o
 * gestor. Todas devolvem ids de membros (que são os ids de usuário).
 */
import { supabase } from './supabase';

export interface QuemTrabalhaNaDemanda {
  responsavel_id?: string | null;
  co_responsaveis_ids?: string[] | null;
  editor_id?: string | null;
}

/** Responsável, co-responsáveis e editor da demanda, sem repetir nem deixar vazio. */
export function destinatariosDaDemanda(item: QuemTrabalhaNaDemanda, opcoes: { incluirEditor?: boolean } = {}): string[] {
  const ids = [item.responsavel_id, ...(Array.isArray(item.co_responsaveis_ids) ? item.co_responsaveis_ids : []), opcoes.incluirEditor ? item.editor_id : null];
  return [...new Set(ids.filter((i): i is string => typeof i === 'string' && i.length > 0))];
}

/** Gestores (master) ativos da agência. */
export async function gestoresDaAgencia(agenciaId: string | null | undefined): Promise<string[]> {
  if (!agenciaId) return [];
  try {
    const { data } = await supabase.from('membros').select('id').eq('agencia_id', agenciaId).eq('papel', 'master').eq('ativo', true);
    return (data || []).map((m: { id: string }) => m.id);
  } catch {
    return [];
  }
}

/** Agência de um membro (para achar os gestores a partir de quem é dono de uma conta). */
export async function agenciaDoMembro(membroId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('membros').select('agencia_id').eq('id', membroId).maybeSingle();
    return (data as { agencia_id?: string } | null)?.agencia_id ?? null;
  } catch {
    return null;
  }
}

/** Responsável fixo do cliente e os membros vinculados a ele. */
export async function equipeDoCliente(clienteId: string | null | undefined): Promise<string[]> {
  if (!clienteId) return [];
  try {
    const [{ data: cli }, { data: vinculos }] = await Promise.all([
      supabase.from('clientes').select('responsavel_fixo_id').eq('id', clienteId).maybeSingle(),
      supabase.from('membro_clientes').select('membro_id').eq('cliente_id', clienteId),
    ]);
    const ids = [(cli as { responsavel_fixo_id?: string | null } | null)?.responsavel_fixo_id, ...((vinculos || []) as { membro_id: string }[]).map((v) => v.membro_id)];
    return [...new Set(ids.filter((i): i is string => !!i))];
  } catch {
    return [];
  }
}

/** Une listas de destinatários sem repetir. */
export function unirDestinatarios(...listas: (string | null | undefined)[][]): string[] {
  return [...new Set(listas.flat().filter((i): i is string => !!i))];
}
