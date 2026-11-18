/**
 * Telefones do WhatsApp e da agenda chegam em formatos diferentes: JID do
 * WhatsApp (`5583999990001@c.us`), com sufixo de aparelho (`…:12@s.whatsapp.net`),
 * `@lid` (sem telefone), e E.164 do Cal.com (`+5583999990001`). Brasileiros
 * aparecem ora com o 9º dígito, ora sem. Tudo que compara telefone passa por aqui.
 */

export interface TelefoneDoJid {
  /** Só dígitos, ou null quando o JID não carrega telefone (`@lid`). */
  digitos: string | null;
  ehLid: boolean;
}

/** Extrai o telefone de um JID do WhatsApp (ou de um texto qualquer com um número). */
export function telefoneDoJid(jid: string | null | undefined): TelefoneDoJid {
  const texto = String(jid ?? '').trim();
  if (!texto) return { digitos: null, ehLid: false };
  if (/@lid\b/i.test(texto)) return { digitos: null, ehLid: true };
  // Remove o sufixo de aparelho (":12") e o domínio ("@c.us", "@s.whatsapp.net").
  const base = texto.split('@')[0].split(':')[0];
  const digitos = base.replace(/\D/g, '');
  return { digitos: digitos || null, ehLid: false };
}

/**
 * Telefone de um JID do WhatsApp em formato internacional (`+5583999990001`).
 * O JID sempre traz o código do país, então nunca é tratado como número local.
 * Devolve '' para `@lid` e para JID sem número.
 */
export function jidParaE164(jid: string | null | undefined): string {
  const { digitos } = telefoneDoJid(jid);
  return digitos ? `+${digitos}` : '';
}

/**
 * Forma canônica: só dígitos, com o código do país.
 * - Com `+` na frente (E.164): internacional, fica como está.
 * - Sem `+` e com 10 ou 11 dígitos: número local, entra o `55` do Brasil.
 * Devolve '' se não houver número.
 */
export function normalizarTelefoneBR(valor: string | null | undefined): string {
  const bruto = String(valor ?? '').trim();
  const internacional = bruto.startsWith('+');
  const digitos = bruto.replace(/\D/g, '').replace(/^0+/, '');
  if (!digitos) return '';
  if (internacional) return digitos;
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) return digitos;
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

/**
 * Todas as formas em que o mesmo celular brasileiro pode aparecer: com e sem o
 * 9º dígito. Fixo (começa em 2 a 5) e número estrangeiro têm uma forma só.
 */
export function variantesTelefoneBR(valor: string | null | undefined): string[] {
  const canonico = normalizarTelefoneBR(valor);
  if (!canonico) return [];
  if (!canonico.startsWith('55')) return [canonico];

  const ddd = canonico.slice(2, 4);
  const resto = canonico.slice(4);
  if (resto.length === 9 && resto.startsWith('9')) return [canonico, `55${ddd}${resto.slice(1)}`];
  if (resto.length === 8 && /^[6-9]/.test(resto)) return [canonico, `55${ddd}9${resto}`];
  return [canonico];
}

/** Os dois números são o mesmo aparelho, ignorando formato e o 9º dígito? */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const va = variantesTelefoneBR(a);
  const vb = new Set(variantesTelefoneBR(b));
  return va.length > 0 && va.some((v) => vb.has(v));
}
