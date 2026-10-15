import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIXO = 'enc:v1:';

/** AI_KEYS_SECRET: 32 bytes em base64 (ex.: `openssl rand -base64 32`). */
function chave(): Buffer | null {
  const bruto = process.env.AI_KEYS_SECRET;
  if (!bruto) return null;
  const k = Buffer.from(bruto, 'base64');
  return k.length === 32 ? k : null;
}

export const segredoDisponivel = () => chave() !== null;

export const estaCriptografado = (valor?: string | null) => Boolean(valor?.startsWith(PREFIXO));

/** AES-256-GCM. Sem AI_KEYS_SECRET válida lança erro: nunca grava em texto puro. */
export function criptografarSegredo(texto: string): string {
  const k = chave();
  if (!k) throw new Error('AI_KEYS_SECRET não configurada (precisa ter 32 bytes em base64).');
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', k, iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return `${PREFIXO}${iv.toString('base64')}:${tag.toString('base64')}:${dados.toString('base64')}`;
}

/**
 * Devolve o texto claro. Valores sem o prefixo são chaves antigas em texto puro e passam
 * direto (até serem recriptografadas). Falha de descriptografia devolve null, sem lançar.
 */
export function descriptografarSegredo(valor?: string | null): string | null {
  if (!valor) return null;
  if (!estaCriptografado(valor)) return valor;

  const k = chave();
  if (!k) {
    console.error('[cripto] Valor criptografado, mas AI_KEYS_SECRET não está configurada.');
    return null;
  }
  try {
    const [iv, tag, dados] = valor.slice(PREFIXO.length).split(':');
    const decifra = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
    decifra.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decifra.update(Buffer.from(dados, 'base64')), decifra.final()]).toString('utf8');
  } catch {
    console.error('[cripto] Não foi possível descriptografar o valor (segredo trocado ou dado corrompido).');
    return null;
  }
}
