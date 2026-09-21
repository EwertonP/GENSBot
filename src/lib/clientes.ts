/**
 * Domínio de "Clientes" do sistema unificado.
 *
 * Espelha public.clientes e public.cliente_contatos (migration
 * 20260919_sistema_clientes_conteudo.sql). A validação mora aqui, e não nas
 * rotas, por dois motivos: é lógica pura e testável, e é onde fica a regra de
 * segurança que importa — só campos da whitelist entram. `agencia_id`, `id` e
 * os timestamps nunca são aceitos do corpo da requisição.
 */

export interface EtapaOnboarding {
  id: string;
  label: string;
  concluida: boolean;
  concluida_em?: string | null;
}

export const ETAPAS_ONBOARDING_PADRAO: EtapaOnboarding[] = [
  { id: 'briefing_inicial', label: 'Briefing inicial', concluida: false },
  { id: 'acessos_coletados', label: 'Acessos das redes coletados', concluida: false },
  { id: 'paleta_definida', label: 'Paleta de marca definida', concluida: false },
  { id: 'tom_de_voz', label: 'Tom de voz documentado', concluida: false },
  { id: 'primeira_reuniao', label: 'Primeira reunião de alinhamento', concluida: false },
  { id: 'social_seller', label: 'Treinamento Social Seller', concluida: false },
  { id: 'organizar_destaques', label: 'Organizar destaques', concluida: false },
  { id: 'organizar_biografia', label: 'Organizar biografia', concluida: false },
  { id: 'organizar_foto_perfil', label: 'Organizar foto de perfil', concluida: false },
];

export interface Cliente {
  id: string;
  agencia_id: string;
  nome: string;
  foto_url: string | null;
  cor: string | null;
  nicho: string | null;
  instagram_account_id: string | null;
  lead_id: string | null;
  responsavel_venda_id: string | null;
  convertido_em: string | null;
  cnpj_cpf: string | null;
  responsavel_legal: string | null;
  cpf_responsavel: string | null;
  endereco: string | null;
  valor_mensal: number | null;
  dia_vencimento: number | null;
  contrato_inicio: string | null;
  contrato_duracao_meses: number | null;
  contrato_arquivo_url: string | null;
  posts_mes: number | null;
  reels_mes: number | null;
  dia_revisao: number | null;
  responsavel_fixo_id: string | null;
  etapa: string | null;
  observacoes: string | null;
  concorrentes: string | null;
  briefing: string | null;
  drive_pasta_id: string | null;
  token_aprovacao_mes?: string | null;
  onboarding_etapas?: EtapaOnboarding[];
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteContato {
  id: string;
  agencia_id: string;
  cliente_id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  e_grupo_whatsapp: boolean;
  criado_em: string;
}

/** Conta de Instagram do GENSBot como o navegador a vê — nunca inclui o access_token. */
export interface ContaInstagramResumo {
  id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  profile_picture_url: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
}

/** Abas do GENSBot que já sabem trabalhar escopadas numa conta do Instagram. */
export type DestinoConta = 'automations' | 'contacts' | 'inbox' | 'metrics' | 'publish' | 'esteira';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------- campos ---

type TextRule = { kind: 'text'; max: number };
type IntRule = { kind: 'int'; min: number; max: number };
type MoneyRule = { kind: 'money'; max: number };
type Rule =
  | TextRule
  | IntRule
  | MoneyRule
  | { kind: 'color' }
  | { kind: 'date' }
  | { kind: 'uuid' }
  | { kind: 'bool' }
  | { kind: 'json' };

const text = (max: number): TextRule => ({ kind: 'text', max });
const int = (min: number, max: number): IntRule => ({ kind: 'int', min, max });

// Whitelist. Tudo que não está aqui é descartado em silêncio.
const CLIENTE_FIELDS: Record<string, Rule> = {
  nome: text(120),
  foto_url: text(2000),
  cor: { kind: 'color' },
  nicho: text(120),
  instagram_account_id: { kind: 'uuid' },
  responsavel_venda_id: { kind: 'uuid' },
  responsavel_fixo_id: { kind: 'uuid' },
  cnpj_cpf: text(32),
  responsavel_legal: text(160),
  cpf_responsavel: text(32),
  endereco: text(300),
  valor_mensal: { kind: 'money', max: 9_999_999.99 },
  dia_vencimento: int(1, 31),
  contrato_inicio: { kind: 'date' },
  contrato_duracao_meses: int(1, 120),
  contrato_arquivo_url: text(2000),
  posts_mes: int(0, 500),
  reels_mes: int(0, 500),
  dia_revisao: int(0, 6),
  etapa: text(120),
  observacoes: text(5000),
  concorrentes: text(2000),
  briefing: text(10000),
  drive_pasta_id: text(200),
  token_aprovacao_mes: { kind: 'uuid' },
  onboarding_etapas: { kind: 'json' },
  notion_database_id: text(200),
  notion_page_id: text(200),
  ativo: { kind: 'bool' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Para validar `id` vindo da URL antes de chegar ao banco (uuid malformado vira erro 500). */
export function ehUuid(valor: string): boolean {
  return UUID_RE.test(valor);
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function parseField(key: string, rule: Rule, raw: unknown): ParseResult<unknown> {
  if (rule.kind === 'bool') {
    if (typeof raw !== 'boolean') return { ok: false, error: `${key}: esperado verdadeiro ou falso.` };
    return { ok: true, data: raw };
  }

  // Vazio limpa o campo — vira null no banco.
  if (isEmpty(raw)) return { ok: true, data: null };

  switch (rule.kind) {
    case 'text': {
      if (typeof raw !== 'string') return { ok: false, error: `${key}: esperado texto.` };
      const value = raw.trim();
      if (value.length > rule.max) return { ok: false, error: `${key}: máximo de ${rule.max} caracteres.` };
      return { ok: true, data: value };
    }
    case 'color': {
      if (typeof raw !== 'string' || !COLOR_RE.test(raw.trim())) {
        return { ok: false, error: `${key}: cor inválida, use o formato #rrggbb.` };
      }
      return { ok: true, data: raw.trim().toLowerCase() };
    }
    case 'uuid': {
      if (typeof raw !== 'string' || !UUID_RE.test(raw.trim())) {
        return { ok: false, error: `${key}: identificador inválido.` };
      }
      return { ok: true, data: raw.trim().toLowerCase() };
    }
    case 'date': {
      if (typeof raw !== 'string' || !DATE_RE.test(raw.trim())) {
        return { ok: false, error: `${key}: data inválida, use AAAA-MM-DD.` };
      }
      const [y, m, d] = raw.trim().split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      // Rejeita 2026-02-31, que o Date normalizaria em silêncio para março.
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
        return { ok: false, error: `${key}: essa data não existe.` };
      }
      return { ok: true, data: raw.trim() };
    }
    case 'int': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isInteger(n)) return { ok: false, error: `${key}: esperado número inteiro.` };
      if (n < rule.min || n > rule.max) {
        return { ok: false, error: `${key}: deve estar entre ${rule.min} e ${rule.max}.` };
      }
      return { ok: true, data: n };
    }
    case 'money': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, error: `${key}: esperado um valor em reais.` };
      if (n < 0 || n > rule.max) return { ok: false, error: `${key}: valor fora do limite.` };
      // numeric(10,2): arredonda para centavos em vez de deixar o banco recusar.
      return { ok: true, data: Math.round(n * 100) / 100 };
    }
    case 'json': {
      return { ok: true, data: raw };
    }
  }
}

/**
 * Valida e filtra o corpo de criação/edição de cliente.
 * - `criar`: `nome` é obrigatório.
 * - edição: só os campos presentes são retornados (PATCH parcial).
 */
export function parseClienteInput(
  body: unknown,
  modo: 'criar' | 'editar'
): ParseResult<Record<string, unknown>> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Corpo da requisição inválido.' };
  }
  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  for (const [key, rule] of Object.entries(CLIENTE_FIELDS)) {
    if (!(key in input)) continue;
    const parsed = parseField(key, rule, input[key]);
    if (!parsed.ok) return parsed;
    data[key] = parsed.data;
  }

  if (modo === 'criar' && isEmpty(data.nome)) {
    return { ok: false, error: 'Informe o nome do cliente.' };
  }
  if (modo === 'editar' && 'nome' in data && isEmpty(data.nome)) {
    return { ok: false, error: 'O nome do cliente não pode ficar vazio.' };
  }
  if (modo === 'editar' && Object.keys(data).length === 0) {
    return { ok: false, error: 'Nenhum campo para atualizar.' };
  }
  return { ok: true, data };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseContatoInput(body: unknown): ParseResult<Record<string, unknown>> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Corpo da requisição inválido.' };
  }
  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  const fields: Record<string, Rule> = {
    nome: text(120),
    cargo: text(120),
    telefone: text(40),
    email: text(200),
    e_grupo_whatsapp: { kind: 'bool' },
  };
  for (const [key, rule] of Object.entries(fields)) {
    if (!(key in input)) continue;
    const parsed = parseField(key, rule, input[key]);
    if (!parsed.ok) return parsed;
    data[key] = parsed.data;
  }

  if (isEmpty(data.nome)) return { ok: false, error: 'Informe o nome do contato.' };
  if (typeof data.email === 'string' && !EMAIL_RE.test(data.email)) {
    return { ok: false, error: 'email: endereço inválido.' };
  }
  return { ok: true, data };
}

// ---------------------------------------------------------------- avatar ---

/**
 * Cores para identificar cada cliente (avatar e faixas). Terrosas e de baixa
 * saturação de propósito: o lima da marca é o único ponto de voltagem alta do
 * sistema, e cor de cliente não pode competir com ele.
 */
export const CORES_CLIENTE = [
  '#d8ff3c', // lima (marca)
  '#bada55', // verde de marca
  '#55703a', // verde oliva (escurecido: o #657e48 da marca não sustenta texto a 4.5:1)
  '#162d16', // verde profundo
  '#e0b64a', // mostarda
  '#d98c5f', // argila
  '#8fb8a8', // sálvia
  '#b9a7d6', // lavanda
] as const;

export function corPadraoDoCliente(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return CORES_CLIENTE[h % CORES_CLIENTE.length];
}

/** Luminância relativa WCAG de um #rrggbb. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Razão de contraste WCAG entre duas cores #rrggbb (1 a 21). */
export function razaoContraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Texto legível sobre a cor: escolhe entre tinta e papel o que dá MAIS contraste.
 * Um limiar fixo de luminância erra nos tons médios (foi o que aconteceu com o
 * verde oliva), então comparamos os dois candidatos de verdade.
 */
export function textoSobre(hex: string): string {
  const TINTA = '#192313';
  const PAPEL = '#f7f8f2';
  return razaoContraste(hex, TINTA) >= razaoContraste(hex, PAPEL) ? TINTA : PAPEL;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
