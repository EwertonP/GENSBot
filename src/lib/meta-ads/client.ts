import { MetaAdAccount, MetaAdInsights, MetaCampaign, MetaCampaignStatus } from './types';

const GRAPH_BASE = 'https://graph.facebook.com/v25.0';

/**
 * Normaliza um ID de conta para garantir o prefixo "act_"
 */
export function normalizarAdAccountId(id: string): string {
  return id.startsWith('act_') ? id : `act_${id}`;
}

/**
 * Converte centavos da Meta para reais (R$)
 */
function centavosParaReais(centavos?: string | number | null): number | undefined {
  if (centavos === null || centavos === undefined) return undefined;
  const num = typeof centavos === 'string' ? parseFloat(centavos) : centavos;
  return isNaN(num) ? undefined : num / 100;
}

/**
 * Converte reais (R$) para centavos inteiros da Meta
 */
function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Extrai total de conversões (leads, mensagens ou compras) do array de actions da Meta
 */
function extrairConversoes(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions || !Array.isArray(actions)) return 0;
  const leadAction = actions.find((a) =>
    ['lead', 'contact', 'onsite_conversion.lead_grouped', 'onsite_conversion.messaging_conversation_started_7d'].includes(
      a.action_type
    )
  );
  if (leadAction) return parseInt(leadAction.value, 10) || 0;

  // Fallback para qualquer conversão registrada
  const total = actions.reduce((acc, curr) => acc + (parseInt(curr.value, 10) || 0), 0);
  return total;
}

/**
 * Extrai custo por conversão do array cost_per_action_type da Meta
 */
function extrairCustoPorConversao(
  costs?: Array<{ action_type: string; value: string }>,
  spendTotal = 0,
  conversoes = 0
): number {
  if (costs && Array.isArray(costs)) {
    const leadCost = costs.find((c) =>
      ['lead', 'contact', 'onsite_conversion.lead_grouped', 'onsite_conversion.messaging_conversation_started_7d'].includes(
        c.action_type
      )
    );
    if (leadCost) return parseFloat(leadCost.value) || 0;
  }
  return conversoes > 0 ? parseFloat((spendTotal / conversoes).toFixed(2)) : 0;
}

/**
 * Lista todas as contas de anúncios acessíveis pelo usuário logado
 */
export async function listarContasAnuncios(accessToken: string): Promise<MetaAdAccount[]> {
  const fields = 'id,account_id,name,account_status,currency,timezone_name';
  const url = `${GRAPH_BASE}/me/adaccounts?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Erro ao buscar contas de anúncios: ${data?.error?.message || res.statusText}`);
  }

  const rawList: any[] = data.data || [];
  return rawList.map((c) => ({
    id: c.id,
    accountId: c.account_id,
    name: c.name || `Conta ${c.account_id}`,
    accountStatus: c.account_status ?? 1,
    currency: c.currency || 'BRL',
    timezoneName: c.timezone_name || 'America/Sao_Paulo',
  }));
}

/**
 * Lista as campanhas de uma conta de anúncios específica
 */
export async function listarCampanhas(
  adAccountId: string,
  accessToken: string
): Promise<MetaCampaign[]> {
  const actId = normalizarAdAccountId(adAccountId);
  const fields = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,updated_time';
  const url = `${GRAPH_BASE}/${actId}/campaigns?fields=${fields}&limit=50&access_token=${encodeURIComponent(
    accessToken
  )}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Erro ao listar campanhas da conta ${actId}: ${data?.error?.message || res.statusText}`);
  }

  const rawList: any[] = data.data || [];
  return rawList.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status as MetaCampaignStatus,
    objective: c.objective || 'OUTCOME_TRAFFIC',
    dailyBudget: centavosParaReais(c.daily_budget),
    lifetimeBudget: centavosParaReais(c.lifetime_budget),
    startTime: c.start_time,
    stopTime: c.stop_time,
    updatedTime: c.updated_time,
  }));
}

/**
 * Puxa métricas e insights agregados da conta de anúncios
 * @param datePreset Padrões: 'this_month', 'last_30d', 'today', 'last_7d'
 */
export async function obterMetricasConta(
  adAccountId: string,
  accessToken: string,
  datePreset = 'this_month'
): Promise<MetaAdInsights> {
  const actId = normalizarAdAccountId(adAccountId);
  const fields = 'spend,impressions,reach,clicks,cpc,cpm,ctr,actions,cost_per_action_type';
  const url = `${GRAPH_BASE}/${actId}/insights?fields=${fields}&date_preset=${datePreset}&access_token=${encodeURIComponent(
    accessToken
  )}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Erro ao buscar métricas da conta ${actId}: ${data?.error?.message || res.statusText}`);
  }

  const item = (data.data && data.data[0]) || {};
  const spend = parseFloat(item.spend || '0');
  const conversoes = extrairConversoes(item.actions);

  return {
    spend,
    impressions: parseInt(item.impressions || '0', 10),
    reach: parseInt(item.reach || '0', 10),
    clicks: parseInt(item.clicks || '0', 10),
    cpc: parseFloat(item.cpc || '0'),
    cpm: parseFloat(item.cpm || '0'),
    ctr: parseFloat(item.ctr || '0'),
    conversions: conversoes,
    costPerConversion: extrairCustoPorConversao(item.cost_per_action_type, spend, conversoes),
    dateStart: item.date_start || '',
    dateStop: item.date_stop || '',
  };
}

/**
 * Atualiza o status de uma campanha (ex: Pausar ou Ativar)
 */
export async function alterarStatusCampanha(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED',
  accessToken: string
): Promise<boolean> {
  const url = `${GRAPH_BASE}/${campaignId}`;
  const params = new URLSearchParams({
    status,
    access_token: accessToken,
  });

  const res = await fetch(url, {
    method: 'POST',
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Erro ao alterar status da campanha: ${data?.error?.message || res.statusText}`);
  }

  return Boolean(data.success);
}

/**
 * Altera o orçamento diário de uma campanha (em Reais, ex: 50.00)
 */
export async function alterarOrcamentoCampanha(
  campaignId: string,
  orcamentoDiarioReais: number,
  accessToken: string
): Promise<boolean> {
  const dailyBudgetCents = reaisParaCentavos(orcamentoDiarioReais);
  const url = `${GRAPH_BASE}/${campaignId}`;
  const params = new URLSearchParams({
    daily_budget: String(dailyBudgetCents),
    access_token: accessToken,
  });

  const res = await fetch(url, {
    method: 'POST',
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Erro ao alterar orçamento da campanha: ${data?.error?.message || res.statusText}`);
  }

  return Boolean(data.success);
}
