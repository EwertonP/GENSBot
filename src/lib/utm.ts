/**
 * Monta a URL final com os parâmetros UTM aplicados. Usa a `URL` nativa em
 * vez de concatenação manual — já resolve `?` vs `&`, encoding e query
 * params pré-existentes na base_url. Lança se `baseUrl` não for uma URL
 * válida; quem chama decide como tratar (client mostra erro, API responde 400).
 */
export function buildUtmUrl(baseUrl: string, params: Record<string, string | undefined | null>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}
