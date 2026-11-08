/**
 * Utilitários de Formatação Visual do Instagram Nativo
 */

/**
 * Retorna o username limpo do Instagram SEM o caractere '@'
 * (como aparece no cabeçalho e na legenda dos posts oficiais do app)
 */
export function formatarUsernameInstagram(
  nome?: string | null,
  instagramUsername?: string | null
): string {
  if (instagramUsername && instagramUsername.trim()) {
    return instagramUsername.trim().replace(/^@/, '');
  }
  if (!nome || !nome.trim()) return 'perfil';
  const limpo = nome.trim().replace(/^@/, '');
  return limpo.toLowerCase().replace(/[^a-z0-9_.]/g, '_');
}

/**
 * Converte o nome ou perfil de um cliente no formato de menção (@usuario)
 */
export function formatarHandleInstagram(nome?: string | null): string {
  if (!nome || !nome.trim()) return '@usuario';
  const limpo = nome.trim();
  if (limpo.startsWith('@')) return limpo;
  return `@${limpo.toLowerCase().replace(/[^a-z0-9_.]/g, '_')}`;
}

/**
 * Formata o tempo transcorrido no estilo minúsculo oficial do Instagram ("há 3 horas", "há 37 minutos")
 */
export function formatarTempoRelativoInstagram(data?: string | Date | null): string {
  if (!data) return 'há 3 horas';
  try {
    const d = typeof data === 'string' ? new Date(data) : data;
    if (isNaN(d.getTime())) return 'há 3 horas';
    const agora = Date.now();
    const diffMs = Math.max(0, agora - d.getTime());
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHoras = Math.floor(diffMin / 60);
    const diffDias = Math.floor(diffHoras / 24);

    if (diffMin < 60) {
      return `há ${Math.max(1, diffMin)} minutos`;
    }
    if (diffHoras < 24) {
      return `há ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
    }
    return `há ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'}`;
  } catch {
    return 'há 3 horas';
  }
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

export interface MetricasInstagramSimuladas {
  curtidas: number;
  comentarios: number;
  reposts: number;
}

/**
 * Gera métricas aleatórias realistas (0 a 200) para curtidas, comentários e reposts
 */
export function gerarMetricasAleatoriasInstagram(): MetricasInstagramSimuladas {
  const curtidas = Math.floor(Math.random() * 189) + 10;
  const comentarios = Math.floor(Math.random() * 59) + 2;
  const reposts = Math.floor(Math.random() * 30) + 1;
  return { curtidas, comentarios, reposts };
}
