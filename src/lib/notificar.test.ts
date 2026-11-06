import { describe, it, expect, vi, beforeEach } from 'vitest';

const inseridas: Record<string, unknown>[] = [];
const pushes: { userId: string; tag?: string }[] = [];
let prefs: { user_id: string; push: boolean }[] = [];
let falharInsert = false;

vi.mock('./push', () => ({ enviarPush: vi.fn(async (userId: string, p: { tag?: string }) => { pushes.push({ userId, tag: p.tag }); return { enviados: 1, removidas: 0, falhas: 0 }; }) }));
vi.mock('./supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'notificacoes') return { insert: async (rows: Record<string, unknown>[]) => { if (falharInsert) throw new Error('banco fora'); inseridas.push(...rows); return {}; } };
      return { select: () => ({ eq: () => ({ in: async () => ({ data: prefs }) }) }) };
    },
  },
}));

import { notificar, tipoValido, TIPOS_NOTIFICACAO } from './notificar';

beforeEach(() => { inseridas.length = 0; pushes.length = 0; prefs = []; falharInsert = false; });

describe('notificar', () => {
  it('grava na central e manda push pelo padrão do tipo', async () => {
    await notificar(['u1', 'u2'], { tipo: 'post_falhou', titulo: 'Post não saiu', corpo: 'erro', url: '/?tab=publish' });
    expect(inseridas.map((r) => r.user_id)).toEqual(['u1', 'u2']);
    expect(pushes.map((p) => p.userId).sort()).toEqual(['u1', 'u2']);
  });

  it('tipo com push desligado por padrão só entra na central', async () => {
    await notificar('u1', { tipo: 'lead_novo', titulo: 'Novo lead' });
    expect(inseridas).toHaveLength(1);
    expect(pushes).toHaveLength(0);
  });

  it('preferência da pessoa vale mais que o padrão, nos dois sentidos', async () => {
    prefs = [{ user_id: 'u1', push: false }, { user_id: 'u2', push: true }];
    // post_falhou liga por padrão: u1 desligou, u2 mantém.
    await notificar(['u1', 'u2'], { tipo: 'post_falhou', titulo: 'x' });
    expect(pushes.map((p) => p.userId)).toEqual(['u2']);
    // lead_novo desliga por padrão: u2 ligou, u1 continua desligado.
    pushes.length = 0;
    await notificar(['u1', 'u2'], { tipo: 'lead_novo', titulo: 'x' });
    expect(pushes.map((p) => p.userId)).toEqual(['u2']);
  });

  it('não avisa quem fez a ação, nem destinatário vazio, nem repetido', async () => {
    await notificar(['u1', 'u1', null, undefined, 'u2'], { tipo: 'demanda_atribuida', titulo: 'x', exceto: 'u2' });
    expect(inseridas.map((r) => r.user_id)).toEqual(['u1']);
    await notificar(null, { tipo: 'demanda_atribuida', titulo: 'x' });
    expect(inseridas).toHaveLength(1);
  });

  it('nunca lança, mesmo com o banco fora', async () => {
    falharInsert = true;
    await expect(notificar('u1', { tipo: 'post_falhou', titulo: 'x' })).resolves.toBeUndefined();
    expect(pushes).toHaveLength(0);
  });

  it('corta textos longos e valida tipos', async () => {
    await notificar('u1', { tipo: 'post_falhou', titulo: 'T'.repeat(300), corpo: 'C'.repeat(900) });
    expect((inseridas[0].titulo as string).length).toBe(120);
    expect((inseridas[0].corpo as string).length).toBe(400);
    expect(tipoValido('lead_novo')).toBe(true);
    expect(tipoValido('cliente_sugeriu_texto')).toBe(true);
    expect(tipoValido('x')).toBe(false);
    expect(Object.keys(TIPOS_NOTIFICACAO)).toHaveLength(6);
  });
});
