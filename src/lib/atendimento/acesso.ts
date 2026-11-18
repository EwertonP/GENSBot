/**
 * Guarda das rotas de configuração do atendimento: só o master da agência, e só de
 * clientes que pertencem a ela. A service role ignora o RLS, então a conferência é explícita.
 */
import type { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { ehUuid } from '@/lib/clientes';
import { getContextoAgencia, respostaErro, type ContextoAgencia } from '@/lib/clientes-server';

export type AcessoAtendimento = { ok: true; ctx: ContextoAgencia; agenciaId: string; clienteId: string } | { ok: false; response: NextResponse };

export async function exigirMasterDoCliente(clienteId: string): Promise<AcessoAtendimento> {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth;

  if (auth.ctx.membro.papel !== 'master') {
    return { ok: false, response: respostaErro('Só o gestor da agência pode configurar o atendimento.', 403) };
  }
  if (!ehUuid(clienteId)) return { ok: false, response: respostaErro('Cliente inválido.', 400) };

  const agenciaId = auth.ctx.membro.agencia_id;
  const { data: cliente } = await db.from('clientes').select('id').eq('id', clienteId).eq('agencia_id', agenciaId).maybeSingle();
  if (!cliente) return { ok: false, response: respostaErro('Cliente não encontrado.', 404) };

  return { ok: true, ctx: auth.ctx, agenciaId, clienteId };
}
