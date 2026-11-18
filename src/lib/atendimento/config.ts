/**
 * Configuração do atendimento por cliente (tabela `atendimento_config`).
 * Nesta etapa NADA liga a IA: `ligado` nunca é gravado como verdadeiro. O que se
 * configura aqui (sessão, OpenWA, horário, ritmo) é o que a etapa 4 vai usar.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { criptografarSegredo, segredoDisponivel } from '@/lib/cripto';
import { apiBaseValida } from '@/lib/agenda/calcom-client';

export const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
export type Dia = (typeof DIAS)[number];
export type Horario = Partial<Record<Dia, Array<{ de: string; ate: string }>>>;

export interface EntradaConfig {
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
  ligado: false;
  modo: 'simulacao' | 'real';
  sessaoNome: string | null;
  openwaUrl: string | null;
  temChaveOpenwa: boolean;
  webhookOpenwaRegistrado: boolean;
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
    ligado: false, // etapa 4: só então a IA pode ser ligada
    modo: l.modo === 'real' ? 'real' : 'simulacao',
    sessaoNome: (l.sessao_nome as string | null) ?? null,
    openwaUrl: (l.openwa_url as string | null) ?? null,
    temChaveOpenwa: Boolean(l.openwa_key_cifrada),
    webhookOpenwaRegistrado: Boolean(l.openwa_webhook_id),
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
  // Pós-condição de segurança: nesta etapa nunca fica ligado.
  const linha = { agencia_id: agenciaId, cliente_id: clienteId, ...campos, ligado: false, atualizado_em: new Date().toISOString() };
  const { data, error } = await db.from('atendimento_config').upsert(linha, { onConflict: 'cliente_id' }).select('*').single();
  if (error || !data) return { ok: false as const, status: 500, erro: 'Não foi possível salvar a configuração.' };
  return { ok: true as const, config: configPublica(data as Linha) };
}
