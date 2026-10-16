import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { escolherSessaoEnvio, type SessaoWhatsApp } from './whatsapp-sessions';

const CLIENTE_A = 'cliente-a';
const CLIENTE_B = 'cliente-b';

const sessoes: SessaoWhatsApp[] = [
  { session_name: 'membro-ana', membro_id: 'ana', cliente_id: null },
  { session_name: 'membro-bia', membro_id: 'bia', cliente_id: null },
  { session_name: 'cliente-a', membro_id: null, cliente_id: CLIENTE_A },
  { session_name: 'agencia-1', membro_id: null, cliente_id: null },
];

describe('escolherSessaoEnvio', () => {
  it('equipe sem cliente usa a própria sessão, nunca a de outro membro', () => {
    const r = escolherSessaoEnvio(sessoes, { papel: 'master', membroId: 'bia', clienteId: null });
    expect(r?.session_name).toBe('membro-bia');
  });

  it('equipe sem sessão própria cai na geral da agência, não na de um colega', () => {
    const r = escolherSessaoEnvio(sessoes, { papel: 'master', membroId: 'carla', clienteId: null });
    expect(r?.session_name).toBe('agencia-1');
  });

  it('sem sessão própria nem geral não envia por ninguém', () => {
    const so = sessoes.filter((s) => s.session_name.startsWith('membro-'));
    expect(escolherSessaoEnvio(so, { papel: 'master', membroId: 'carla', clienteId: null })).toBeNull();
  });

  it('conversa de cliente usa a sessão do cliente, depois a geral', () => {
    expect(escolherSessaoEnvio(sessoes, { papel: 'master', membroId: 'ana', clienteId: CLIENTE_A })?.session_name).toBe('cliente-a');
    expect(escolherSessaoEnvio(sessoes, { papel: 'master', membroId: 'ana', clienteId: CLIENTE_B })?.session_name).toBe('agencia-1');
  });

  it('usuário do portal do cliente só enxerga a sessão do próprio cliente', () => {
    expect(escolherSessaoEnvio(sessoes, { papel: 'cliente', membroId: 'sec', clienteId: CLIENTE_A })?.session_name).toBe('cliente-a');
    expect(escolherSessaoEnvio(sessoes, { papel: 'cliente', membroId: 'sec', clienteId: CLIENTE_B })).toBeNull();
    expect(escolherSessaoEnvio(sessoes, { papel: 'cliente', membroId: 'sec', clienteId: null })).toBeNull();
  });
});
