import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarBancoFalso } from './banco-falso';

const { notificar } = vi.hoisted(() => ({ notificar: vi.fn() }));
vi.mock('@/lib/notificar', () => ({ notificar }));
vi.mock('@/lib/notificar-destinatarios', () => ({ equipeDoCliente: async () => ['u-equipe'], gestoresDaAgencia: async () => ['u-gestor'] }));
vi.mock('@/lib/cripto', () => ({ descriptografarSegredo: (v?: string | null) => v ?? null }));
vi.mock('@/lib/agenda/integracao', () => ({ lerIntegracao: async () => ({ api_base: 'https://api.cal.com', api_key_cifrada: 'k', ativo: true }) }));

import { ehUrgencia, formatarAgenda, historicoParaChat, limparResposta, montarPrompt, tratarMensagemDoPaciente } from './assistente';

const { db, tabelas } = criarBancoFalso();
const AG = 'ag1';
const CL = 'cl1';
const REM = '5583999990001@c.us';
const agora = new Date('2026-11-23T12:00:00Z');
const tipos = [{ id: 1, titulo: 'Consulta', minutos: 30, link: 'https://cal.com/dra/consulta', horarios: ['2026-11-24T13:00:00Z'] }];

const llm = vi.fn();
const agenda = vi.fn();
const tratar = (texto = 'Oi, queria marcar uma consulta') =>
  tratarMensagemDoPaciente({ db, agenciaId: AG, clienteId: CL, remetente: REM, sessionName: 'laisleal', texto, nomeContato: 'Maria', agora, llm, agenda });

beforeEach(() => {
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  vi.clearAllMocks();
  llm.mockResolvedValue({ replyText: 'Claro! Posso sugerir terça às 10h.' });
  agenda.mockResolvedValue(tipos);
  tabelas.atendimento_config = [{ agencia_id: AG, cliente_id: CL, ligado: true, sessao_nome: 'laisleal', pausa_humano_horas: 6, resposta_min_segundos: 45, resposta_max_segundos: 180 }];
  tabelas.ai_agent_configs = [{ agencia_id: AG, cliente_id: CL, provedor: 'gemini', api_key: 'chave', modelo: 'gemini-2.5-flash', temperatura: 0.9, nome_agente: 'Ana', prompt_sistema: 'Clínica de dermatologia. Endereço: Rua A, 1.' }];
  tabelas.whatsapp_mensagens = [{ agencia_id: AG, cliente_id: CL, remetente: REM, de_mim: false, conteudo: 'Oi, queria marcar uma consulta', timestamp_msg: '2026-11-23T11:59:00Z' }];
  tabelas.atendimento_fila = [];
  tabelas.whatsapp_ia_acoes = [];
});

describe('peças puras', () => {
  it('urgência é reconhecida com ou sem acento, e conversa normal não', () => {
    expect(ehUrgencia('Estou com muita dor e sangrando')).toBe(true);
    expect(ehUrgencia('é urgente')).toBe(true);
    expect(ehUrgencia('Socorro, falta de ar')).toBe(true);
    expect(ehUrgencia('quero marcar uma consulta')).toBe(false);
  });
  it('histórico alterna, junta turnos seguidos e termina no paciente', () => {
    const h = historicoParaChat([
      { de_mim: true, conteudo: 'oi (secretária, antes do paciente)' },
      { de_mim: false, conteudo: 'a' },
      { de_mim: false, conteudo: 'b' },
      { de_mim: true, conteudo: 'resposta' },
      { de_mim: false, conteudo: 'c' },
      { de_mim: true, conteudo: 'sem resposta do paciente depois' },
    ]);
    expect(h).toEqual([
      { role: 'user', content: 'a\nb' },
      { role: 'assistant', content: 'resposta' },
      { role: 'user', content: 'c' },
    ]);
  });
  it('limpa markdown e corta em fim de frase', () => {
    expect(limparResposta('**Olá**, tudo bem?')).toBe('Olá, tudo bem?');
    const longo = `${'Frase completa aqui. '.repeat(60)}resto sem fim`;
    const r = limparResposta(longo);
    expect(r.length).toBeLessThanOrEqual(700);
    expect(r.endsWith('.')).toBe(true);
  });
  it('o prompt traz as regras, as instruções e a agenda; sem agenda proíbe sugerir horário', () => {
    const p = montarPrompt({ nomeAgente: 'Ana', instrucoes: 'Rua A, 1', agenda: formatarAgenda(tipos), agora });
    expect(p).toContain('NÃO marca nem confirma');
    expect(p).toContain('Rua A, 1');
    expect(p).toContain('https://cal.com/dra/consulta');
    expect(formatarAgenda(null)).toContain('AGENDA INDISPONÍVEL');
    expect(montarPrompt({ nomeAgente: 'Ana', instrucoes: '', agenda: '-', agora })).toContain('nenhuma informação cadastrada');
  });
});

describe('tratarMensagemDoPaciente', () => {
  it('responde: gera, enfileira (não envia) e registra', async () => {
    const r = await tratar();
    expect(r).toMatchObject({ acao: 'respondida' });
    expect(tabelas.atendimento_fila).toHaveLength(1);
    expect(tabelas.atendimento_fila[0]).toMatchObject({ remetente: REM, texto: 'Claro! Posso sugerir terça às 10h.', status: 'pendente' });
    expect(tabelas.whatsapp_ia_acoes[0]).toMatchObject({ acao: 'atendimento_ia' });
    const chamada = llm.mock.calls[0][0];
    expect(chamada).toMatchObject({ provider: 'gemini', apiKey: 'chave', model: 'gemini-2.5-flash', temperature: 0.5 });
    expect(chamada.systemPrompt).toContain('https://cal.com/dra/consulta');
    expect(chamada.tools.map((t: { name: string }) => t.name)).toEqual(['solicitar_atendimento_humano']);
  });

  it('desligado, ou sessão que não é a do atendimento: nem consulta a IA', async () => {
    tabelas.atendimento_config[0].ligado = false;
    expect(await tratar()).toEqual({ acao: 'ignorada', motivo: 'desligado' });
    tabelas.atendimento_config[0].ligado = true;
    tabelas.atendimento_config[0].sessao_nome = 'outra-sessao';
    expect(await tratar()).toEqual({ acao: 'ignorada', motivo: 'desligado' });
    expect(llm).not.toHaveBeenCalled();
  });

  it('urgência vai direto para a equipe, sem IA, com o aviso do SAMU', async () => {
    const r = await tratar('Socorro, estou com falta de ar');
    expect(r).toMatchObject({ acao: 'transferida' });
    expect(llm).not.toHaveBeenCalled();
    expect(tabelas.atendimento_fila[0].texto).toContain('192');
    expect(notificar).toHaveBeenCalledWith(['u-equipe'], expect.objectContaining({ tipo: 'atendimento_transferido' }));
    expect(tabelas.whatsapp_ia_acoes[0]).toMatchObject({ acao: 'atendimento_transferido' });
  });

  it('a IA pede uma pessoa: transfere e a conversa fica com a equipe nas próximas mensagens', async () => {
    llm.mockResolvedValue({ replyText: '', toolCalls: [{ id: '1', name: 'solicitar_atendimento_humano', arguments: { motivo: 'Pergunta sobre convênio' } }] });
    expect(await tratar('Vocês aceitam o convênio X?')).toMatchObject({ acao: 'transferida', motivo: 'Pergunta sobre convênio' });
    expect(tabelas.atendimento_fila[0].texto).toContain('equipe da clínica');
    tabelas.whatsapp_ia_acoes.forEach((l) => (l.criado_em = agora.toISOString())); // o banco falso carimba com a hora real
    expect(await tratar('E então?')).toEqual({ acao: 'ignorada', motivo: 'conversa_com_a_equipe' });
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('sem chave de IA do cliente: falha registrada, nada enfileirado, não cai em chave global', async () => {
    tabelas.ai_agent_configs[0].api_key = null;
    expect(await tratar()).toEqual({ acao: 'falhou', motivo: 'sem_chave_ia' });
    expect(tabelas.atendimento_fila).toHaveLength(0);
    expect(tabelas.whatsapp_ia_acoes[0]).toMatchObject({ acao: 'atendimento_ia_falhou' });
  });

  it('erro na IA: registra e não enfileira', async () => {
    llm.mockRejectedValue(new Error('quota estourada'));
    expect(await tratar()).toMatchObject({ acao: 'falhou', motivo: 'quota estourada' });
    expect(tabelas.atendimento_fila).toHaveLength(0);
    expect(tabelas.whatsapp_ia_acoes[0]).toMatchObject({ acao: 'atendimento_ia_falhou', resumo_detectado: 'quota estourada' });
  });

  it('agenda fora do ar: a IA recebe o aviso para não sugerir horário', async () => {
    agenda.mockResolvedValue(null);
    await tratar();
    expect(llm.mock.calls[0][0].systemPrompt).toContain('AGENDA INDISPONÍVEL');
  });

  it('teto por contato e grupo', async () => {
    tabelas.atendimento_fila = Array.from({ length: 15 }, (_, i) => ({ id: `f${i}`, agencia_id: AG, cliente_id: CL, remetente: REM, status: 'descartada', criado_em: agora.toISOString() }));
    expect(await tratar()).toEqual({ acao: 'ignorada', motivo: 'limite_da_conversa' });
    expect(await tratarMensagemDoPaciente({ db, agenciaId: AG, clienteId: CL, remetente: '1203@g.us', sessionName: 'laisleal', texto: 'oi', agora, llm, agenda })).toMatchObject({ acao: 'ignorada' });
    expect(llm).not.toHaveBeenCalled();
  });
});
