/**
 * Sugestões de texto da cliente no link do mês (fase 2).
 * Nunca sobrescrevem a demanda: ficam como proposta até a agência aceitar.
 */
import { textoParaHtml } from './editor-rico';

export type CampoSugestao = 'titulo' | 'briefing' | 'legenda';

export const CAMPOS_SUGESTAO: CampoSugestao[] = ['titulo', 'briefing', 'legenda'];

export const LIMITE_CAMPO: Record<CampoSugestao, number> = {
  titulo: 200,
  briefing: 5000,
  legenda: 2200,
};

export const ROTULO_CAMPO: Record<CampoSugestao, string> = {
  titulo: 'Título',
  briefing: 'Roteiro / texto da peça',
  legenda: 'Legenda',
};

export function campoValido(c: unknown): c is CampoSugestao {
  return typeof c === 'string' && (CAMPOS_SUGESTAO as string[]).includes(c);
}

function norm(t: string | null | undefined): string {
  return (t ?? '').replace(/\r\n/g, '\n').trim();
}

export type ResultadoSugestao = { ok: true; texto: string } | { ok: false; erro: string };

/** Valida a sugestão: não vazia, dentro do limite e diferente do texto atual. */
export function validarSugestao(campo: CampoSugestao, texto: unknown, atual: string | null | undefined): ResultadoSugestao {
  if (typeof texto !== 'string') return { ok: false, erro: 'Escreva o texto sugerido.' };
  const novo = norm(texto);
  if (!novo) return { ok: false, erro: 'Escreva o texto sugerido.' };
  if (novo.length > LIMITE_CAMPO[campo]) {
    return { ok: false, erro: `${ROTULO_CAMPO[campo]} aceita até ${LIMITE_CAMPO[campo]} caracteres.` };
  }
  if (novo === norm(atual)) return { ok: false, erro: 'Esse texto é igual ao atual. Altere algo para sugerir.' };
  return { ok: true, texto: novo };
}

/** Colunas de `conteudo_items` que mudam ao aceitar a sugestão. */
export function patchAoAceitar(campo: CampoSugestao, texto: string): Record<string, string> {
  if (campo === 'briefing') return { briefing: texto, briefing_html: textoParaHtml(texto) };
  return { [campo]: texto };
}

/** Só em planejamento a cliente edita o texto-base; depois disso é pedido de ajuste. */
export function podeSugerirTexto(etapa: string): boolean {
  return etapa === 'texto';
}
