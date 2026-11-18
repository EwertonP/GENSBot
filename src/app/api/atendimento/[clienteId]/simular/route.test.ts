import { beforeEach, describe, expect, it, vi } from 'vitest';

const { contexto, cliente, propor, config } = vi.hoisted(() => ({ contexto: vi.fn(), cliente: vi.fn(), propor: vi.fn(), config: vi.fn() }));

vi.mock('@/lib/clientes-server', () => ({
  getContextoAgencia: contexto,
  respostaErro: (erro: string, status: number) => Response.json({ error: erro }, { status }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: cliente() }) }) }) }) }) },
}));
vi.mock('@/lib/atendimento/assistente', () => ({ proporResposta: propor }));
vi.mock('@/lib/atendimento/config', () => ({ lerConfig: config }));

import { POST } from './route';

const CLIENTE = '11111111-1111-1111-1111-111111111111';
const ctx = { params: Promise.resolve({ clienteId: CLIENTE }) };
const enviar = (corpo: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(corpo) }), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel: 'master', agencia_id: 'ag1' } } });
  cliente.mockReturnValue({ id: CLIENTE });
  config.mockResolvedValue({ resposta_min_segundos: 45, resposta_max_segundos: 180, horario_atendimento: {} });
  propor.mockResolvedValue({ tipo: 'responder', texto: 'Claro!' });
});

describe('POST /api/atendimento/[clienteId]/simular', () => {
  it('só o gestor simula (gasta a chave de IA do cliente)', async () => {
    contexto.mockResolvedValue({ ok: true, ctx: { membro: { papel: 'editor', agencia_id: 'ag1' } } });
    expect((await enviar({ mensagens: [{ de: 'paciente', texto: 'oi' }] })).status).toBe(403);
    expect(propor).not.toHaveBeenCalled();
  });

  it('devolve a proposta e o ritmo, convertendo a conversa em turnos, sem efeitos', async () => {
    const r = await enviar({ mensagens: [{ de: 'paciente', texto: 'oi' }, { de: 'ia', texto: 'Olá!' }, { de: 'paciente', texto: ' e o endereço? ' }] });
    expect(await r.json()).toEqual({ proposta: { tipo: 'responder', texto: 'Claro!' }, ritmo: { minSegundos: 45, maxSegundos: 180, dentroDoHorario: false } });
    expect(propor).toHaveBeenCalledWith(
      expect.objectContaining({
        agenciaId: 'ag1',
        clienteId: CLIENTE,
        messages: [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'Olá!' }, { role: 'user', content: 'e o endereço?' }],
      })
    );
  });

  it.each([
    ['sem mensagens', { mensagens: [] }],
    ['última da IA', { mensagens: [{ de: 'paciente', texto: 'oi' }, { de: 'ia', texto: 'olá' }] }],
    ['remetente inválido', { mensagens: [{ de: 'sistema', texto: 'oi' }] }],
    ['texto grande demais', { mensagens: [{ de: 'paciente', texto: 'x'.repeat(1001) }] }],
    ['conversa longa demais', { mensagens: Array.from({ length: 21 }, () => ({ de: 'paciente', texto: 'oi' })) }],
  ])('recusa %s', async (_nome, corpo) => {
    expect((await enviar(corpo)).status).toBe(400);
    expect(propor).not.toHaveBeenCalled();
  });

  it('erro da IA vira 502 sem vazar o motivo', async () => {
    propor.mockRejectedValue(new Error('API key sk-segredo inválida'));
    const r = await enviar({ mensagens: [{ de: 'paciente', texto: 'oi' }] });
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain('sk-segredo');
  });
});
