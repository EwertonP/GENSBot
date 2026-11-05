import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, type ContextoAgencia } from '@/lib/clientes-server';
import type { DadosAgenciaContratada } from '@/types/documentos';

export async function contextoDocumentos(): Promise<
  { ok: true; ctx: ContextoAgencia } | { ok: false; response: NextResponse }
> {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth;
  // Membros e master podem operar documentos (comercial)
  if (auth.ctx.membro.papel === 'cliente') {
    return { ok: false, response: respostaErro('Acesso restrito à equipe da agência.', 403) };
  }
  return auth;
}

/** Verifica se a agência possui os dados mínimos como CONTRATADA */
export function verificarPerfilAgencia(agencia: Partial<DadosAgenciaContratada> | null | undefined): {
  completo: boolean;
  faltantes: string[];
} {
  const faltantes: string[] = [];
  if (!agencia) return { completo: false, faltantes: ['Cadastro da agência'] };

  if (!agencia.cnpj_cpf?.trim()) faltantes.push('CNPJ / CPF');
  if (!agencia.razao_social?.trim() && !agencia.nome?.trim()) faltantes.push('Razão Social / Nome');
  if (!agencia.endereco?.trim()) faltantes.push('Endereço completo');
  if (!agencia.chave_pix?.trim()) faltantes.push('Chave PIX');
  if (!agencia.telefone_contato?.trim()) faltantes.push('Telefone de contato');

  return {
    completo: faltantes.length === 0,
    faltantes,
  };
}

/** Extrai IP do cliente a partir dos headers da requisição */
export function obterIpRequisicao(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}
