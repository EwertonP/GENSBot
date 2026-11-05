/**
 * Formatação de legenda para o Instagram, que só aceita texto puro: negrito e
 * itálico viram letras unicode ("Matemáticas") que parecem formatadas, e as
 * demais ferramentas trocam a caixa do trecho selecionado.
 */

const A = 'A'.charCodeAt(0);
const a = 'a'.charCodeAt(0);
const ZERO = '0'.charCodeAt(0);

// Início de cada alfabeto unicode (sans-serif).
const NEGRITO = { maiuscula: 0x1d5d4, minuscula: 0x1d5ee, digito: 0x1d7ec };
const ITALICO = { maiuscula: 0x1d608, minuscula: 0x1d622 };

function mapear(texto: string, base: { maiuscula: number; minuscula: number; digito?: number }): string {
  return Array.from(desformatar(texto))
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= A && c <= A + 25) return String.fromCodePoint(base.maiuscula + (c - A));
      if (c >= a && c <= a + 25) return String.fromCodePoint(base.minuscula + (c - a));
      if (base.digito !== undefined && c >= ZERO && c <= ZERO + 9) return String.fromCodePoint(base.digito + (c - ZERO));
      return ch;
    })
    .join('');
}

/** Volta letras unicode formatadas para o alfabeto comum (para reaplicar ou remover o estilo). */
export function desformatar(texto: string): string {
  return Array.from(texto)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      if (cp >= NEGRITO.maiuscula && cp < NEGRITO.maiuscula + 26) return String.fromCharCode(A + cp - NEGRITO.maiuscula);
      if (cp >= NEGRITO.minuscula && cp < NEGRITO.minuscula + 26) return String.fromCharCode(a + cp - NEGRITO.minuscula);
      if (cp >= NEGRITO.digito && cp < NEGRITO.digito + 10) return String.fromCharCode(ZERO + cp - NEGRITO.digito);
      if (cp >= ITALICO.maiuscula && cp < ITALICO.maiuscula + 26) return String.fromCharCode(A + cp - ITALICO.maiuscula);
      if (cp >= ITALICO.minuscula && cp < ITALICO.minuscula + 26) return String.fromCharCode(a + cp - ITALICO.minuscula);
      return ch;
    })
    .join('');
}

export const paraNegrito = (t: string) => mapear(t, NEGRITO);
export const paraItalico = (t: string) => mapear(t, ITALICO);
export const paraMaiusculas = (t: string) => desformatar(t).toLocaleUpperCase('pt-BR');
export const paraMinusculas = (t: string) => desformatar(t).toLocaleLowerCase('pt-BR');
export const paraCapitalizado = (t: string) =>
  desformatar(t)
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s(])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase('pt-BR'));

/** Quantidade de hashtags (o Instagram aceita até 30). */
export function contarHashtags(texto: string): number {
  return (texto.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}
