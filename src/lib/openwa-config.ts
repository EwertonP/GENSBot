/**
 * Qual OpenWA usar para um cliente.
 *
 * Se o cliente tem um OpenWA próprio em `atendimento_config` (a VPS da clínica),
 * usa ele; senão, o padrão das variáveis de ambiente (as aprovações da agência).
 *
 * Regra de segurança: com URL do cliente cadastrada, NUNCA cai no ambiente. Uma
 * falha (chave que não decifra, erro de banco) vira erro, não um envio pelo
 * número errado.
 */
import { supabase } from './supabase';
import { descriptografarSegredo } from './cripto';
import { getOpenWAConfig, montarConfigOpenWA, type ConfigOpenWA } from './openwa-client';

export type ConfigOpenWAResolvida = ConfigOpenWA & { origem: 'cliente' | 'ambiente' };

export async function configOpenWA({
  clienteId,
  agenciaId,
}: { clienteId?: string | null; agenciaId?: string | null } = {}): Promise<ConfigOpenWAResolvida> {
  if (!clienteId) return { ...getOpenWAConfig(), origem: 'ambiente' };

  let consulta = supabase.from('atendimento_config').select('openwa_url, openwa_key_cifrada').eq('cliente_id', clienteId);
  if (agenciaId) consulta = consulta.eq('agencia_id', agenciaId);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw new Error(`Não foi possível ler a configuração do OpenWA do cliente: ${error.message}`);

  if (!data?.openwa_url) return { ...getOpenWAConfig(), origem: 'ambiente' };

  const chave = data.openwa_key_cifrada ? descriptografarSegredo(data.openwa_key_cifrada) : null;
  if (data.openwa_key_cifrada && !chave) {
    throw new Error('A chave do OpenWA deste cliente não pôde ser lida (AI_KEYS_SECRET mudou?).');
  }
  return { ...montarConfigOpenWA(data.openwa_url, chave), origem: 'cliente' };
}
