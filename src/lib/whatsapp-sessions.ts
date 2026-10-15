import { supabase as serviceSupabase } from '@/lib/supabase';

export interface SessaoWhatsApp {
  session_name: string;
  membro_id: string | null;
  cliente_id: string | null;
}

interface CriterioEnvio {
  papel: string;
  membroId: string;
  clienteId: string | null;
}

/**
 * Escolhe de qual sessão uma mensagem manual deve sair. Nunca devolve a sessão
 * pessoal de outro membro:
 * - usuário do portal do cliente: só a sessão do próprio cliente;
 * - equipe numa conversa de cliente: sessão do cliente, depois a geral da agência;
 * - equipe sem cliente: a própria sessão, depois a geral da agência.
 */
export function escolherSessaoEnvio(
  sessoes: SessaoWhatsApp[],
  { papel, membroId, clienteId }: CriterioEnvio
): SessaoWhatsApp | null {
  const doCliente = clienteId ? sessoes.find((s) => s.cliente_id === clienteId) : undefined;
  const geral = sessoes.find((s) => !s.cliente_id && !s.membro_id);

  if (papel === 'cliente') return doCliente ?? null;
  if (clienteId) return doCliente ?? geral ?? null;
  return sessoes.find((s) => s.membro_id === membroId) ?? geral ?? null;
}

export async function carregarSessoesConectadas(agenciaId: string): Promise<SessaoWhatsApp[]> {
  const { data } = await serviceSupabase
    .from('whatsapp_sessions')
    .select('session_name, membro_id, cliente_id')
    .eq('agencia_id', agenciaId)
    .eq('status', 'conectado');
  return (data as SessaoWhatsApp[] | null) ?? [];
}
