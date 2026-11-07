import { describe, expect, it } from 'vitest';
import {
  escolherMes,
  etapaMostraArte,
  etapaMostraRoteiro,
  etapaNoLinkDoMes,
  indiceDaEtapa,
  itemNoFiltro,
  mesAtual,
  mesDoItem,
  montarItemDoMes,
  normalizarMes,
  ordenarItensDoMes,
  ETAPAS_PROCESSO,
  type ItemBrutoDoMes,
} from './link-do-mes';

const base: ItemBrutoDoMes = {
  id: 'i1',
  tipo: 'reel',
  status: 'planejamento',
  titulo: '[Dra. Camila] [Reels] Título',
  legenda: 'Legenda',
  briefing: '## Fala\nRoteiro\n\n## 🎬 Produção visual\n- close',
  mes_referencia: '2026-11-01',
  data_programada: '2026-11-10T15:00:00+00:00',
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
  it('todas as colunas do kanban viram uma etapa do processo', () => {
    expect(etapaNoLinkDoMes('planejamento')).toBe('texto');
    for (const s of ['copy', 'criacao_arte', 'em_gravacao', 'em_edicao'] as const) expect(etapaNoLinkDoMes(s)).toBe('producao');
    for (const s of ['revisao_arte', 'revisao_interna', 'travado'] as const) expect(etapaNoLinkDoMes(s)).toBe('revisao');
    expect(etapaNoLinkDoMes('revisao_cliente')).toBe('aprovacao');
    for (const s of ['agendamento', 'revisao_agendamento', 'pronto_publicar'] as const) expect(etapaNoLinkDoMes(s)).toBe('agendado');
    expect(etapaNoLinkDoMes('publicado')).toBe('publicado');
  });

  it('a ordem do processo tem 6 etapas e cada uma tem índice', () => {
    expect(ETAPAS_PROCESSO).toHaveLength(6);
    expect(ETAPAS_PROCESSO.map((e) => indiceDaEtapa(e.etapa))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('roteiro some quando a arte aparece', () => {
    expect(['texto', 'producao', 'revisao'].map((e) => etapaMostraRoteiro(e as never))).toEqual([true, true, true]);
    expect(['aprovacao', 'agendado', 'publicado'].map((e) => etapaMostraRoteiro(e as never))).toEqual([false, false, false]);
  });

  it('arte só depois de pronta para a cliente', () => {
    expect(['texto', 'producao', 'revisao'].map((e) => etapaMostraArte(e as never))).toEqual([false, false, false]);
    expect(['aprovacao', 'agendado', 'publicado'].map((e) => etapaMostraArte(e as never))).toEqual([true, true, true]);
  });
});

describe('montarItemDoMes', () => {
  it('planejamento: sem arte nem token; título e roteiro sem notas internas; pode aprovar o texto', () => {
    const r = montarItemDoMes(base)!;
    expect(r.etapa).toBe('texto');
    expect(r.arquivos).toEqual([]);
    expect(r.cover_url).toBeNull();
    expect(r.token_aprovacao).toBeNull();
    expect(r.pode_agir).toBe(false);
    expect(r.pode_aprovar_texto).toBe(true);
    expect(r.precisa_de_voce).toBe(true);
    expect(r.titulo).toBe('Título');
    expect(r.briefing).toContain('Roteiro');
    expect(r.briefing).not.toContain('Produção visual');
  });

  it('texto já aprovado: não pede de novo, mas mostra quem aprovou', () => {
    const r = montarItemDoMes({ ...base, texto_aprovado_em: '2026-11-02T10:00:00Z', texto_aprovado_por: 'Camila' })!;
    expect(r.pode_aprovar_texto).toBe(false);
    expect(r.precisa_de_voce).toBe(false);
    expect(r.texto_aprovado_por).toBe('Camila');
  });

  it('produção e revisão interna aparecem, sem arte e sem ações', () => {
    for (const status of ['criacao_arte', 'em_gravacao', 'revisao_interna', 'travado'] as const) {
      const r = montarItemDoMes({ ...base, status })!;
      expect(r.arquivos).toEqual([]);
      expect(r.token_aprovacao).toBeNull();
      expect(r.precisa_de_voce).toBe(false);
      expect(r.pode_aprovar_texto).toBe(false);
    }
  });

  it('aprovação: mídia ordenada, token e ação; sem roteiro, com legenda', () => {
    const r = montarItemDoMes({ ...base, status: 'revisao_cliente' })!;
    expect(r.briefing).toBeNull();
    expect(r.legenda).toBe('Legenda');
    expect(r.arquivos.map((a) => a.id)).toEqual(['a', 'b']);
    expect(r.token_aprovacao).toBe('tok');
    expect(r.pode_agir).toBe(true);
    expect(r.precisa_de_voce).toBe(true);
  });

  it('agendado e publicado mostram a mídia, sem token e sem roteiro', () => {
    for (const status of ['agendamento', 'publicado'] as const) {
      const r = montarItemDoMes({ ...base, status })!;
      expect(r.briefing).toBeNull();
      expect(r.arquivos).toHaveLength(2);
      expect(r.token_aprovacao).toBeNull();
      expect(r.precisa_de_voce).toBe(false);
    }
  });

  it('oculta o que a agência escondeu ou arquivou', () => {
    expect(montarItemDoMes({ ...base, visivel_cliente: false })).toBeNull();
    expect(montarItemDoMes({ ...base, arquivada_em: '2026-11-02T00:00:00Z' })).toBeNull();
  });

  it('descarta arquivos sem url e aceita arquivos nulos', () => {
    const r = montarItemDoMes({ ...base, status: 'revisao_cliente', arquivos: [{ id: 'x', url: '', tipo: 'imagem', ordem: 0 }, { id: 'y', url: 'y.jpg', tipo: 'imagem', ordem: 1 }] })!;
    expect(r.arquivos.map((a) => a.id)).toEqual(['y']);
    expect(montarItemDoMes({ ...base, status: 'revisao_cliente', arquivos: null })!.arquivos).toEqual([]);
  });
});

describe('filtros', () => {
  const mk = (status: ItemBrutoDoMes['status']) => montarItemDoMes({ ...base, status })!;
  it('para você = o que depende dela; publicados = agendado e publicado; todos = tudo', () => {
    expect(itemNoFiltro(mk('planejamento'), 'para_voce')).toBe(true);
    expect(itemNoFiltro(mk('criacao_arte'), 'para_voce')).toBe(false);
    expect(itemNoFiltro(mk('revisao_cliente'), 'para_voce')).toBe(true);
    expect(itemNoFiltro(mk('agendamento'), 'publicados')).toBe(true);
    expect(itemNoFiltro(mk('publicado'), 'publicados')).toBe(true);
    expect(itemNoFiltro(mk('criacao_arte'), 'publicados')).toBe(false);
    expect(itemNoFiltro(mk('criacao_arte'), 'todos')).toBe(true);
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
    expect(mesAtual(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11-01');
    expect(mesAtual(new Date('2026-12-01T12:00:00Z'))).toBe('2026-12-01');
  });

  it('o mês do post é o da data programada, não o de referência', () => {
    expect(mesDoItem({ data_programada: '2026-12-03T15:00:00+00:00', mes_referencia: '2026-11-01' })).toBe('2026-12-01');
    expect(mesDoItem({ data_programada: '2026-11-30T23:30:00-03:00', mes_referencia: '2026-12-01' })).toBe('2026-11-01');
    expect(mesDoItem({ data_programada: '2026-12-10', mes_referencia: '2026-10-01' })).toBe('2026-12-01');
  });

  it('sem data usa o mês de referência', () => {
    expect(mesDoItem({ data_programada: null, mes_referencia: '2026-11-01' })).toBe('2026-11-01');
    expect(mesDoItem({ data_programada: 'lixo', mes_referencia: '2026-11-01' })).toBe('2026-11-01');
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
