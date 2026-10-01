import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase falso: `select().eq().maybeSingle()` devolve o contato da vez e todo
// `update(...)` fica registrado (com os filtros usados) pra conferir o que o runner gravou.
const state: {
  contact: Record<string, unknown> | null;
  updates: Record<string, unknown>[];
  updateFilters: [string, unknown][][];
} = {
  contact: null,
  updates: [],
  updateFilters: [],
};

vi.mock('@/lib/supabase', () => {
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = async () => ({ data: state.contact, error: null });
    c.update = (values: Record<string, unknown>) => {
      state.updates.push(values);
      const filters: [string, unknown][] = [];
      state.updateFilters.push(filters);
      const filtered = {
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return filtered;
        },
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
      };
      return filtered;
    };
    c.insert = async () => ({ error: null });
    return c;
  };
  return { supabase: { from: () => chain() } };
});

vi.mock('@/lib/external-webhook', () => ({ triggerExternalWebhook: vi.fn() }));

import { runFlow, type FlowRunContext } from './runner';
import type { Automation } from '@/types/automation';

const automation = {
  id: 'auto-1',
  name: 'PMPE - Raio-X',
  flow_definition: {
    nodes: [{ id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { triggerTypes: ['comment', 'dm'], keywords: ['PMPE'], match_type: 'contains' } }],
    edges: [],
  },
} as unknown as Automation;

function ctx(overrides: Partial<FlowRunContext> = {}): FlowRunContext {
  return {
    ownerUserId: 'owner',
    instagramUserId: 'ig-conta',
    contactId: '111',
    text: 'quero PMPE',
    triggerType: 'comment',
    recipientRef: { comment_id: 'c1' },
    resolveProfile: vi.fn(async () => ({ username: null, name: null, profile_picture_url: null })),
    ...overrides,
  };
}

const savedUsername = () => state.updates.find((u) => 'username' in u)?.username;

describe('runFlow: @ do contato', () => {
  beforeEach(() => {
    state.contact = null;
    state.updates = [];
    state.updateFilters = [];
  });

  it('grava só na ficha da conta que recebeu a interação', async () => {
    state.contact = { instagram_id: '111', username: null, name: null, tags: [] };
    await runFlow(automation, ctx({ username: 'fulano.silva' }));
    expect(state.updateFilters.length).toBeGreaterThan(0);
    for (const filters of state.updateFilters) {
      expect(filters).toContainEqual(['instagram_user_id', 'ig-conta']);
      expect(filters).toContainEqual(['instagram_id', '111']);
    }
  });

  it('grava o @ que veio no comentário, mesmo sem a Graph API', async () => {
    state.contact = { instagram_id: '111', username: null, name: null, tags: [] };
    await runFlow(automation, ctx({ username: 'fulano.silva' }));
    expect(savedUsername()).toBe('fulano.silva');
  });

  it('nunca grava o IGSID como @ quando não acha o username', async () => {
    state.contact = { instagram_id: '111', username: null, name: null, tags: [] };
    await runFlow(automation, ctx({ triggerType: 'dm', recipientRef: { id: '111' } }));
    expect(savedUsername()).toBeNull();
  });

  it('busca o @ de novo quando o contato já tem nome mas o @ salvo é o IGSID', async () => {
    state.contact = { instagram_id: '111', username: '111', name: 'Fulano', tags: [] };
    const resolveProfile = vi.fn(async () => ({ username: 'fulano.silva', name: null, profile_picture_url: null }));
    await runFlow(automation, ctx({ triggerType: 'dm', recipientRef: { id: '111' }, resolveProfile }));
    expect(resolveProfile).toHaveBeenCalledOnce();
    expect(savedUsername()).toBe('fulano.silva');
  });
});
