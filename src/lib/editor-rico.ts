/** Helpers do editor rico da descrição (sem React, testáveis). */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Texto puro (briefing antigo) vira parágrafos HTML: linha em branco separa parágrafos, quebra simples vira <br>. */
export function textoParaHtml(texto: string | null | undefined): string {
  const limpo = (texto ?? '').replace(/\r\n/g, '\n').trim();
  if (!limpo) return '';
  return limpo
    .split(/\n{2,}/)
    .map((bloco) => `<p>${escapar(bloco).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Conteúdo inicial do editor: o HTML salvo, ou o texto antigo convertido. */
export function conteudoInicial(html: string | null | undefined, texto: string | null | undefined): string {
  return html && html.trim() ? html : textoParaHtml(texto);
}

/** HTML vazio do Tiptap (`<p></p>`) conta como vazio. */
export function htmlVazio(html: string): boolean {
  return html.replace(/<(?!img)[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

export const LIMITE_BRIEFING = 5000;
