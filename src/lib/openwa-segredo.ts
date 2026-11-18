/**
 * Segredo do webhook do OpenWA por cliente. Cada cliente que tem OpenWA próprio recebe um segredo
 * aleatório, guardado cifrado em atendimento_config e cadastrado só no OpenWA dele. O webhook
 * descobre de qual cliente é a sessão e exige o segredo desse cliente.
 */
import { randomBytes } from 'node:crypto';
import { descriptografarSegredo } from './cripto';
import { supabase } from './supabase';

export const gerarSegredoWebhook = () => randomBytes(32).toString('hex');

/**
 * O segredo próprio da sessão, ou null se a sessão não tem (usa o global). Erro de banco LANÇA:
 * quem chama recusa a requisição, para uma falha não deixar o segredo global valer numa sessão que tem o seu.
 */
export async function segredoDaSessao(sessionName: string): Promise<string | null> {
  const { data: sessao, error: e1 } = await supabase.from('whatsapp_sessions').select('agencia_id, cliente_id').eq('session_name', sessionName).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!sessao?.cliente_id) return null;
  const { data: cfg, error: e2 } = await supabase
    .from('atendimento_config')
    .select('openwa_webhook_secret_cifrado')
    .eq('agencia_id', sessao.agencia_id)
    .eq('cliente_id', sessao.cliente_id)
    .eq('sessao_nome', sessionName)
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  return descriptografarSegredo((cfg as { openwa_webhook_secret_cifrado?: string | null } | null)?.openwa_webhook_secret_cifrado) || null;
}
