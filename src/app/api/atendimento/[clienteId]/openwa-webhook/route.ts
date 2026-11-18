import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { exigirMasterDoCliente } from '@/lib/atendimento/acesso';
import { lerConfig } from '@/lib/atendimento/config';
import { criptografarSegredo, descriptografarSegredo, segredoDisponivel } from '@/lib/cripto';
import { gerarSegredoWebhook } from '@/lib/openwa-segredo';
import { configOpenWA } from '@/lib/openwa-config';
import { registrarWebhookOpenWA } from '@/lib/openwa-webhook';
import { urlWebhookWhatsapp } from '@/lib/url-publica';
import { respostaErro } from '@/lib/clientes-server';

type Contexto = { params: Promise<{ clienteId: string }> };

/**
 * Cadastra (ou atualiza) no OpenWA o webhook que entrega as mensagens da sessão do cliente.
 * O endereço vem de url-publica (nunca do host da requisição) para um preview não registrar o seu.
 */
export async function POST(req: Request, { params }: Contexto) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  const config = await lerConfig(db, acesso.agenciaId, acesso.clienteId);
  const sessionName = (config?.sessao_nome as string | null) ?? null;
  if (!sessionName) return respostaErro('Defina o nome da sessão do WhatsApp antes de cadastrar o webhook.', 400);

  // A sessão precisa existir e ser DESTE cliente: o webhook do WhatsApp acha a sessão só pelo nome,
  // então um nome sem linha vira "unknown_session" e um nome de outro cliente joga as mensagens no CRM dele.
  const { data: sessao } = await db
    .from('whatsapp_sessions')
    .select('id')
    .eq('session_name', sessionName)
    .eq('cliente_id', acesso.clienteId)
    .eq('agencia_id', acesso.agenciaId)
    .maybeSingle();
  if (!sessao) {
    return respostaErro(`Não há uma sessão de WhatsApp chamada "${sessionName}" cadastrada para este cliente. Crie a sessão primeiro.`, 409);
  }

  let openwa;
  try {
    openwa = await configOpenWA({ clienteId: acesso.clienteId, agenciaId: acesso.agenciaId });
  } catch (err) {
    return respostaErro(err instanceof Error ? err.message : 'Configuração do OpenWA indisponível.', 500);
  }
  // Nunca registra no OpenWA da agência (aprovações em produção): só no OpenWA próprio do cliente.
  if (openwa.origem !== 'cliente') {
    return respostaErro('Defina o endereço do OpenWA deste cliente antes de cadastrar o webhook. Esta tela não mexe no OpenWA da agência.', 400);
  }

  // Com o webhook ligado, o motor de escuta enviaria as mensagens ao provedor de IA global (OpenAI).
  // A política de privacidade só cita o Google, então a escuta por IA fica desligada até a etapa 4.
  const { error: erroEscuta } = await db
    .from('whatsapp_sessions')
    .update({ ia_escuta_ativa: false })
    .eq('id', sessao.id)
    .eq('agencia_id', acesso.agenciaId);
  if (erroEscuta) return respostaErro('Não consegui desligar a escuta por IA desta sessão; o webhook não foi cadastrado.', 500);

  // Segredo PRÓPRIO deste cliente (nunca o global): guardado cifrado, cadastrado só no OpenWA dele.
  // `girarSegredo` troca por um novo. Só grava no banco depois de o OpenWA aceitar; se algo falhar no
  // meio, repetir o cadastro resolve.
  if (!segredoDisponivel()) return respostaErro('Cifra de segredos não configurada no servidor (AI_KEYS_SECRET).', 503);
  const corpo = (await req.json().catch(() => ({}))) as { girarSegredo?: unknown };
  const existente = descriptografarSegredo(config?.openwa_webhook_secret_cifrado as string | null);
  const segredo = corpo.girarSegredo === true || !existente ? gerarSegredoWebhook() : existente;

  const r = await registrarWebhookOpenWA({
    sessionName,
    webhookUrl: urlWebhookWhatsapp(sessionName),
    segredo,
    config: openwa,
  });
  if (!r.ok) return respostaErro(r.erro, 502);

  const { error: erroGravar } = await db
    .from('atendimento_config')
    .update({ openwa_webhook_id: r.webhookId, openwa_webhook_secret_cifrado: criptografarSegredo(segredo), atualizado_em: new Date().toISOString() })
    .eq('cliente_id', acesso.clienteId)
    .eq('agencia_id', acesso.agenciaId);
  if (erroGravar) return respostaErro('O OpenWA aceitou o webhook, mas não consegui guardar o segredo. Cadastre de novo.', 500);

  return NextResponse.json({ ok: true, acao: r.acao, origem: openwa.origem, escutaIaDesligada: true, segredoProprio: true });
}
