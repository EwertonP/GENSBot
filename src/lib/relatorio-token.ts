/**
 * Helper para geração e decodificação de links públicos interativos de relatório
 * no formato: /relatorio/[token]
 */

export interface RelatorioTokenData {
  accountId: string;
  mainMonth: string;
  compMonth: string;
  clienteNome?: string;
  criadoEm?: string;
}

export function gerarTokenRelatorio(data: RelatorioTokenData): string {
  try {
    const payload = JSON.stringify({
      a: data.accountId || 'all',
      m: data.mainMonth || '2026-08',
      c: data.compMonth || '2026-07',
      n: data.clienteNome || 'Cliente',
      t: Date.now(),
    });
    // Base64URL seguro
    const base64 = typeof window !== 'undefined'
      ? btoa(payload)
      : Buffer.from(payload).toString('base64');
    const safeBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `rel_${safeBase64}`;
  } catch {
    return 'rel_default';
  }
}

export function decodificarTokenRelatorio(token: string): RelatorioTokenData {
  const defaultData: RelatorioTokenData = {
    accountId: 'all',
    mainMonth: '2026-08',
    compMonth: '2026-07',
    clienteNome: 'Cliente Agência GENS',
  };

  if (!token || !token.startsWith('rel_')) return defaultData;

  try {
    const cleanToken = token.replace(/^rel_/, '');
    let base64 = cleanToken.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = typeof window !== 'undefined'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);

    return {
      accountId: parsed.a || 'all',
      mainMonth: parsed.m || '2026-08',
      compMonth: parsed.c || '2026-07',
      clienteNome: parsed.n || 'Cliente',
      criadoEm: parsed.t ? new Date(parsed.t).toISOString() : undefined,
    };
  } catch {
    return defaultData;
  }
}

export function obterUrlBaseApp(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://allingens.vercel.app');
}

export function gerarLinkCompletoRelatorio(data: RelatorioTokenData): string {
  const token = gerarTokenRelatorio(data);
  const baseUrl = obterUrlBaseApp();
  return `${baseUrl}/relatorio/${token}`;
}
