import { describe, it, expect, vi } from 'vitest';

// Mesmo Supabase falso e genérico de ferramentas-c7/c8.test.ts.
const tabelas: Record<string, Record<string, unknown>[]> = {};

function builder(nome: string) {
  let rows = tabelas[nome] || [];
  const chain = {
    select: () => chain,
    order: (col: string, opts?: { ascending?: boolean }) => {
      rows = [...rows].sort((a, b) => {
        const diff = String(a[col]).localeCompare(String(b[col]));
        return opts?.ascending === false ? -diff : diff;
      });
      return chain;
    },
    limit: (n: number) => {
      rows = rows.slice(0, n);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return chain;
    },
    in: (col: string, val: unknown[]) => {
      rows = rows.filter((r) => val.includes(r[col]));
      return chain;
    },
    gte: (col: string, val: unknown) => {
      rows = rows.filter((r) => String(r[col]) >= String(val));
      return chain;
    },
    lte: (col: string, val: unknown) => {
      rows = rows.filter((r) => String(r[col]) <= String(val));
      return chain;
    },
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('../supabase', () => ({ supabase: { from: (nome: string) => builder(nome) } }));

import { FERRAMENTAS_C9 } from './ferramentas-c9';

const listar = FERRAMENTAS_C9[0];
const ctxMaster = { tokenId: 't', clientId: 'c', membroId: 'm1', agenciaId: 'ag1', papel: 'master' as const, nome: 'Dono' };

interface Resultado {
  conta: string;
  total: number;
  posts: { id: string; status: string; demanda: string | null; legenda: string | null }[];
}

function seed() {
  tabelas.membros = [{ id: 'm1', agencia_id: 'ag1' }];
  tabelas.instagram_accounts = [{ id: 'ia1', user_id: 'm1', instagram_user_id: 'ig123', instagram_username: 'edusaude' }];
  tabelas.scheduled_posts = [
    { id: 'p1', instagram_user_id: 'ig123', media_type: 'image', caption: 'Post 1', scheduled_at: '2026-10-02T10:00:00Z', status: 'scheduled', approval_status: 'agendado', error_message: null, published_at: null, location_name: null },
    { id: 'p2', instagram_user_id: 'ig123', media_type: 'video', caption: 'Post 2', scheduled_at: '2026-10-01T10:00:00Z', status: 'failed', approval_status: 'agendado', error_message: 'Token expirado', published_at: null, location_name: null },
    { id: 'p3', instagram_user_id: 'ig123', media_type: 'image', caption: 'Post 3 (já no ar)', scheduled_at: '2026-09-29T10:00:00Z', status: 'published', approval_status: 'publicado', error_message: null, published_at: '2026-09-29T10:05:00Z', location_name: null },
    // outra conta — não pode vazar
    { id: 'p4', instagram_user_id: 'ig999', media_type: 'image', caption: 'De outra conta', scheduled_at: '2026-10-03T10:00:00Z', status: 'scheduled', approval_status: 'agendado', error_message: null, published_at: null, location_name: null },
  ];
  tabelas.conteudo_items = [{ titulo: 'Carrossel de outubro', scheduled_post_id: 'p1' }];
}

describe('listar_fila_publicacao', () => {
  it('por padrão mostra só o que ainda não publicou, ordenado por agendamento', async () => {
    seed();
    const r = (await listar.executar({ conta: 'edusaude' }, ctxMaster)) as Resultado;
    expect(r.conta).toBe('edusaude');
    expect(r.posts.map((p) => p.id)).toEqual(['p2', 'p1']); // p2 (01/10) antes de p1 (02/10); p3 publicado fica de fora
    expect(r.total).toBe(2);
  });

  it('traz o título da demanda quando o post veio da esteira', async () => {
    seed();
    const r = (await listar.executar({ conta: 'edusaude' }, ctxMaster)) as Resultado;
    expect(r.posts.find((p) => p.id === 'p1')?.demanda).toBe('Carrossel de outubro');
    expect(r.posts.find((p) => p.id === 'p2')?.demanda).toBeNull();
  });

  it('status customizado inclui published', async () => {
    seed();
    const r = (await listar.executar({ conta: 'edusaude', status: ['published'] }, ctxMaster)) as Resultado;
    expect(r.posts.map((p) => p.id)).toEqual(['p3']);
    expect(r.posts[0].status).toBe('publicado');
  });

  it('status inválido é recusado', async () => {
    seed();
    await expect(listar.executar({ conta: 'edusaude', status: ['xyz'] }, ctxMaster)).rejects.toThrow(/inválido/);
  });

  it('não vaza posts de outra conta', async () => {
    seed();
    const r = (await listar.executar({ conta: 'edusaude', status: ['scheduled'] }, ctxMaster)) as Resultado;
    expect(r.posts.map((p) => p.id)).toEqual(['p1']);
  });

  it('filtra por desde/ate', async () => {
    seed();
    const r = (await listar.executar({ conta: 'edusaude', status: ['scheduled', 'failed'], desde: '2026-10-02T00:00:00Z' }, ctxMaster)) as Resultado;
    expect(r.posts.map((p) => p.id)).toEqual(['p1']);
  });

  it('"desde" inválido é recusado', async () => {
    seed();
    await expect(listar.executar({ conta: 'edusaude', desde: 'não é data' }, ctxMaster)).rejects.toThrow(/válida/);
  });
});
