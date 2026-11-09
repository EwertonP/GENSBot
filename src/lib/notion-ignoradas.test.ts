import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ignorarPaginasNotion, paginasNotionIgnoradas } from './notion-ignoradas';

function db(opcoes: { upsertErro?: boolean; selectErro?: boolean; linhas?: { notion_page_id: string }[] } = {}) {
  const upserts: Record<string, unknown>[][] = [];
  const client = {
    from: () => ({
      upsert: vi.fn(async (l: Record<string, unknown>[]) => {
        upserts.push(l);
        return { error: opcoes.upsertErro ? { message: 'x' } : null };
      }),
      select: () => ({ limit: async () => (opcoes.selectErro ? { data: null, error: { message: 'sem tabela' } } : { data: opcoes.linhas || [], error: null }) }),
    }),
  };
  return { db: client as unknown as SupabaseClient, upserts };
}

describe('ignorarPaginasNotion', () => {
  it('registra só demandas que vieram do Notion e têm agência', async () => {
    const { db: d, upserts } = db();
    await ignorarPaginasNotion(d, [
      { agencia_id: 'ag', cliente_id: 'c1', titulo: 'A', notion_page_id: 'n1' },
      { agencia_id: 'ag', titulo: 'B', notion_page_id: null },
      { agencia_id: null, titulo: 'C', notion_page_id: 'n3' },
    ]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toEqual([{ notion_page_id: 'n1', agencia_id: 'ag', cliente_id: 'c1', titulo: 'A' }]);
  });
  it('sem páginas do Notion não consulta o banco', async () => {
    const { db: d, upserts } = db();
    await ignorarPaginasNotion(d, [{ agencia_id: 'ag', notion_page_id: null }]);
    expect(upserts).toHaveLength(0);
  });
  it('nunca lança erro', async () => {
    const { db: d } = db({ upsertErro: true });
    await expect(ignorarPaginasNotion(d, [{ agencia_id: 'ag', notion_page_id: 'n1' }])).resolves.toBeUndefined();
  });
});

describe('paginasNotionIgnoradas', () => {
  it('devolve o conjunto de ids', async () => {
    const { db: d } = db({ linhas: [{ notion_page_id: 'n1' }, { notion_page_id: 'n2' }] });
    expect([...(await paginasNotionIgnoradas(d))].sort()).toEqual(['n1', 'n2']);
  });
  it('sem a tabela, ignora nada e não quebra a sincronização', async () => {
    const { db: d } = db({ selectErro: true });
    expect((await paginasNotionIgnoradas(d)).size).toBe(0);
  });
});
