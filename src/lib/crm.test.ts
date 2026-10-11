import { describe, it, expect } from 'vitest';
import {
  formatarMoeda,
  calcularDiasSemContato,
  normalizarWhatsApp,
  gerarLinkWhatsApp,
  calcularMetricasPipeline,
} from './crm';
import type { CrmNegocio } from '@/types/crm';

describe('CRM Helpers', () => {
  it('formata valores monetários em BRL', () => {
    expect(formatarMoeda(0)).toMatch(/R\$\s*0,00/);
    expect(formatarMoeda(1500)).toMatch(/R\$\s*1\.500,00/);
    expect(formatarMoeda(3500.5)).toMatch(/R\$\s*3\.500,50/);
  });

  it('normaliza números de WhatsApp para padrão internacional com DDI 55', () => {
    expect(normalizarWhatsApp('(81) 99999-8888')).toBe('5581999998888');
    expect(normalizarWhatsApp('5581999998888')).toBe('5581999998888');
    expect(normalizarWhatsApp('81999998888')).toBe('5581999998888');
    expect(normalizarWhatsApp('')).toBe('');
  });

  it('gera links válidos de wa.me com e sem mensagem', () => {
    expect(gerarLinkWhatsApp('81999998888')).toBe('https://wa.me/5581999998888');
    expect(gerarLinkWhatsApp('81999998888', 'Olá! Vi seu contato.')).toBe(
      'https://wa.me/5581999998888?text=Ol%C3%A1!%20Vi%20seu%20contato.'
    );
    expect(gerarLinkWhatsApp('')).toBe('');
  });

  it('calcula dias sem contato corretamente', () => {
    expect(calcularDiasSemContato(null)).toBe(0);
    expect(calcularDiasSemContato(undefined)).toBe(0);

    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(calcularDiasSemContato(tresDiasAtras)).toBe(3);
  });

  it('calcula métricas de funil corretamente', () => {
    const negociosMock: CrmNegocio[] = [
      {
        id: '1',
        agencia_id: 'ag1',
        cliente_id: null,
        pipeline_id: 'p1',
        estagio_id: 'e1',
        titulo: 'Negócio 1',
        valor: 1000,
        moeda: 'BRL',
        status: 'aberto',
        motivo_perda: null,
        data_conclusao: null,
        previsao_fechamento: null,
        probabilidade: null,
        nome_contato: 'Lead 1',
        telefone: '81999991111',
        email: 'lead1@test.com',
        instagram_username: null,
        empresa: null,
        cargo: null,
        contact_id: null,
        form_response_id: null,
        origem: 'manual',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        responsavel_id: null,
        prioridade: 'media',
        tags: [],
        ordem_no_estagio: 0,
        ultimo_contato_em: null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: '2',
        agencia_id: 'ag1',
        cliente_id: null,
        pipeline_id: 'p1',
        estagio_id: 'e2',
        titulo: 'Negócio 2',
        valor: 2000,
        moeda: 'BRL',
        status: 'aberto',
        motivo_perda: null,
        data_conclusao: null,
        previsao_fechamento: null,
        probabilidade: null,
        nome_contato: 'Lead 2',
        telefone: null,
        email: null,
        instagram_username: null,
        empresa: null,
        cargo: null,
        contact_id: null,
        form_response_id: null,
        origem: 'manual',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        responsavel_id: null,
        prioridade: 'alta',
        tags: [],
        ordem_no_estagio: 0,
        ultimo_contato_em: null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: '3',
        agencia_id: 'ag1',
        cliente_id: null,
        pipeline_id: 'p1',
        estagio_id: 'e3',
        titulo: 'Negócio 3',
        valor: 5000,
        moeda: 'BRL',
        status: 'ganho',
        motivo_perda: null,
        data_conclusao: new Date().toISOString(),
        previsao_fechamento: null,
        probabilidade: null,
        nome_contato: 'Lead 3',
        telefone: null,
        email: null,
        instagram_username: null,
        empresa: null,
        cargo: null,
        contact_id: null,
        form_response_id: null,
        origem: 'manual',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        responsavel_id: null,
        prioridade: 'media',
        tags: [],
        ordem_no_estagio: 0,
        ultimo_contato_em: null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
      {
        id: '4',
        agencia_id: 'ag1',
        cliente_id: null,
        pipeline_id: 'p1',
        estagio_id: 'e4',
        titulo: 'Negócio 4',
        valor: 3000,
        moeda: 'BRL',
        status: 'perdido',
        motivo_perda: 'Preço',
        data_conclusao: new Date().toISOString(),
        previsao_fechamento: null,
        probabilidade: null,
        nome_contato: 'Lead 4',
        telefone: null,
        email: null,
        instagram_username: null,
        empresa: null,
        cargo: null,
        contact_id: null,
        form_response_id: null,
        origem: 'manual',
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        responsavel_id: null,
        prioridade: 'baixa',
        tags: [],
        ordem_no_estagio: 0,
        ultimo_contato_em: null,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      },
    ];

    const metricas = calcularMetricasPipeline(negociosMock);
    expect(metricas.totalNegocios).toBe(4);
    expect(metricas.negociosAbertos).toBe(2);
    expect(metricas.negociosGanhos).toBe(1);
    expect(metricas.negociosPerdidos).toBe(1);
    expect(metricas.valorTotalAberto).toBe(3000);
    expect(metricas.valorTotalGanho).toBe(5000);
    expect(metricas.ticketMedio).toBe(5000);
    // 1 ganho / 2 finalizados = 50%
    expect(metricas.taxaConversao).toBe(50);
  });
});
