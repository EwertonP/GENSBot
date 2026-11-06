/**
 * O que a cliente vê do texto de uma demanda no link do mês.
 *
 * O briefing da agência mistura o que é para a cliente (fala, texto na tela,
 * texto dos slides) com notas internas (produção visual, avisos de validação).
 * Só a parte visível sai do servidor; ao aceitar uma sugestão da cliente, a
 * parte interna é recolocada para nada se perder.
 */

/** Seção `## ...` cujo título indica uso interno da agência. */
const SECAO_INTERNA = /produ[cç][aã]o|bastidor|interno|refer[eê]ncia visual|dire[cç][aã]o de arte/i;
/** Linha solta antes da primeira seção que é aviso interno. */
const LINHA_INTERNA = /^\s*(⚠️|⚠|\[interno\]|validar\b)/i;

export interface RoteiroSeparado {
  visivel: string;
  interno: string;
}

function limpar(t: string): string {
  return t.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Separa o briefing em parte visível para a cliente e notas internas. */
export function separarRoteiro(texto: string | null | undefined): RoteiroSeparado {
  const linhas = (texto ?? '').replace(/\r\n/g, '\n').split('\n');
  const visivel: string[] = [];
  const interno: string[] = [];
  let secaoInterna = false;
  let dentroDeSecao = false;

  for (const linha of linhas) {
    const titulo = /^#{1,3}\s+(.*)$/.exec(linha);
    if (titulo) {
      dentroDeSecao = true;
      secaoInterna = SECAO_INTERNA.test(titulo[1]);
    }
    if (secaoInterna || (!dentroDeSecao && LINHA_INTERNA.test(linha))) interno.push(linha);
    else visivel.push(linha);
  }
  return { visivel: limpar(visivel.join('\n')), interno: limpar(interno.join('\n')) };
}

/** Recoloca as notas internas depois do texto que a cliente aprovou. */
export function juntarRoteiro(visivel: string, interno: string): string {
  const v = limpar(visivel);
  const i = limpar(interno);
  if (!i) return v;
  if (!v) return i;
  // Aviso solto (sem seção) volta para o topo; seções internas vão para o fim.
  const avisoNoTopo = !/^#{1,3}\s/.test(i);
  return avisoNoTopo ? `${i}\n\n${v}` : `${v}\n\n${i}`;
}

/** Prefixos internos do título, como "[Dra. Camila Lucas] [Carrossel] ". */
const PREFIXO_TITULO = /^(\s*\[[^\]]{1,60}\]\s*)+/;

export function separarTitulo(titulo: string | null | undefined): { prefixo: string; texto: string } {
  const t = titulo ?? '';
  const m = PREFIXO_TITULO.exec(t);
  if (!m) return { prefixo: '', texto: t.trim() };
  return { prefixo: m[0], texto: t.slice(m[0].length).trim() };
}

export function limparTitulo(titulo: string | null | undefined): string {
  return separarTitulo(titulo).texto;
}

export type FormatoPost = 'reels' | 'carrossel' | 'story' | 'post';

export const ROTULO_FORMATO: Record<FormatoPost, string> = {
  reels: 'Reels',
  carrossel: 'Carrossel',
  story: 'Story',
  post: 'Post',
};

/** Formato para mostrar: tipo da demanda, etiqueta do título ou nº de arquivos. */
export function formatoDoPost(tipo: string, titulo: string | null | undefined, qtdArquivos = 0): FormatoPost {
  if (tipo === 'reel') return 'reels';
  if (tipo === 'story') return 'story';
  const prefixo = separarTitulo(titulo).prefixo.toLowerCase();
  if (/carrossel|carousel/.test(prefixo) || qtdArquivos > 1) return 'carrossel';
  if (/reels?\b/.test(prefixo)) return 'reels';
  if (/story|stories/.test(prefixo)) return 'story';
  return 'post';
}

/** Texto que a cliente vê de cada campo. */
export function textoVisivel(campo: 'titulo' | 'briefing' | 'legenda', valor: string | null | undefined): string {
  if (campo === 'titulo') return limparTitulo(valor);
  if (campo === 'briefing') return separarRoteiro(valor).visivel;
  return (valor ?? '').trim();
}

/** Valor completo a gravar quando a agência aceita a sugestão da cliente. */
export function recomporCampo(campo: 'titulo' | 'briefing' | 'legenda', proposto: string, atual: string | null | undefined): string {
  if (campo === 'titulo') {
    const { prefixo } = separarTitulo(atual);
    return `${prefixo}${proposto.trim()}`;
  }
  if (campo === 'briefing') return juntarRoteiro(proposto, separarRoteiro(atual).interno);
  return proposto.trim();
}

// ---------------- Renderização simples do roteiro ----------------

export type BlocoRoteiro =
  | { tipo: 'secao'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'item'; texto: string; marcador: string }
  | { tipo: 'paragrafo'; texto: string };

/**
 * Converte o markdown do roteiro em blocos: `## Seção`, linha inteira em
 * negrito (`**Cena 1**`) como subtítulo, itens de lista e parágrafos.
 * O negrito no meio da linha fica para `partesNegrito`.
 */
export function blocosDoRoteiro(texto: string | null | undefined): BlocoRoteiro[] {
  const blocos: BlocoRoteiro[] = [];
  let paragrafo: string[] = [];
  const fechar = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', texto: paragrafo.join('\n') });
    paragrafo = [];
  };

  for (const bruta of (texto ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const linha = bruta.trimEnd();
    if (!linha.trim()) {
      fechar();
      continue;
    }
    const sec = /^#{1,3}\s+(.*)$/.exec(linha);
    if (sec) {
      fechar();
      blocos.push({ tipo: 'secao', texto: sec[1].trim() });
      continue;
    }
    const sub = /^\s*\*\*([^*]+)\*\*\s*:?\s*$/.exec(linha);
    if (sub) {
      fechar();
      blocos.push({ tipo: 'subtitulo', texto: sub[1].trim().replace(/:$/, '') });
      continue;
    }
    const item = /^\s*([-•*]|\d{1,2}[.)])\s+(.*)$/.exec(linha);
    if (item) {
      fechar();
      blocos.push({ tipo: 'item', marcador: /\d/.test(item[1]) ? item[1].replace(')', '.') : '•', texto: item[2] });
      continue;
    }
    paragrafo.push(linha.trim());
  }
  fechar();
  return blocos;
}

/** Divide o texto em trechos normais e em negrito (`**assim**`). */
export function partesNegrito(texto: string): { texto: string; negrito: boolean }[] {
  const partes: { texto: string; negrito: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index), negrito: false });
    partes.push({ texto: m[1], negrito: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), negrito: false });
  return partes;
}

/** Texto puro do roteiro (sem marcação), para o botão "Copiar". */
export function roteiroComoTextoPuro(texto: string | null | undefined): string {
  return blocosDoRoteiro(texto)
    .map((b) => {
      const t = b.texto.replace(/\*\*([^*]+)\*\*/g, '$1');
      if (b.tipo === 'secao') return `\n${t.toUpperCase()}`;
      if (b.tipo === 'item') return `${b.marcador} ${t}`;
      return t;
    })
    .join('\n')
    .trim();
}
