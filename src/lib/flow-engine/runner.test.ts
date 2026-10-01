import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase falso: `select().eq().maybeSingle()` devolve o contato da vez e todo
// `update(...)` fica registrado (com os filtros usados) pra conferir o que o runner gravou.
const state: {
  contact: Record<string, unknown> | null;
  updates: Record<string, unknown>[];
  updateFilters: [string, unknown][][];
  inserts: [string, Record<string, unknown>][];
} = {
  contact: null,
  updates: [],
  updateFilters: [],
  inserts: [],
};

vi.mock('@/lib/supabase', () => {
  const chain = (table: string): Record<string, unknown> => {
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
    c.insert = async (values: Record<string, unknown>) => {
      state.inserts.push([table, values]);
      return { error: null };
    };
    return c;
  };
  return { supabase: { from: (table: string) => chain(table) } };
});

vi.mock('@/lib/external-webhook', () => ({ triggerExternalWebhook: vi.fn() }));

import { runFlow, resumeFlow, type FlowRunContext } from './runner';
import { defaultCaptureLeadConfig } from './captureLeadDefaults';
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
    state.inserts = [];
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

describe('Capturar Lead: material só sai depois da captura', () => {
  const config = defaultCaptureLeadConfig();
  const captureFlow = {
    id: 'auto-raiox',
    name: 'Raio-X',
    flow_definition: {
      nodes: [
        { id: 't', type: 'trigger', position: { x: 0, y: 0 }, data: { triggerTypes: ['comment', 'dm'], keywords: ['PMPE'], match_type: 'contains' } },
        { id: 'cap', type: 'captureLead', position: { x: 0, y: 0 }, data: config },
        { id: 'link', type: 'sendMessage', position: { x: 0, y: 0 }, data: { text: 'Aqui está o Raio-X', link_url: 'https://raio-x.pdf', link_button_label: 'Baixar' } },
      ],
      edges: [
        { id: 'e1', source: 't', target: 'cap' },
        { id: 'e2', source: 'cap', target: 'link', sourceHandle: 'done' },
      ],
    },
  } as unknown as Automation;

  const sentTexts = () =>
    state.inserts
      .filter(([table, v]) => table === 'queue' && v.type === 'flow_send')
      .map(([, v]) => {
        const msg = (v.payload as { message: { text?: string; attachment?: { payload: { text: string } } } }).message;
        return msg.text ?? msg.attachment?.payload.text;
      });

  beforeEach(() => {
    state.contact = null;
    state.updates = [];
    state.updateFilters = [];
    state.inserts = [];
  });

  it('ao entrar, pergunta o e-mail e pausa no bloco sem mandar o link', async () => {
    state.contact = { instagram_id: '111', username: 'fulano', name: null, tags: [], flow_state: {} };
    await runFlow(captureFlow, ctx());
    expect(sentTexts()).toEqual([config.askText.email]);
    const pause = state.updates.find((u) => u.flow_node_id === 'cap');
    expect((pause?.flow_state as { _capture: { field: string } })._capture.field).toBe('email');
  });

  it('e-mail inválido: avisa e continua sem entregar', async () => {
    state.contact = {
      instagram_id: '111', name: null, tags: [], flow_node_id: 'cap', flow_run_id: 'run',
      flow_state: { _capture: { node_id: 'cap', field: 'email', attempts: 0, collected: [] } },
    };
    await resumeFlow(captureFlow, ctx({ text: 'não tenho', triggerType: 'dm', recipientRef: { id: '111' } }), 'cap', 'reply');
    expect(sentTexts()).toEqual([config.invalidText.email]);
    expect(state.inserts.some(([table]) => table === 'analytics_events')).toBe(false);
  });

  it('último dado válido: grava, registra lead_captured e só então manda o link', async () => {
    state.contact = {
      instagram_id: '111', name: null, tags: [], email: 'fulano@gmail.com', flow_node_id: 'cap', flow_run_id: 'run',
      flow_state: { cargo: 'Soldado', _capture: { node_id: 'cap', field: 'phone', attempts: 0, collected: ['email'] } },
    };
    await resumeFlow(captureFlow, ctx({ text: '(81) 99999-8888', triggerType: 'dm', recipientRef: { id: '111' } }), 'cap', 'reply');

    const saved = state.updates.find((u) => 'phone' in u);
    expect(saved?.phone).toBe('+5581999998888');
    // respostas de outras perguntas continuam; o estado interno do bloco sai
    expect(saved?.flow_state).toEqual({ cargo: 'Soldado' });
    expect(state.inserts.find(([table]) => table === 'analytics_events')?.[1].event_type).toBe('lead_captured');
    expect(sentTexts()).toEqual(['Aqui está o Raio-X']);
  });

  it('quem já deu e-mail e telefone antes recebe o link direto', async () => {
    state.contact = { instagram_id: '111', username: 'fulano', name: null, tags: [], email: 'a@b.com', phone: '+5581999998888', flow_state: {} };
    await runFlow(captureFlow, ctx());
    expect(sentTexts()).toEqual(['Aqui está o Raio-X']);
    expect(state.inserts.some(([table]) => table === 'analytics_events')).toBe(false);
  });

  it('sumiu: primeiro timeout manda o lembrete e continua esperando', async () => {
    state.contact = {
      instagram_id: '111', name: null, tags: [], flow_node_id: 'cap', flow_run_id: 'run',
      flow_state: { _capture: { node_id: 'cap', field: 'email', attempts: 0, collected: [] } },
    };
    await resumeFlow(captureFlow, ctx({ text: '', triggerType: 'dm', recipientRef: { id: '111' } }), 'cap', 'timeout');
    expect(sentTexts()).toEqual([config.reminderText]);
    expect((state.updates[0].flow_state as { _capture: { reminded: boolean } })._capture.reminded).toBe(true);
  });
});
