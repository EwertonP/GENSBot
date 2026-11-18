/** Banco de mentira só para testes: filtros eq/in/gte/lte/contains, order, limit, update, insert e count. Compara texto (ISO). */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Linha = Record<string, unknown>;

export function criarBancoFalso() {
  const tabelas: Record<string, Linha[]> = {};
  let seq = 0;

  function from(nome: string) {
    const filtros: Array<(l: Linha) => boolean> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let payload: Linha = {};
    let limite = Infinity;
    let ordem: { c: string; asc: boolean } | null = null;
    let contar = false;
    const linhas = () => (tabelas[nome] ??= []);
    const api: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => ((contar = !!o?.head), api),
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), api),
      in: (c: string, v: unknown[]) => (filtros.push((l) => v.includes(l[c])), api),
      gte: (c: string, v: string) => (filtros.push((l) => l[c] != null && String(l[c]) >= v), api),
      lte: (c: string, v: string) => (filtros.push((l) => l[c] != null && String(l[c]) <= v), api),
      contains: (c: string, v: Linha) => (filtros.push((l) => Object.entries(v).every(([k, x]) => (l[c] as Linha | undefined)?.[k] === x)), api),
      order: (c: string, o: { ascending: boolean }) => ((ordem = { c, asc: o.ascending }), api),
      limit: (n: number) => ((limite = n), api),
      update: (p: Linha) => ((op = 'update'), (payload = p), api),
      insert: (p: Linha) => ((op = 'insert'), (payload = p), api),
      maybeSingle: async () => ({ data: resolver().data[0] ?? null }),
      single: async () => ({ data: resolver().data[0] ?? null, error: null }),
      then: (res: (v: unknown) => void) => res(resolver()),
    };
    function resolver(): { data: Linha[]; count: number } {
      if (op === 'insert') {
        const nova = { id: `id${++seq}`, status: 'pendente', criado_em: new Date().toISOString(), ...payload };
        linhas().push(nova);
        return { data: [nova], count: 1 };
      }
      let achadas = linhas().filter((l) => filtros.every((f) => f(l)));
      if (op === 'update') achadas.forEach((l) => Object.assign(l, payload));
      if (ordem) {
        const { c, asc } = ordem;
        achadas = [...achadas].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1));
      }
      const data = achadas.slice(0, limite);
      return { data, count: contar ? achadas.length : data.length };
    }
    return api;
  }
  return { db: { from } as unknown as SupabaseClient, tabelas };
}
