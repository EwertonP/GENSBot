import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { exigirMasterDoCliente } from '@/lib/atendimento/acesso';
import { lerConfig } from '@/lib/atendimento/config';
import { configOpenWA } from '@/lib/openwa-config';
import { registrarWebhookOpenWA } from '@/lib/openwa-webhook';
import { urlWebhookWhatsapp } from '@/lib/url-publica';
import { respostaErro } from '@/lib/clientes-server';

type Contexto = { params: Promise<{ clienteId: string }> };

/**
 * Cadastra (ou atualiza) no OpenWA o webhook que entrega as mensagens da sessão do cliente.
 * O endereço vem de url-publica (nunca do host da requisição) para um preview não registrar o seu.
 */
export async function POST(_req: Request, { params }: Contexto) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  const config = await lerConfig(db, acesso.agenciaId, acesso.clienteId);
  const sessionName = (config?.sessao_nome as string | null) ?? null;
  if (!sessionName) return respostaErro('Defina o nome da sessão do WhatsApp antes de cadastrar o webhook.', 400);

  let openwa;
  try {
    openwa = await configOpenWA({ clienteId: acesso.clienteId, agenciaId: acesso.agenciaId });
  } catch (err) {
    return respostaErro(err instanceof Error ? err.message : 'Configuração do OpenWA indisponível.', 500);
  }

  const r = await registrarWebhookOpenWA({
    sessionName,
    webhookUrl: urlWebhookWhatsapp(sessionName),
    segredo: process.env.OPENWA_WEBHOOK_SECRET,
    config: openwa,
  });
  if (!r.ok) return respostaErro(r.erro, 502);

  await db
    .from('atendimento_config')
    .update({ openwa_webhook_id: r.webhookId, atualizado_em: new Date().toISOString() })
    .eq('cliente_id', acesso.clienteId)
    .eq('agencia_id', acesso.agenciaId);

  return NextResponse.json({ ok: true, acao: r.acao, origem: openwa.origem });
}
