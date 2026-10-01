/** Formatação dos dados de contato pra tela/CSV — puro, roda no servidor e no cliente. */

/** "+5581999998888" → "(81) 99999-8888". Qualquer outro formato volta como veio. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const m = phone.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}

/** Respostas do lead guardadas em `flow_state`. Chaves com `_` são estado interno do motor (ex: `_capture`) e ficam de fora. */
export function respostasDe(flowState: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries((flowState as Record<string, unknown>) || {})) {
    if (key.startsWith('_') || value === null || value === undefined || typeof value === 'object') continue;
    out[key] = String(value);
  }
  return out;
}

/** "01/10/2026 14:32" — data e hora curtas, em pt-BR. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
