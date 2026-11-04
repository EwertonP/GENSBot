import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listarContasAnuncios,
  listarCampanhas,
  obterMetricasConta,
  alterarStatusCampanha,
  alterarOrcamentoCampanha,
  normalizarAdAccountId,
} from './client';

describe('Meta Marketing Ads Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normaliza o ID da conta adicionando act_ se faltar', () => {
    expect(normalizarAdAccountId('123456')).toBe('act_123456');
    expect(normalizarAdAccountId('act_123456')).toBe('act_123456');
  });

  it('lista contas de anúncios com sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'act_101',
            account_id: '101',
            name: 'Cliente Alpha Ads',
            account_status: 1,
            currency: 'BRL',
            timezone_name: 'America/Sao_Paulo',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const contas = await listarContasAnuncios('token_teste');
    expect(contas).toHaveLength(1);
    expect(contas[0].name).toBe('Cliente Alpha Ads');
    expect(contas[0].id).toBe('act_101');
  });

  it('lista campanhas convertendo orçamentos em centavos para reais', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'cmp_1',
            name: 'Campanha de Tráfego - Reels',
            status: 'ACTIVE',
            objective: 'OUTCOME_TRAFFIC',
            daily_budget: '5000', // 5000 centavos = R$ 50,00
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const campanhas = await listarCampanhas('act_101', 'token_teste');
    expect(campanhas[0].dailyBudget).toBe(50);
    expect(campanhas[0].status).toBe('ACTIVE');
  });

  it('calcula métricas de insights, total de leads e CPA corretamente', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            spend: '1500.50',
            impressions: '45000',
            reach: '32000',
            clicks: '850',
            cpc: '1.76',
            cpm: '33.34',
            ctr: '1.88',
            actions: [
              { action_type: 'lead', value: '42' },
              { action_type: 'link_click', value: '850' },
            ],
            cost_per_action_type: [{ action_type: 'lead', value: '35.72' }],
            date_start: '2026-11-01',
            date_stop: '2026-11-04',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const insights = await obterMetricasConta('act_101', 'token_teste', 'this_month');
    expect(insights.spend).toBe(1500.50);
    expect(insights.conversions).toBe(42);
    expect(insights.costPerConversion).toBe(35.72);
    expect(insights.clicks).toBe(850);
  });

  it('altera status da campanha para PAUSED com sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await alterarStatusCampanha('cmp_1', 'PAUSED', 'token_teste');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('altera orçamento diário da campanha convertendo Reais para centavos', async () => {
    let capturedBody = '';
    const fetchMock = vi.fn().mockImplementationOnce(async (_url, options) => {
      capturedBody = options.body.toString();
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await alterarOrcamentoCampanha('cmp_1', 75.50, 'token_teste');
    expect(ok).toBe(true);
    // 75.50 reais -> 7550 centavos
    expect(capturedBody).toContain('daily_budget=7550');
  });
});
