import { beforeEach, describe, expect, it, vi } from 'vitest';

type Linha = Record<string, unknown>;
const { enviar, ler } = vi.hoisted(() => ({ enviar: vi.fn(), ler: vi.fn() }));
vi.mock('@/lib/openwa-client', () => ({
  enviarMensagemOpenWA: enviar,
  marcarComoLidoOpenWA: ler,
  montarConfigOpenWA: (url: string, key: string) => ({ url, key, headers: {} }),
}));
vi.mock('@/lib/cripto', () => ({ descriptografarSegredo: (v?: string | null) => v ?? null }));

import type { SupabaseClient } from '@supabase/supabase-js';
import { enfileirarResposta, processarFila } from './fila';

const tabelas: Record<string, Linha[]> = {};
let seq = 0;

/** Banco de mentira: filtros eq/in/gte/lte, order, limit, update, insert, count. Compara texto (ISO). */
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
      const nova = { id: `id${++seq}`, status: 'pendente', ...payload };
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
const db = { from } as unknown as SupabaseClient;

const AG = 'ag1';
const CL = 'cl1';
const REM = '5583999990001@c.us';
const seg9h = new Date('2026-11-23T12:00:00Z'); // segunda, 09h em São Paulo
const t = (segundos: number) => new Date(seg9h.getTime() + segundos * 1000).toISOString();

const config = (o: Linha = {}): Linha => ({
  agencia_id: AG,
  cliente_id: CL,
  ligado: true,
  modo: 'simulacao',
  sessao_nome: 'laisleal',
  openwa_url: 'https://wa.exemplo.com.br',
  openwa_key_cifrada: 'chave',
  horario_atendimento: { seg: [{ de: '08:00', ate: '19:00' }] },
  resposta_min_segundos: 45,
  resposta_max_segundos: 180,
  limite_respostas_hora: 12,
  pausa_humano_horas: 6,
  ...o,
});
const paciente = (quando: string, id = 'p1'): Linha => ({ agencia_id: AG, cliente_id: CL, remetente: REM, de_mim: false, message_id: id, timestamp_msg: quando });
const pendente = (o: Linha = {}): Linha => ({ id: 'f1', agencia_id: AG, cliente_id: CL, remetente: REM, texto: 'Olá! Posso ajudar?', status: 'pendente', enviar_em: t(-10), criado_em: t(-120), ...o });
const rodar = () => processarFila({ db, agora: seg9h, dormir: async () => {}, aleatorio: () => 0 });

beforeEach(() => {
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  vi.clearAllMocks();
  enviar.mockResolvedValue({ ok: true, messageId: 'owa-1' });
  tabelas.atendimento_config = [config()];
  tabelas.whatsapp_mensagens = [paciente(t(-300))];
  tabelas.atendimento_fila = [pendente()];
  tabelas.whatsapp_ia_acoes = [];
});

describe('enfileirarResposta', () => {
  it('grava com atraso entre o mínimo e o máximo e substitui a pendente do mesmo contato', async () => {
    tabelas.atendimento_fila = [pendente({ id: 'velha' })];
    const r = await enfileirarResposta({ db, agenciaId: AG, clienteId: CL, remetente: REM, texto: 'nova', agora: seg9h, aleatorio: 0 });
    expect(r).toMatchObject({ ok: true, enviarEm: t(45) });
    const velha = tabelas.atendimento_fila.find((l) => l.id === 'velha')!;
    expect(velha).toMatchObject({ status: 'descartada', motivo: 'substituida' });
    expect(tabelas.atendimento_fila.filter((l) => l.status === 'pendente')).toHaveLength(1);
  });
  it('nunca para grupo e exige configuração', async () => {
    expect(await enfileirarResposta({ db, agenciaId: AG, clienteId: CL, remetente: '1203@g.us', texto: 'x' })).toEqual({ ok: false, erro: 'grupo' });
    tabelas.atendimento_config = [];
    expect(await enfileirarResposta({ db, agenciaId: AG, clienteId: CL, remetente: REM, texto: 'x' })).toEqual({ ok: false, erro: 'sem_config' });
  });
});

describe('processarFila', () => {
  it('simulação: não envia, marca simulada e registra em whatsapp_ia_acoes', async () => {
    expect(await rodar()).toMatchObject({ simuladas: 1, enviadas: 0 });
    expect(enviar).not.toHaveBeenCalled();
    expect(tabelas.atendimento_fila[0].status).toBe('simulada');
    expect(tabelas.whatsapp_ia_acoes[0]).toMatchObject({ acao: 'atendimento_simulado', resumo_detectado: 'Olá! Posso ajudar?' });
  });

  it('ainda não venceu: não toca', async () => {
    tabelas.atendimento_fila = [pendente({ enviar_em: t(30) })];
    expect(await rodar()).toMatchObject({ vistas: 0 });
    expect(tabelas.atendimento_fila[0].status).toBe('pendente');
  });

  it('real: lê, envia pelo OpenWA do cliente, guarda o message_id e não reenvia na próxima rodada', async () => {
    tabelas.atendimento_config = [config({ modo: 'real' })];
    expect(await rodar()).toMatchObject({ enviadas: 1 });
    expect(ler).toHaveBeenCalledWith(expect.objectContaining({ sessionName: 'laisleal', chatId: REM }));
    expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ sessionName: 'laisleal', para: REM, config: expect.objectContaining({ url: 'https://wa.exemplo.com.br' }) }));
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'enviada', message_id: 'owa-1' });
    await rodar();
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('real sem OpenWA do cliente: falha fechada, sem cair no do ambiente', async () => {
    tabelas.atendimento_config = [config({ modo: 'real', openwa_key_cifrada: null })];
    expect(await rodar()).toMatchObject({ falhas: 1 });
    expect(enviar).not.toHaveBeenCalled();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'falhou', motivo: 'sem_openwa_do_cliente' });
  });

  it('erro do OpenWA vira falha com o motivo', async () => {
    tabelas.atendimento_config = [config({ modo: 'real' })];
    enviar.mockResolvedValue({ ok: false, erro: 'sessão caiu' });
    await rodar();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'falhou', motivo: 'sessão caiu' });
  });

  it('descarta: desligado, paciente escreveu depois, sem mensagem do paciente', async () => {
    tabelas.atendimento_config = [config({ ligado: false })];
    await rodar();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'descartada', motivo: 'atendimento_desligado' });

    tabelas.atendimento_config = [config()];
    tabelas.atendimento_fila = [pendente()];
    tabelas.whatsapp_mensagens = [paciente(t(-60))]; // depois de criado_em (-120)
    await rodar();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ motivo: 'paciente_escreveu_depois' });

    tabelas.atendimento_fila = [pendente()];
    tabelas.whatsapp_mensagens = [];
    await rodar();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ motivo: 'paciente_nao_escreveu' });
  });

  it('secretária respondeu pelo celular: pausa; o eco da própria resposta do robô não conta', async () => {
    tabelas.whatsapp_mensagens = [paciente(t(-300)), { agencia_id: AG, cliente_id: CL, remetente: REM, de_mim: true, message_id: 'humana', timestamp_msg: t(-200) }];
    await rodar();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'descartada', motivo: 'humano_assumiu' });

    tabelas.atendimento_fila = [pendente({ id: 'anterior', status: 'enviada', message_id: 'eco-robo', processado_em: t(-3000) }), pendente({ id: 'f2' })];
    tabelas.whatsapp_mensagens = [paciente(t(-300)), { agencia_id: AG, cliente_id: CL, remetente: REM, de_mim: true, message_id: 'eco-robo', timestamp_msg: t(-200) }];
    await rodar();
    expect(tabelas.atendimento_fila.find((l) => l.id === 'f2')).toMatchObject({ status: 'simulada' });
  });

  it('fora do horário e acima do limite: adia 5 min e continua pendente', async () => {
    tabelas.atendimento_config = [config({ horario_atendimento: {} })];
    expect(await rodar()).toMatchObject({ adiadas: 1 });
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'pendente', motivo: 'fora_do_horario', enviar_em: t(300) });

    tabelas.atendimento_config = [config({ limite_respostas_hora: 1 })];
    tabelas.atendimento_fila = [pendente({ id: 'a', status: 'simulada', processado_em: t(-600), enviar_em: t(-900) }), pendente({ id: 'b' })];
    await rodar();
    expect(tabelas.atendimento_fila.find((l) => l.id === 'b')).toMatchObject({ status: 'pendente', motivo: 'limite_por_hora' });
  });

  it('isola por agência: config de outra agência não vale', async () => {
    tabelas.atendimento_config = [config({ agencia_id: 'outra' })];
    await rodar();
    expect(tabelas.atendimento_fila[0]).toMatchObject({ status: 'descartada', motivo: 'sem_config' });
  });
});
