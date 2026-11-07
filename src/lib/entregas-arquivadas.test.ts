import { describe, expect, it } from 'vitest';
import { arquivadaComoDemanda, linhaArquivada } from './entregas-arquivadas';

const base = { id: 'd1', agencia_id: 'ag', cliente_id: 'c1', tipo: 'reel', titulo: 'Reels', status: 'publicado', mes_referencia: '2026-11-01', responsavel_id: 'm1', publicado_em: '2026-11-05T10:00:00Z' };

describe('linhaArquivada', () => {
  it('guarda só o que a produtividade precisa', () => {
    const l = linhaArquivada({ ...base, co_responsaveis_ids: ['m2', ''], scheduled_post_id: 'p1' })!;
    expect(l).toMatchObject({ id: 'd1', agencia_id: 'ag', cliente_id: 'c1', tipo: 'reel', concluida: true, co_responsaveis_ids: ['m2'], scheduled_post_id: 'p1' });
    expect(Object.keys(l)).not.toContain('legenda');
  });
  it('sem agência ou sem id não arquiva', () => {
    expect(linhaArquivada({ ...base, agencia_id: null })).toBeNull();
    expect(linhaArquivada({ ...base, id: '' })).toBeNull();
  });
  it('normaliza valores ausentes e corta título longo', () => {
    const l = linhaArquivada({ ...base, tipo: null, cliente_id: null, titulo: 'x'.repeat(300), mes_referencia: '2026-11-01T00:00:00Z' })!;
    expect(l.tipo).toBe('post');
    expect(l.cliente_id).toBeNull();
    expect(l.titulo!.length).toBe(200);
    expect(l.mes_referencia).toBe('2026-11-01');
    expect(l.co_responsaveis_ids).toEqual([]);
  });
});

describe('arquivadaComoDemanda', () => {
  it('vira uma demanda entregue, marcada como arquivada', () => {
    const d = arquivadaComoDemanda({ id: 'd1', tipo: 'carrossel', responsavel_id: 'm1', co_responsaveis_ids: ['m2'], cliente_id: 'c1', mes_referencia: '2026-11-01' });
    expect(d).toMatchObject({ id: 'd1', status: 'publicado', concluida: true, arquivada: true, tipo: 'carrossel', co_responsaveis_ids: ['m2'] });
  });
});
