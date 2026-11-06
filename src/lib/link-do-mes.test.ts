import { describe, expect, it } from 'vitest';
import {
  abaDaEtapa,
  escolherMes,
  etapaNoLinkDoMes,
  mesAtual,
  montarItemDoMes,
  normalizarMes,
  ordenarItensDoMes,
  type ItemBrutoDoMes,
} from './link-do-mes';

const base: ItemBrutoDoMes = {
  id: 'i1',
  tipo: 'reel',
  status: 'planejamento',
  titulo: 'Título',
  legenda: 'Legenda',
  briefing: 'Roteiro',
  mes_referencia: '2026-11-01',
  data_programada: '2026-11-10',
  publicado_em: null,
  ordem: 0,
  arquivos: [
    { id: 'b', url: 'b.jpg', tipo: 'imagem', ordem: 2 },
    { id: 'a', url: 'a.jpg', tipo: 'imagem', ordem: 1 },
  ],
  cover_url: 'capa.jpg',
  token_aprovacao: 'tok',
};

describe('etapaNoLinkDoMes', () => {
  it('planejamento mostra só texto', () => expect(etapaNoLinkDoMes('planejamento')).toBe('texto'));
  it('revisão do cliente vira aprovação', () => expect(etapaNoLinkDoMes('revisao_cliente')).toBe('aprovacao'));
  it('agendado e publicado vão para publicados', () => {
    for (const s of ['agendamento', 'pronto_publicar', 'revisao_agendamento', 'publicado'] as const) {
      expect(etapaNoLinkDoMes(s)).toBe('publicado');
    }
  });
  it('criação e revisão interna ficam ocultas', () => {
    for (const s of ['copy', 'criacao_arte', 'em_gravacao', 'em_edicao', 'revisao_arte', 'revisao_interna', 'travado'] as const) {
      expect(etapaNoLinkDoMes(s)).toBeNull();
    }
  });
  it('abas', () => {
    expect(abaDaEtapa('texto')).toBe('para_voce');
    expect(abaDaEtapa('aprovacao')).toBe('para_voce');
    expect(abaDaEtapa('publicado')).toBe('publicados');
  });
});

describe('montarItemDoMes', () => {
  it('em planejamento não vaza arte nem token', () => {
    const r = montarItemDoMes(base)!;
    expect(r.etapa).toBe('texto');
    expect(r.arquivos).toEqual([]);
    expect(r.cover_url).toBeNull();
    expect(r.token_aprovacao).toBeNull();
    expect(r.pode_agir).toBe(false);
    expect(r.briefing).toBe('Roteiro');
  });

  it('em aprovação traz mídia ordenada e o token', () => {
    const r = montarItemDoMes({ ...base, status: 'revisao_cliente' })!;
    expect(r.arquivos.map((a) => a.id)).toEqual(['a', 'b']);
    expect(r.cover_url).toBe('capa.jpg');
    expect(r.token_aprovacao).toBe('tok');
    expect(r.pode_agir).toBe(true);
  });

  it('publicado traz mídia mas não token', () => {
    const r = montarItemDoMes({ ...base, status: 'publicado', publicado_em: '2026-11-10T12:00:00Z' })!;
    expect(r.aba).toBe('publicados');
    expect(r.arquivos).toHaveLength(2);
    expect(r.token_aprovacao).toBeNull();
    expect(r.pode_agir).toBe(false);
  });

  it('oculta em criação, escondido do cliente e arquivado', () => {
    expect(montarItemDoMes({ ...base, status: 'criacao_arte' })).toBeNull();
    expect(montarItemDoMes({ ...base, visivel_cliente: false })).toBeNull();
    expect(montarItemDoMes({ ...base, arquivada_em: '2026-11-02T00:00:00Z' })).toBeNull();
  });

  it('descarta arquivos sem url', () => {
    const r = montarItemDoMes({ ...base, status: 'revisao_cliente', arquivos: [{ id: 'x', url: '', tipo: 'imagem', ordem: 0 }, { id: 'y', url: 'y.jpg', tipo: 'imagem', ordem: 1 }] })!;
    expect(r.arquivos.map((a) => a.id)).toEqual(['y']);
  });

  it('aceita arquivos nulos', () => {
    expect(montarItemDoMes({ ...base, status: 'revisao_cliente', arquivos: null })!.arquivos).toEqual([]);
  });
});

describe('meses', () => {
  it('normaliza formatos', () => {
    expect(normalizarMes('2026-11')).toBe('2026-11-01');
    expect(normalizarMes('2026-11-15')).toBe('2026-11-01');
    expect(normalizarMes('2026-13')).toBeNull();
    expect(normalizarMes('abc')).toBeNull();
    expect(normalizarMes(null)).toBeNull();
  });

  it('mês atual usa Brasília', () => {
    // 01/12 02:00 UTC ainda é 30/11 em Brasília
    expect(mesAtual(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11-01');
    expect(mesAtual(new Date('2026-12-01T12:00:00Z'))).toBe('2026-12-01');
  });

  it('escolhe o pedido, o atual ou o mais recente com itens', () => {
    const agora = new Date('2026-11-15T12:00:00Z');
    expect(escolherMes('2026-10', ['2026-11-01'], agora)).toBe('2026-10-01');
    expect(escolherMes(null, ['2026-10-01', '2026-11-01'], agora)).toBe('2026-11-01');
    expect(escolherMes(null, ['2026-09-01', '2026-10-01'], agora)).toBe('2026-10-01');
    expect(escolherMes(null, [], agora)).toBe('2026-11-01');
  });
});

describe('ordenarItensDoMes', () => {
  it('por data, sem data no fim, depois pela ordem', () => {
    const itens = [
      { id: 'a', data_programada: null },
      { id: 'b', data_programada: '2026-11-12' },
      { id: 'c', data_programada: '2026-11-05' },
      { id: 'd', data_programada: null },
    ];
    const ordem = new Map([['a', 2], ['d', 1]]);
    expect(ordenarItensDoMes(itens, ordem).map((i) => i.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});
