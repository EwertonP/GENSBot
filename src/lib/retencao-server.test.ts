import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const cleanup = vi.fn(async () => []);
vi.mock('./storage-upload', () => ({ cleanupStorageMedia: (...a: unknown[]) => cleanup(...(a as [])) }));

import { limparConteudoPublicado } from './retencao-server';

const AGORA = new Date('2026-12-10T12:00:00Z');

function fakeDb(itens: unknown[], clientes: unknown[] | 'erro') {
  const apagados: string[][] = [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'lt', 'limit', 'in']) c[m] = () => c;
    c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return c;
  };
  const db = {
    from(tabela: string) {
      if (tabela === 'conteudo_items') {
        return {
          select: () => chain({ data: itens, error: null }),
          delete: () => ({
            in: (_c: string, ids: string[]) => {
              apagados.push(ids);
              return { eq: () => Promise.resolve({ error: null }) };
            },
          }),
        };
      }
      return { select: () => chain(clientes === 'erro' ? { data: null, error: { message: 'coluna' } } : { data: clientes, error: null }) };
    },
  };
  return { db: db as unknown as SupabaseClient, apagados };
}

describe('limparConteudoPublicado', () => {
  it('exclui só o que passou do prazo do cliente (padrão 30 dias)', async () => {
    const { db, apagados } = fakeDb(
      [
        { id: 'velho', publicado_em: '2026-11-01T00:00:00Z', arquivos: [], cliente_id: 'c1' }, // 39 dias
        { id: 'recente', publicado_em: '2026-11-25T00:00:00Z', arquivos: [], cliente_id: 'c1' }, // 15 dias
      ],
      [{ id: 'c1', retencao_texto_dias: null }]
    );
    const r = await limparConteudoPublicado(db, AGORA);
    expect(r.excluidas).toBe(1);
    expect(apagados).toEqual([['velho']]);
  });

  it('respeita o prazo configurado no cliente', async () => {
    const { db, apagados } = fakeDb(
      [{ id: 'x', publicado_em: '2026-11-25T00:00:00Z', arquivos: [], cliente_id: 'c2' }], // 15 dias
      [{ id: 'c2', retencao_texto_dias: 10 }]
    );
    expect((await limparConteudoPublicado(db, AGORA)).excluidas).toBe(1);
    expect(apagados).toEqual([['x']]);
  });

  it('sem a coluna do cliente, usa o padrão e não quebra', async () => {
    const { db, apagados } = fakeDb([{ id: 'v', publicado_em: '2026-10-01T00:00:00Z', arquivos: [], cliente_id: 'c3' }], 'erro');
    expect((await limparConteudoPublicado(db, AGORA)).excluidas).toBe(1);
    expect(apagados).toEqual([['v']]);
  });

  it('apaga mídia que sobrou antes de excluir a demanda', async () => {
    cleanup.mockClear();
    const arquivos = [{ id: 'a', url: 'https://x/post-media/a.jpg', tipo: 'imagem', ordem: 0 }];
    const { db } = fakeDb([{ id: 'm', publicado_em: '2026-10-01T00:00:00Z', arquivos, cliente_id: 'c1' }], [{ id: 'c1', retencao_texto_dias: null }]);
    await limparConteudoPublicado(db, AGORA);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('nada vencido: não exclui', async () => {
    const { db, apagados } = fakeDb([{ id: 'n', publicado_em: '2026-12-05T00:00:00Z', arquivos: [], cliente_id: 'c1' }], [{ id: 'c1', retencao_texto_dias: null }]);
    expect((await limparConteudoPublicado(db, AGORA)).excluidas).toBe(0);
    expect(apagados).toEqual([]);
  });
});
