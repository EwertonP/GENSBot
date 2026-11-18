/**
 * Integração de agenda por cliente (Cal.com). Os segredos nunca saem do servidor:
 * o segredo do webhook é gerado aqui e guardado cifrado; a chave de API entra pela
 * tela uma vez, é conferida e guardada cifrada. A tela só recebe a visão pública.
 */
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { criptografarSegredo, descriptografarSegredo, segredoDisponivel } from '@/lib/cripto';
import { urlWebhookAgenda } from '@/lib/url-publica';
import { API_BASE_CALCOM, apagarWebhookCalcom, apiBaseValida, criarWebhookCalcom, validarChaveCalcom } from './calcom-client';

export interface IntegracaoPublica {
  id: string;
  provedor: string;
  apiBase: string;
  ativo: boolean;
  temChave: boolean;
  webhookRegistrado: boolean;
  urlWebhook: string | null;
}

export type ResultadoIntegracao =
  | { ok: true; integracao: IntegracaoPublica; usuario?: string | null }
  | { ok: false; erro: string; status: number };

/** Token na URL (identifica a integração) e segredo (assina o corpo). Ambos aleatórios. */
export function gerarCredenciaisWebhook(): { token: string; segredo: string } {
  return { token: randomBytes(24).toString('base64url'), segredo: randomBytes(32).toString('hex') };
}

interface LinhaIntegracao {
  id: string;
  provedor: string;
  api_base: string;
  api_key_cifrada: string | null;
  webhook_token: string;
  webhook_secret_cifrado: string | null;
  calcom_webhook_id: string | null;
  ativo: boolean;
}

const COLUNAS = 'id, provedor, api_base, api_key_cifrada, webhook_token, webhook_secret_cifrado, calcom_webhook_id, ativo';

export function paraPublica(l: LinhaIntegracao): IntegracaoPublica {
  return {
    id: l.id,
    provedor: l.provedor,
    apiBase: l.api_base,
    ativo: l.ativo,
    temChave: Boolean(l.api_key_cifrada),
    webhookRegistrado: Boolean(l.calcom_webhook_id),
    urlWebhook: l.webhook_token ? urlWebhookAgenda(l.webhook_token) : null,
  };
}

export async function lerIntegracao(db: SupabaseClient, agenciaId: string, clienteId: string): Promise<LinhaIntegracao | null> {
  const { data } = await db
    .from('agenda_integracoes')
    .select(COLUNAS)
    .eq('agencia_id', agenciaId)
    .eq('cliente_id', clienteId)
    .eq('provedor', 'calcom')
    .maybeSingle();
  return (data as LinhaIntegracao | null) ?? null;
}

export async function conectarAgenda({
  db,
  agenciaId,
  clienteId,
  apiKey,
  apiBase,
}: {
  db: SupabaseClient;
  agenciaId: string;
  clienteId: string;
  apiKey: string;
  apiBase?: string | null;
}): Promise<ResultadoIntegracao> {
  if (!segredoDisponivel()) return { ok: false, status: 503, erro: 'Cifra de segredos não configurada no servidor (AI_KEYS_SECRET).' };

  const chave = apiKey.trim();
  if (chave.length < 16) return { ok: false, status: 400, erro: 'Informe a chave de API do Cal.com.' };
  const base = apiBaseValida(apiBase || API_BASE_CALCOM);
  if (!base) return { ok: false, status: 400, erro: 'Endereço da API inválido: use https com nome de domínio.' };

  // 1. Confere a chave antes de guardar qualquer coisa.
  const valida = await validarChaveCalcom(base, chave);
  if (!valida.ok) return { ok: false, status: 400, erro: valida.erro };

  // 2. Reconectar apaga o webhook antigo antes de criar o novo (sem empilhar duplicados).
  const atual = await lerIntegracao(db, agenciaId, clienteId);
  if (atual?.calcom_webhook_id) {
    const chaveAntiga = descriptografarSegredo(atual.api_key_cifrada);
    const baseAntiga = apiBaseValida(atual.api_base) ?? base;
    if (chaveAntiga) await apagarWebhookCalcom(baseAntiga, chaveAntiga, atual.calcom_webhook_id);
  }

  // 3. Segredo novo a cada conexão; o token do endereço se mantém para não quebrar nada.
  const novas = gerarCredenciaisWebhook();
  const token = atual?.webhook_token ?? novas.token;
  const criado = await criarWebhookCalcom(base, chave, { subscriberUrl: urlWebhookAgenda(token), secret: novas.segredo });

  const linha = {
    agencia_id: agenciaId,
    cliente_id: clienteId,
    provedor: 'calcom',
    api_base: base,
    api_key_cifrada: criptografarSegredo(chave),
    webhook_token: token,
    webhook_secret_cifrado: criptografarSegredo(novas.segredo),
    calcom_webhook_id: criado.ok ? criado.id : null,
    // Só fica ativa se o Cal.com aceitou o webhook; senão guardamos a chave, mas inativa.
    ativo: criado.ok,
    atualizado_em: new Date().toISOString(),
  };
  const { data, error } = await db.from('agenda_integracoes').upsert(linha, { onConflict: 'cliente_id,provedor' }).select(COLUNAS).single();
  if (error || !data) return { ok: false, status: 500, erro: 'Não foi possível salvar a integração.' };
  if (!criado.ok) return { ok: false, status: 502, erro: criado.erro };

  return { ok: true, integracao: paraPublica(data as LinhaIntegracao), usuario: valida.username };
}

export async function desconectarAgenda({ db, agenciaId, clienteId }: { db: SupabaseClient; agenciaId: string; clienteId: string }): Promise<ResultadoIntegracao | { ok: true; integracao: null }> {
  const atual = await lerIntegracao(db, agenciaId, clienteId);
  if (!atual) return { ok: true, integracao: null };

  // Se não der para apagar no Cal.com, avisa em vez de dizer que desconectou.
  let apagado = true;
  if (atual.calcom_webhook_id) {
    const chave = descriptografarSegredo(atual.api_key_cifrada);
    const base = apiBaseValida(atual.api_base);
    apagado = Boolean(chave && base && (await apagarWebhookCalcom(base, chave, atual.calcom_webhook_id)));
  }

  const { error } = await db
    .from('agenda_integracoes')
    .update({ ativo: false, api_key_cifrada: null, webhook_secret_cifrado: null, calcom_webhook_id: apagado ? null : atual.calcom_webhook_id, atualizado_em: new Date().toISOString() })
    .eq('id', atual.id)
    .eq('agencia_id', agenciaId);
  if (error) return { ok: false, status: 500, erro: 'Não foi possível desconectar.' };
  if (!apagado) return { ok: false, status: 502, erro: 'Desconectei aqui, mas não consegui apagar o webhook no Cal.com. Apague-o manualmente em Developer > Webhooks.' };
  return { ok: true, integracao: null };
}
