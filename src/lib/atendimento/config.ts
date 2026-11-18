/**
 * Configuração do atendimento por cliente (tabela `atendimento_config`).
 * `ligado` só vira verdadeiro com os pré-requisitos em ordem (`faltasParaLigar`), e volta a
 * falso sozinho se uma mudança de configuração os quebrar. O resto (sessão, OpenWA, horário,
 * ritmo) é o que a fila e o assistente usam.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { criptografarSegredo, segredoDisponivel } from '@/lib/cripto';
import { apiBaseValida } from '@/lib/agenda/calcom-client';

export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
export type Dia = (typeof DIAS)[number];
export type Horario = Partial<Record<Dia, Array<{ de: string; ate: string }>>>;

export interface EntradaConfig {
  ligado?: unknown;
  modo?: unknown;
  sessaoNome?: unknown;
  openwaUrl?: unknown;
  /** Só de escrita: nunca volta para a tela. Vazio mantém a atual. */
  openwaKey?: unknown;
  removerOpenwaKey?: unknown;
  horario?: unknown;
  respostaMinSegundos?: unknown;
  respostaMaxSegundos?: unknown;
  limiteRespostasHora?: unknown;
  pausaHumanoHoras?: unknown;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const SESSAO = /^[A-Za-z0-9-]{1,64}$/;

const inteiro = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

export function validarHorario(v: unknown): Horario | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const saida: Horario = {};
  for (const [dia, faixas] of Object.entries(v as Record<string, unknown>)) {
    if (!(DIAS as readonly string[]).includes(dia) || !Array.isArray(faixas) || faixas.length > 4) return null;
    const ok: Array<{ de: string; ate: string }> = [];
    for (const f of faixas) {
      const { de, ate } = (f ?? {}) as { de?: unknown; ate?: unknown };
      if (typeof de !== 'string' || typeof ate !== 'string' || !HORA.test(de) || !HORA.test(ate) || de >= ate) return null;
      ok.push({ de, ate });
    }
    if (ok.length) saida[dia as Dia] = ok;
  }
  return saida;
}

export type ValidacaoConfig = { ok: true; campos: Record<string, unknown>; novaChaveOpenwa: string | null } | { ok: false; erro: string };

/** Valida só o que veio; o que não veio não é tocado. */
export function validarEntradaConfig(e: EntradaConfig): ValidacaoConfig {
  const campos: Record<string, unknown> = {};

  if (e.ligado !== undefined && typeof e.ligado !== 'boolean') return { ok: false, erro: 'Ligado: verdadeiro ou falso.' };
  if (e.modo !== undefined) {
    if (e.modo !== 'simulacao' && e.modo !== 'real') return { ok: false, erro: 'Modo inválido.' };
    campos.modo = e.modo;
  }
  if (e.sessaoNome !== undefined) {
    const nome = typeof e.sessaoNome === 'string' ? e.sessaoNome.trim() : '';
    if (nome && !SESSAO.test(nome)) return { ok: false, erro: 'Nome da sessão: só letras, números e hífen.' };
    campos.sessao_nome = nome || null;
  }
  if (e.openwaUrl !== undefined) {
    const url = typeof e.openwaUrl === 'string' ? e.openwaUrl.trim() : '';
    if (url) {
      const base = apiBaseValida(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      if (!base) return { ok: false, erro: 'Endereço do OpenWA inválido: use https com nome de domínio.' };
      campos.openwa_url = base;
    } else {
      campos.openwa_url = null;
    }
  }
  if (e.horario !== undefined) {
    const h = validarHorario(e.horario);
    if (!h) return { ok: false, erro: 'Horário inválido: use faixas HH:MM com início antes do fim.' };
    campos.horario_atendimento = h;
  }

  const min = e.respostaMinSegundos !== undefined ? inteiro(e.respostaMinSegundos, 0, 3600) : undefined;
  const max = e.respostaMaxSegundos !== undefined ? inteiro(e.respostaMaxSegundos, 0, 3600) : undefined;
  if (min === null || max === null) return { ok: false, erro: 'Tempo de resposta: número de segundos entre 0 e 3600.' };
  if (min !== undefined) campos.resposta_min_segundos = min;
  if (max !== undefined) campos.resposta_max_segundos = max;
  if (min !== undefined && max !== undefined && max < min) return { ok: false, erro: 'O tempo máximo não pode ser menor que o mínimo.' };

  if (e.limiteRespostasHora !== undefined) {
    const n = inteiro(e.limiteRespostasHora, 0, 120);
    if (n === null) return { ok: false, erro: 'Limite por hora: entre 0 e 120.' };
    campos.limite_respostas_hora = n;
  }
  if (e.pausaHumanoHoras !== undefined) {
    const n = inteiro(e.pausaHumanoHoras, 0, 72);
    if (n === null) return { ok: false, erro: 'Pausa quando a equipe responde: entre 0 e 72 horas.' };
    campos.pausa_humano_horas = n;
  }

  let novaChaveOpenwa: string | null = null;
  if (typeof e.openwaKey === 'string' && e.openwaKey.trim()) novaChaveOpenwa = e.openwaKey.trim();
  if (e.removerOpenwaKey === true) campos.openwa_key_cifrada = null;

  return { ok: true, campos, novaChaveOpenwa };
}

export interface ConfigPublica {
  ligado: boolean;
  modo: 'simulacao' | 'real';
  sessaoNome: string | null;
  openwaUrl: string | null;
  temChaveOpenwa: boolean;
  webhookOpenwaRegistrado: boolean;
  /** O webhook usa o segredo próprio deste cliente (não o global). */
  webhookSegredoProprio: boolean;
  horario: Horario;
  respostaMinSegundos: number;
  respostaMaxSegundos: number;
  limiteRespostasHora: number;
  pausaHumanoHoras: number;
}

export const CONFIG_PADRAO: ConfigPublica = {
  ligado: false,
  modo: 'simulacao',
  sessaoNome: null,
  openwaUrl: null,
  temChaveOpenwa: false,
  webhookOpenwaRegistrado: false,
  webhookSegredoProprio: false,
  horario: {},
  respostaMinSegundos: 45,
  respostaMaxSegundos: 180,
  limiteRespostasHora: 12,
  pausaHumanoHoras: 6,
};

type Linha = Record<string, unknown>;

export function configPublica(l: Linha | null): ConfigPublica {
  if (!l) return CONFIG_PADRAO;
  return {
    ligado: l.ligado === true,
    modo: l.modo === 'real' ? 'real' : 'simulacao',
    sessaoNome: (l.sessao_nome as string | null) ?? null,
    openwaUrl: (l.openwa_url as string | null) ?? null,
    temChaveOpenwa: Boolean(l.openwa_key_cifrada),
    webhookOpenwaRegistrado: Boolean(l.openwa_webhook_id),
    webhookSegredoProprio: Boolean(l.openwa_webhook_secret_cifrado),
    horario: (l.horario_atendimento as Horario) ?? {},
    respostaMinSegundos: Number(l.resposta_min_segundos ?? CONFIG_PADRAO.respostaMinSegundos),
    respostaMaxSegundos: Number(l.resposta_max_segundos ?? CONFIG_PADRAO.respostaMaxSegundos),
    limiteRespostasHora: Number(l.limite_respostas_hora ?? CONFIG_PADRAO.limiteRespostasHora),
    pausaHumanoHoras: Number(l.pausa_humano_horas ?? CONFIG_PADRAO.pausaHumanoHoras),
  };
}

export async function lerConfig(db: SupabaseClient, agenciaId: string, clienteId: string): Promise<Linha | null> {
  const { data } = await db.from('atendimento_config').select('*').eq('agencia_id', agenciaId).eq('cliente_id', clienteId).maybeSingle();
  return (data as Linha | null) ?? null;
}

/** Instruções da clínica curtas demais deixam a IA sem o que dizer: ela passaria tudo para a equipe. */
export const MIN_INSTRUCOES = 100;

/** O que ainda falta para poder ligar o atendimento (vazio = pode). Puro: quem junta os fatos é `calcularFaltas`. */
export function faltasParaLigar({ linha, temChaveIA, tamInstrucoes, webhookOpenwa }: { linha: Linha | null; temChaveIA: boolean; tamInstrucoes: number; webhookOpenwa: boolean }): string[] {
  const f: string[] = [];
  if (!linha?.sessao_nome) f.push('Informe o nome da sessão do WhatsApp.');
  const h = (linha?.horario_atendimento ?? {}) as Horario;
  if (!Object.values(h).some((x) => x && x.length > 0)) f.push('Defina o horário de atendimento (sem ele a IA não responde).');
  if (!temChaveIA) f.push('Cadastre a chave de IA do cliente (tela de IA do CRM).');
  if (tamInstrucoes < MIN_INSTRUCOES) f.push(`Escreva as instruções da clínica (mínimo ${MIN_INSTRUCOES} caracteres) na tela de IA do CRM.`);
  if (linha?.modo === 'real') {
    if (!linha.openwa_url || !linha.openwa_key_cifrada) f.push('Modo real: informe o endereço e a chave do OpenWA do cliente.');
    if (!webhookOpenwa) f.push('Modo real: cadastre o webhook no OpenWA (com o segredo próprio do cliente).');
  }
  return f;
}

export async function calcularFaltas(db: SupabaseClient, agenciaId: string, clienteId: string, linha: Linha | null): Promise<string[]> {
  const { data } = await db.from('ai_agent_configs').select('api_key, prompt_sistema').eq('agencia_id', agenciaId).eq('cliente_id', clienteId).maybeSingle();
  const ia = data as { api_key?: string | null; prompt_sistema?: string | null } | null;
  return faltasParaLigar({ linha, temChaveIA: Boolean(ia?.api_key), tamInstrucoes: (ia?.prompt_sistema ?? '').trim().length, webhookOpenwa: Boolean(linha?.openwa_webhook_id && linha?.openwa_webhook_secret_cifrado) });
}

export async function salvarConfig(db: SupabaseClient, agenciaId: string, clienteId: string, entrada: EntradaConfig) {
  const v = validarEntradaConfig(entrada);
  if (!v.ok) return { ok: false as const, status: 400, erro: v.erro };

  const campos = { ...v.campos };
  if (v.novaChaveOpenwa) {
    if (!segredoDisponivel()) return { ok: false as const, status: 503, erro: 'Cifra de segredos não configurada no servidor (AI_KEYS_SECRET).' };
    campos.openwa_key_cifrada = criptografarSegredo(v.novaChaveOpenwa);
  }

  const atual = await lerConfig(db, agenciaId, clienteId);
  // Mudar o OpenWA ou a sessão invalida o webhook já cadastrado: precisa cadastrar de novo.
  if ((campos.openwa_url !== undefined && campos.openwa_url !== atual?.openwa_url) || (campos.sessao_nome !== undefined && campos.sessao_nome !== atual?.sessao_nome)) {
    campos.openwa_webhook_id = null;
  }

  // Ligado: confere o resultado final (o que já estava + o que está mudando). Pedir para ligar sem
  // pré-requisitos é erro; uma mudança que quebra um pré-requisito com o atendimento ligado desliga.
  const final = { ...(atual ?? {}), ...campos };
  let ligado = entrada.ligado === undefined ? atual?.ligado === true : entrada.ligado === true;
  let desligadoSozinho = false;
  if (ligado) {
    const faltas = await calcularFaltas(db, agenciaId, clienteId, final);
    if (faltas.length) {
      if (entrada.ligado === true) return { ok: false as const, status: 400, erro: `Ainda não dá para ligar: ${faltas.join(' ')}` };
      ligado = false;
      desligadoSozinho = true;
    }
  }

  const linha = { agencia_id: agenciaId, cliente_id: clienteId, ...campos, ligado, atualizado_em: new Date().toISOString() };
  const { data, error } = await db.from('atendimento_config').upsert(linha, { onConflict: 'cliente_id' }).select('*').single();
  if (error || !data) return { ok: false as const, status: 500, erro: 'Não foi possível salvar a configuração.' };
  return { ok: true as const, config: configPublica(data as Linha), desligadoSozinho };
}
