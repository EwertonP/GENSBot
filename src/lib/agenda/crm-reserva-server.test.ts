import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const { avisar, equipe, gestores } = vi.hoisted(() => ({ avisar: vi.fn(), equipe: vi.fn(), gestores: vi.fn() }));
vi.mock('@/lib/crm', () => ({ garantirPipelinePadrao: vi.fn(async () => null) }));
vi.mock('@/lib/notificar', () => ({ notificar: avisar }));
vi.mock('@/lib/notificar-destinatarios', () => ({
  equipeDoCliente: equipe,
  gestoresDaAgencia: gestores,
  unirDestinatarios: (...listas: (string | null | undefined)[][]) => [...new Set(listas.flat().filter((i): i is string => !!i))],
}));

import { aplicarReservaNoCrm, pipelineParaNovoNegocio } from './crm-reserva-server';
import type { ReservaDoWebhook } from './webhook-calcom';

type Linha = Record<string, unknown>;
interface Chamada {
  tabela: string;
  op: string;
  filtros: Record<string, unknown>;
  payload?: Linha | Linha[];
  ordens: Array<[string, unknown]>;
}

const ESTAGIOS = [
  { id: 'e1', nome: 'Triagem & Interesse', ordem: 1, tipo_conclusao: 'aberto' },
  { id: 'e3', nome: 'Consulta Agendada', ordem: 3, tipo_conclusao: 'aberto' },
  { id: 'e5', nome: 'Procedimento Fechado', ordem: 5, tipo_conclusao: 'ganho' },
];

const estado = {
  ledger: [] as Linha[],
  negocio: null as Linha | null,
  outras: 0,
  tarefasRemarcar: [] as Linha[],
  tarefaExistente: [] as Linha[],
  falharEm: [] as string[],
  chamadas: [] as Chamada[],
};

function criarDb(): SupabaseClient {
  const from = (tabela: string) => {
    const filtros: Record<string, unknown> = {};
    const ordens: Array<[string, unknown]> = [];
    let op = 'select';
    let payload: Linha | Linha[] | undefined;
    const executar = (modo: 'um' | 'varios') => {
      estado.chamadas.push({ tabela, op, filtros: { ...filtros }, payload, ordens: [...ordens] });
      if (estado.falharEm.includes(`${tabela}:${op}`)) throw new Error(`falha simulada em ${tabela}:${op}`);
      if (tabela === 'whatsapp_ia_acoes' && op === 'select') return { data: estado.ledger, error: null };
      if (tabela === 'crm_negocios' && op === 'select') return { data: estado.negocio, error: null };
      if (tabela === 'crm_negocios' && op === 'insert') return { data: { id: 'novo-negocio' }, error: null };
      if (tabela === 'crm_estagios') return { data: ESTAGIOS, error: null };
      if (tabela === 'crm_pipelines') return { data: [{ id: 'p-padrao', estagios: ESTAGIOS }], error: null };
      if (tabela === 'agenda_reservas' && op === 'select') return { count: estado.outras, data: null, error: null };
      if (tabela === 'crm_tarefas' && op === 'select') return { data: filtros.reserva_uid_like ? estado.tarefasRemarcar : estado.tarefaExistente, error: null };
      void modo;
      return { data: null, error: null };
    };
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => ((filtros[c] = v), api),
      neq: (c: string, v: unknown) => ((filtros[`${c}_neq`] = v), api),
      gt: (c: string, v: unknown) => ((filtros[`${c}_gt`] = v), api),
      in: (c: string, v: unknown) => ((filtros[`${c}_in`] = v), api),
      like: (c: string, v: unknown) => ((filtros[`${c}_like`] = v), api),
      contains: (c: string, v: unknown) => ((filtros[`${c}_contains`] = v), api),
      order: (c: string, o: unknown) => (ordens.push([c, o]), api),
      limit: () => api,
      insert: (p: Linha | Linha[]) => ((op = 'insert'), (payload = p), api),
      update: (p: Linha) => ((op = 'update'), (payload = p), api),
      maybeSingle: async () => executar('um'),
      single: async () => executar('um'),
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        try {
          resolve(executar('varios'));
        } catch (e) {
          reject(e);
        }
      },
    };
    return api;
  };
  return { from } as unknown as SupabaseClient;
}

const reserva = (extra: Partial<ReservaDoWebhook> = {}): ReservaDoWebhook => ({
  gatilho: 'BOOKING_CREATED',
  uid: 'u1',
  status: 'confirmada',
  inicio: '2026-11-23T16:00:00Z',
  fim: '2026-11-23T16:30:00Z',
  titulo: null,
  nomeContato: 'Maria',
  email: 'm@e.com',
  telefone: '5583999990001',
  negocioId: null,
  motivoCancelamento: null,
  remarcadaDeUid: null,
  eventoEm: '2026-11-18T12:00:00Z',
  ...extra,
});

const base = { agenciaId: 'ag1', clienteId: 'cl1', integracaoId: 'i1', reservaJaRemarcada: false, agora: new Date('2026-11-18T12:00:00Z') };
const doTipo = (tabela: string, op: string) => estado.chamadas.filter((c) => c.tabela === tabela && c.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  equipe.mockResolvedValue(['resp-fixo', 'membro-2']);
  gestores.mockResolvedValue(['gestor-1']);
  Object.assign(estado, { ledger: [], negocio: null, outras: 0, tarefasRemarcar: [], tarefaExistente: [], falharEm: [], chamadas: [] });
});

describe('aplicarReservaNoCrm', () => {
  it('reserva sem negócio: cria no funil padrão em "Consulta Agendada", liga a reserva, registra e cria a tarefa', async () => {
    const r = await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect(r).toEqual({ ok: true, acao: 'aplicado', negocioId: 'novo-negocio' });

    const criado = doTipo('crm_negocios', 'insert')[0].payload as Linha;
    expect(criado).toMatchObject({ agencia_id: 'ag1', cliente_id: 'cl1', pipeline_id: 'p-padrao', estagio_id: 'e3', origem: 'whatsapp', telefone: '5583999990001', status: 'aberto' });

    // A reserva passa a apontar para o negócio novo.
    expect(doTipo('agenda_reservas', 'update')[0]).toMatchObject({ payload: { negocio_id: 'novo-negocio' }, filtros: { integracao_id: 'i1', agencia_id: 'ag1', uid: 'u1' } });

    const tipos = (doTipo('crm_atividades', 'insert').flatMap((c) => c.payload) as Linha[]).map((a) => a.tipo);
    expect(tipos).toEqual(['criacao', 'reuniao']);
    expect(doTipo('crm_tarefas', 'insert')[0].payload).toMatchObject({ negocio_id: 'novo-negocio', reserva_uid: 'u1', tipo: 'whatsapp' });
    expect(doTipo('whatsapp_ia_acoes', 'insert')[0].payload).toMatchObject({ acao: 'agenda_crm', dados_extraidos: { reserva_uid: 'u1', gatilho: 'BOOKING_CREATED' } });
  });

  it('negócio existente em estágio anterior: move só se ninguém mexeu antes e registra a mudança', async () => {
    estado.negocio = { id: 'n1', status: 'aberto', estagio_id: 'e1', pipeline_id: 'p-padrao', responsavel_id: 'm1', nome_contato: 'Maria' };
    const r = await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: 'n1', reserva: reserva(), ...base });
    expect(r).toMatchObject({ ok: true, acao: 'aplicado', negocioId: 'n1' });
    const mover = doTipo('crm_negocios', 'update')[0];
    expect(mover.payload).toMatchObject({ estagio_id: 'e3' });
    expect(mover.filtros).toMatchObject({ id: 'n1', agencia_id: 'ag1', estagio_id: 'e1' }); // trava otimista
    expect(doTipo('crm_tarefas', 'insert')[0].payload).toMatchObject({ responsavel_id: 'm1' });
  });

  it('evento já aplicado: não repete nada (idempotência pelo livro-razão), nem avisa de novo', async () => {
    estado.ledger = [{ id: 'a1' }];
    const r = await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: 'n1', reserva: reserva(), ...base });
    expect(r).toEqual({ ok: true, acao: 'ja_aplicado', negocioId: 'n1' });
    expect(estado.chamadas.every((c) => c.op === 'select')).toBe(true);
    expect(avisar).not.toHaveBeenCalled();
    expect(doTipo('whatsapp_ia_acoes', 'select')[0].filtros).toMatchObject({ agencia_id: 'ag1', acao: 'agenda_crm', dados_extraidos_contains: { reserva_uid: 'u1', gatilho: 'BOOKING_CREATED' } });
  });

  it('cancelamento: conclui a tarefa da reserva, volta o estágio e cria "remarcar:uid"', async () => {
    estado.negocio = { id: 'n1', status: 'aberto', estagio_id: 'e3', pipeline_id: 'p-padrao', responsavel_id: null, nome_contato: 'Maria' };
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: 'n1', reserva: reserva({ status: 'cancelada', gatilho: 'BOOKING_CANCELLED', eventoEm: '2026-11-18T13:00:00Z' }), ...base });
    expect(doTipo('crm_negocios', 'update')[0].payload).toMatchObject({ estagio_id: 'e1' });
    const concluir = doTipo('crm_tarefas', 'update')[0];
    expect(concluir.payload).toMatchObject({ concluida: true });
    expect(concluir.filtros).toMatchObject({ agencia_id: 'ag1', negocio_id: 'n1', reserva_uid_in: ['u1'] });
    expect(doTipo('crm_tarefas', 'insert')[0].payload).toMatchObject({ reserva_uid: 'remarcar:u1', titulo: 'Remarcar consulta com Maria' });
  });

  it('consulta nova depois de cancelar: conclui as tarefas "remarcar:" pendentes do negócio', async () => {
    estado.negocio = { id: 'n1', status: 'aberto', estagio_id: 'e1', pipeline_id: 'p-padrao', responsavel_id: null, nome_contato: 'Maria' };
    estado.tarefasRemarcar = [{ reserva_uid: 'remarcar:antiga' }];
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: 'n1', reserva: reserva({ uid: 'nova' }), ...base });
    const concluirRemarcar = doTipo('crm_tarefas', 'update').find((c) => JSON.stringify(c.filtros.reserva_uid_in) === JSON.stringify(['remarcar:antiga']));
    expect(concluirRemarcar).toBeDefined();
  });

  it('cancelamento sem negócio: não cria nada', async () => {
    const r = await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva({ status: 'cancelada' }), ...base });
    expect(r).toMatchObject({ ok: true, negocioId: null });
    expect(doTipo('crm_negocios', 'insert')).toHaveLength(0);
  });

  it('TODA consulta e escrita filtra ou carrega a agência (a service role ignora o RLS)', async () => {
    estado.negocio = { id: 'n1', status: 'aberto', estagio_id: 'e1', pipeline_id: 'p-padrao', responsavel_id: null, nome_contato: 'Maria' };
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: 'n1', reserva: reserva(), ...base });
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva({ uid: 'u2', eventoEm: '2026-11-18T14:00:00Z' }), ...base });
    // crm_estagios não tem coluna de agência: é consultado pelo funil, que veio de um negócio já filtrado por agência.
    const comAgencia = estado.chamadas.filter((c) => c.tabela !== 'crm_estagios');
    expect(comAgencia.length).toBeGreaterThan(8);
    for (const c of comAgencia) {
      const linhas = ([] as Linha[]).concat((c.payload as Linha | Linha[]) ?? []);
      const carrega = c.filtros.agencia_id === 'ag1' || (linhas.length > 0 && linhas.every((l) => l.agencia_id === 'ag1'));
      expect(carrega, `${c.tabela}:${c.op} sem agencia_id`).toBe(true);
    }
  });

  it('falha no meio: não lança, devolve falhou e deixa uma linha visível com o erro', async () => {
    estado.falharEm = ['crm_atividades:insert'];
    const r = await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect(r).toMatchObject({ ok: false, acao: 'falhou', erro: expect.stringContaining('crm_atividades:insert') });
    const falha = doTipo('whatsapp_ia_acoes', 'insert').find((c) => (c.payload as Linha).acao === 'agenda_crm_falhou')!;
    expect(falha.payload).toMatchObject({ agencia_id: 'ag1', dados_extraidos: { reserva_uid: 'u1', erro: expect.any(String) } });
    // E o livro-razão de "feito" NÃO foi gravado.
    expect(doTipo('whatsapp_ia_acoes', 'insert').some((c) => (c.payload as Linha).acao === 'agenda_crm')).toBe(false);
  });

  it('se até o registro da falha também quebrar, ainda assim não lança', async () => {
    estado.falharEm = ['crm_negocios:insert', 'whatsapp_ia_acoes:insert'];
    const r = await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect(r).toMatchObject({ ok: false, acao: 'falhou' });
    // Tentou registrar a falha (e a tentativa quebrou) em vez de desistir antes.
    expect(doTipo('whatsapp_ia_acoes', 'insert').some((c) => (c.payload as Linha).acao === 'agenda_crm_falhou')).toBe(true);
  });
});

describe('responsável e aviso à equipe', () => {
  it('negócio novo e tarefa ficam com o responsável fixo do cliente (nunca sem dono)', async () => {
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect((doTipo('crm_negocios', 'insert')[0].payload as Linha).responsavel_id).toBe('resp-fixo');
    expect((doTipo('crm_tarefas', 'insert')[0].payload as Linha).responsavel_id).toBe('resp-fixo');
  });

  it('sem equipe cadastrada, cai no gestor da agência', async () => {
    equipe.mockResolvedValue([]);
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect((doTipo('crm_tarefas', 'insert')[0].payload as Linha).responsavel_id).toBe('gestor-1');
  });

  it('negócio que já tem responsável o mantém', async () => {
    estado.negocio = { id: 'n1', status: 'aberto', estagio_id: 'e1', pipeline_id: 'p-padrao', responsavel_id: 'dono-do-negocio', nome_contato: 'Maria' };
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: 'n1', reserva: reserva(), ...base });
    expect((doTipo('crm_tarefas', 'insert')[0].payload as Linha).responsavel_id).toBe('dono-do-negocio');
  });

  it('avisa responsável e equipe do cliente pelo sino e push, depois de gravar o livro-razão', async () => {
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect(avisar).toHaveBeenCalledTimes(1);
    const [quem, dados] = avisar.mock.calls[0];
    expect(quem).toEqual(['resp-fixo', 'membro-2']);
    expect(dados).toMatchObject({ tipo: 'consulta_agenda', titulo: 'Consulta marcada: Maria', url: '/?tab=crm', agrupar: 'agenda:u1' });
  });

  it('sem ninguém na equipe, avisa o gestor', async () => {
    equipe.mockResolvedValue([]);
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect(avisar.mock.calls[0][0]).toEqual(['gestor-1']);
  });

  it('se o CRM falhou no meio, não avisa ninguém como se tivesse dado certo', async () => {
    estado.falharEm = ['crm_atividades:insert'];
    await aplicarReservaNoCrm({ db: criarDb(), negocioIdAtual: null, reserva: reserva(), ...base });
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe('pipelineParaNovoNegocio', () => {
  it('pede o funil marcado como padrão primeiro, sempre da agência e do cliente', async () => {
    const f = await pipelineParaNovoNegocio(criarDb(), 'ag1', 'cl1');
    expect(f?.id).toBe('p-padrao');
    const c = doTipo('crm_pipelines', 'select')[0];
    expect(c.filtros).toMatchObject({ agencia_id: 'ag1', cliente_id: 'cl1', ativo: true });
    expect(c.ordens[0]).toEqual(['padrao', { ascending: false }]);
  });
});
