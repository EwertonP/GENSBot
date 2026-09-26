import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token do link público de relatório (/relatorio/[token]) — SÓ SERVIDOR.
 *
 * Formato v2: `r2_<payload base64url>.<assinatura HMAC-SHA256 base64url>`.
 * O token carrega a conta e o dono (quem gerou o link); sem a assinatura
 * válida o servidor recusa — antes era JSON em base64 puro e qualquer pessoa
 * podia montar um link para outra conta conectada.
 *
 * Chave: `RELATORIO_TOKEN_SECRET` se existir; senão é derivada da
 * `SUPABASE_SERVICE_ROLE_KEY` (já presente no servidor), para não exigir
 * variável nova no deploy. Trocar qualquer uma das duas invalida os links.
 *
 * Links antigos (`rel_…`, sem assinatura) são recusados de propósito.
 */

export const REPORT_PERIODS = [7, 30, 90] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export interface RelatorioTokenData {
  /** instagram_user_id da conta do relatório */
  accountId: string;
  /** Dias do período (7, 30 ou 90 — limite de retenção de insights da Meta). */
  period: ReportPeriod;
  clienteNome: string;
  /** user.id de quem gerou o link; a conta precisa continuar sendo dessa pessoa. */
  ownerId: string;
  criadoEm: string;
}

function signingKey(): Buffer {
  const explicit = process.env.RELATORIO_TOKEN_SECRET;
  if (explicit && explicit.length >= 16) return Buffer.from(explicit);
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || base === 'placeholder-key') {
    throw new Error('Sem segredo para assinar links de relatório (defina RELATORIO_TOKEN_SECRET).');
  }
  return createHmac('sha256', base).update('gensbot:relatorio-token:v2').digest();
}

const b64url = (buf: Buffer) => buf.toString('base64url');
const sign = (payload: string) => b64url(createHmac('sha256', signingKey()).update(payload).digest());

export function gerarTokenRelatorio(data: Omit<RelatorioTokenData, 'criadoEm'>): string {
  const payload = b64url(
    Buffer.from(
      JSON.stringify({ v: 2, a: data.accountId, p: data.period, n: data.clienteNome, u: data.ownerId, t: Date.now() })
    )
  );
  return `r2_${payload}.${sign(payload)}`;
}

/** Devolve os dados do token ou `null` se ausente, antigo, adulterado ou malformado. */
export function verificarTokenRelatorio(token: string | null | undefined): RelatorioTokenData | null {
  if (!token || !token.startsWith('r2_')) return null;
  const [payload, signature] = token.slice(3).split('.');
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (parsed.v !== 2 || typeof parsed.a !== 'string' || typeof parsed.u !== 'string') return null;
    const period = REPORT_PERIODS.includes(parsed.p) ? (parsed.p as ReportPeriod) : 30;
    return {
      accountId: parsed.a,
      period,
      clienteNome: typeof parsed.n === 'string' && parsed.n.trim() ? parsed.n.trim() : 'Cliente',
      ownerId: parsed.u,
      criadoEm: new Date(typeof parsed.t === 'number' ? parsed.t : Date.now()).toISOString(),
    };
  } catch {
    return null;
  }
}

export function obterUrlBaseApp(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://allingens.vercel.app')
  );
}
