/**
 * Utilitários de Formatação Visual do Instagram Nativo
 */

/**
 * Converte o nome ou perfil de um cliente no formato oficial de handle do Instagram (@usuario)
 */
export function formatarHandleInstagram(nome?: string | null): string {
  if (!nome || !nome.trim()) return '@usuario';
  const limpo = nome.trim();
  if (limpo.startsWith('@')) return limpo;
  return `@${limpo.toLowerCase().replace(/[^a-z0-9_.]/g, '_')}`;
}

/**
 * Calcula a escala dinâmica das bolinhas de paginação do carrossel estilo Instagram oficial
 */
export function calcularEscalaDotCarrossel(
  indiceDot: number,
  slideAtual: number,
  totalSlides: number
): 'scale-100' | 'scale-75' | 'scale-50' {
  if (totalSlides <= 5) return 'scale-100';
  const distancia = Math.abs(slideAtual - indiceDot);
  if (distancia >= 3) return 'scale-50';
  if (distancia >= 2) return 'scale-75';
  return 'scale-100';
}
