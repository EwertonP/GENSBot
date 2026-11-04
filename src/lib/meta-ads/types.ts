/**
 * Tipos para a integração com a Meta Marketing API (Meta Ads / Gerenciador de Anúncios).
 */

export interface MetaAdAccount {
  id: string; // Ex: "act_123456789"
  accountId: string; // Ex: "123456789"
  name: string;
  accountStatus: number; // 1 = ACTIVE, 2 = DISABLED, etc.
  currency: string; // Ex: "BRL"
  timezoneName: string;
}

export type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface MetaCampaign {
  id: string;
  name: string;
  status: MetaCampaignStatus;
  objective: string;
  dailyBudget?: number; // Valor em reais (R$)
  lifetimeBudget?: number;
  startTime?: string;
  stopTime?: string;
  updatedTime?: string;
}

export interface MetaAdInsights {
  spend: number; // Valor investido em R$
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number; // Custo por clique em R$
  cpm: number; // Custo por mil impressões em R$
  ctr: number; // Taxa de cliques (%)
  conversions: number; // Leads / mensagens / compras
  costPerConversion: number; // Custo por lead / conversão em R$
  dateStart: string;
  dateStop: string;
}
