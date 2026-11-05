import crypto from 'crypto';
import { supabase as db } from '@/lib/supabase';

export type TipoEventoContrato =
  | 'criado'
  | 'enviado'
  | 'visualizado'
  | 'assinado_cliente'
  | 'contra_assinado'
  | 'cancelado'
  | 'link_revogado'
  | 'pdf_gerado';

export interface EventoContrato {
  id?: string;
  contrato_id: string;
  agencia_id: string;
  tipo: TipoEventoContrato;
  ip?: string | null;
  user_agent?: string | null;
  membro_id?: string | null;
  dados?: Record<string, any>;
  criado_em?: string;
}

/**
 * Gera hash SHA-256 (hex) do conteúdo HTML congelado do contrato.
 * Garante a integridade jurídica e imutabilidade do documento.
 */
export function hashDocumento(conteudoHtml: string): string {
  const normalizado = (conteudoHtml || '').trim();
  return crypto.createHash('sha256').update(normalizado, 'utf8').digest('hex');
}

/**
 * Valida os dados de identificação do signatário (nome e CPF/CNPJ).
 */
export function validarDadosSignatario(
  nome: string,
  doc: string,
  email?: string | null
): { valido: boolean; erro?: string } {
  const nomeLimpo = (nome || '').trim();
  const partesNome = nomeLimpo.split(/\s+/).filter(Boolean);

  if (partesNome.length < 2) {
    return { valido: false, erro: 'Informe seu nome completo (nome e sobrenome).' };
  }

  const docLimpo = (doc || '').replace(/\D/g, '');
  if (docLimpo.length !== 11 && docLimpo.length !== 14) {
    return { valido: false, erro: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' };
  }

  // Verifica se não é sequência repetida básica (ex: 111.111.111-11)
  if (/^(\d)\1+$/.test(docLimpo)) {
    return { valido: false, erro: 'Número de documento inválido.' };
  }

  if (email && email.trim()) {
    const emailLimpo = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      return { valido: false, erro: 'Informe um endereço de e-mail válido.' };
    }
  }

  return { valido: true };
}

/**
 * Verifica se um contrato está apto para receber assinatura do cliente.
 */
export function podeAssinarContrato(contrato: {
  status: string;
  expira_em?: string | null;
  revogado_em?: string | null;
}): { pode: boolean; motivo?: string } {
  if (contrato.revogado_em || contrato.status === 'cancelado') {
    return { pode: false, motivo: 'Este contrato foi cancelado ou teve seu link revogado.' };
  }

  if (contrato.status === 'assinado' || contrato.status === 'assinado_cliente') {
    return { pode: false, motivo: 'Este contrato já foi assinado.' };
  }

  if (contrato.status !== 'aguardando_assinatura' && contrato.status !== 'rascunho') {
    return { pode: false, motivo: `Contrato em status incompatível para assinatura (${contrato.status}).` };
  }

  if (contrato.expira_em) {
    const dataExp = new Date(contrato.expira_em);
    if (Date.now() > dataExp.getTime()) {
      return { pode: false, motivo: 'O prazo para assinatura deste link expirou.' };
    }
  }

  return { pode: true };
}

/**
 * Registra um evento na trilha de auditoria do contrato de forma não-bloqueante.
 */
export async function registrarEventoContrato(
  contratoId: string,
  agenciaId: string,
  tipo: TipoEventoContrato,
  dados?: Record<string, any>,
  membroId?: string | null,
  ip?: string | null,
  userAgent?: string | null
): Promise<boolean> {
  try {
    const { error } = await db.from('contrato_eventos').insert({
      contrato_id: contratoId,
      agencia_id: agenciaId,
      tipo,
      dados: dados || {},
      membro_id: membroId || null,
      ip: ip || null,
      user_agent: userAgent || null,
    });

    if (error && error.code !== '42P01') {
      console.warn('Erro ao registrar evento de contrato:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Falha ao registrar evento de contrato:', err);
    return false;
  }
}
