import { timingSafeEqual } from 'node:crypto';

/** Compara em tempo constante; aceita o valor puro ou no formato "Bearer <valor>". */
export function segredoConfere(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  const limpo = recebido.startsWith('Bearer ') ? recebido.slice(7) : recebido;
  const a = Buffer.from(limpo);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

const emProducao = () => process.env.NODE_ENV === 'production';

/**
 * Valida a chamada de um cron. Em produção falha fechado: sem CRON_SECRET
 * configurado ninguém entra (antes valia o segredo padrão 'local_secret').
 * Fora de produção a chamada passa, para rodar localmente.
 */
export function validarCron(req: Request): Response | null {
  if (!emProducao()) return null;
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return new Response('CRON_SECRET não configurado', { status: 500 });
  if (!segredoConfere(req.headers.get('Authorization'), esperado)) {
    return new Response('Não autorizado', { status: 401 });
  }
  return null;
}

/**
 * Valida o webhook do OpenWA. Em produção exige OPENWA_WEBHOOK_SECRET e que o
 * gateway o envie em `x-openwa-secret` ou `Authorization`.
 */
export function validarWebhookOpenWA(req: Request): Response | null {
  if (!emProducao()) return null;
  const esperado = process.env.OPENWA_WEBHOOK_SECRET;
  if (!esperado) {
    return Response.json({ error: 'OPENWA_WEBHOOK_SECRET não configurado' }, { status: 503 });
  }
  const recebido = req.headers.get('x-openwa-secret') || req.headers.get('authorization');
  if (!segredoConfere(recebido, esperado)) {
    return Response.json({ error: 'Assinatura inválida do webhook' }, { status: 401 });
  }
  return null;
}
