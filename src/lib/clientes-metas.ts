/**
 * Regras e mapeamento oficial de metas contratadas por cliente da Agência GENS.
 */

function normalizarTexto(txt?: string | null): string {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Clientes explicitamente sem metas mensais contratadas (sob demanda, consultoria ou branding) */
export const CLIENTES_SEM_META_NOMES = [
  'hdi',
  'santa maria',
  'hdiasantamaria',
  'terra de oportunidade',
  'terradeoportunidade',
  'santa sofia',
  'santa sophia',
  'diagno radiologia',
  'diagno radio',
  'everton.design',
  'everton design',
  'ewerton.dsgn',
  'ewerton dsgn',
  'felipe bezerra',
  'fellipbezerra',
  'dr. felipe',
  'dr felipe',
  'drfellip',
];

/** Metas mensais oficiais da Agência GENS */
export const METAS_MENSAIS_OFICIAIS: Array<{ padroes: string[]; meta: number }> = [
  { padroes: ['camilalucas', 'camila lucas', 'camila'], meta: 4 },
  {
    padroes: [
      'centrodiagnostico.cardio',
      'centrodiagnostico',
      'cardio',
      'cardiologia',
      'centro de diagnostico em cardiologia',
      'centro de diagnostico cardiologia',
      'cdc',
    ],
    meta: 8,
  },
  {
    padroes: [
      'ph__cursos',
      'ph_cursos',
      'ph cursos',
      'phcursos',
      'ph',
    ],
    meta: 12,
  },
  { padroes: ['netmais_provedor', 'net+', 'netmais', 'net mais'], meta: 8 },
  { padroes: ['bakanasnet', 'bakanas', 'bakanas.net'], meta: 12 },
];

/**
 * Verifica se o cliente deve ser excluído do acompanhamento de metas mensais.
 */
export function ehClienteSemMeta(nome?: string | null): boolean {
  if (!nome) return false;
  const n = normalizarTexto(nome);
  return CLIENTES_SEM_META_NOMES.some((ign) => n.includes(ign));
}

/**
 * Obtém a meta mensal de postagens do cliente:
 * 1. Se o cliente for da lista de ignorados, retorna 0.
 * 2. Se já tiver valor explícito no banco (`posts_mes` + `reels_mes`), respeita esse valor.
 * 3. Se for 0 ou nulo, aplica a meta padrão oficial pelo nome.
 */
export function obterMetaCliente(cliente: {
  nome: string;
  posts_mes?: number | null;
  reels_mes?: number | null;
}): number {
  if (ehClienteSemMeta(cliente.nome)) {
    return 0;
  }

  const metaBanco = (cliente.posts_mes || 0) + (cliente.reels_mes || 0);
  if (metaBanco > 0) {
    return metaBanco;
  }

  const n = normalizarTexto(cliente.nome);

  // Busca correspondência nas metas oficiais
  for (const { padroes, meta } of METAS_MENSAIS_OFICIAIS) {
    for (const p of padroes) {
      if (p === 'ph') {
        // Aceita 'ph' isolado, ou prefixos/sufixos com @ ou _ (ex: @ph__cursos, ph_cursos, posto ph)
        const regexPh = /(?:^|[@_\s])ph(?:$|[@_\s])/i;
        if (regexPh.test(n)) return meta;
      } else if (n.includes(p)) {
        return meta;
      }
    }
  }

  return 0;
}
