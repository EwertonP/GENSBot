import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { COR_PADRAO, ehCorEtiqueta, nomeEtiquetaValido } from '@/lib/etiquetas';

/** GET /api/etiquetas: etiquetas da agência. */
export async function GET() {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { data, error } = await db
    .from('etiquetas')
    .select('id, nome, cor')
    .eq('agencia_id', auth.ctx.membro.agencia_id)
    .order('nome', { ascending: true });
  if (error) return traduzirErroBanco(error, 'ler as etiquetas');
  return NextResponse.json({ etiquetas: data ?? [] });
}

/** POST /api/etiquetas { nome, cor }: cria uma etiqueta. */
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const corpo = (await req.json().catch(() => null)) as { nome?: unknown; cor?: unknown } | null;
  const nome = nomeEtiquetaValido(corpo?.nome);
  if (!nome) return respostaErro('Dê um nome de até 40 caracteres à etiqueta.', 400);
  const cor = ehCorEtiqueta(corpo?.cor) ? corpo!.cor : COR_PADRAO;

  const { data, error } = await db
    .from('etiquetas')
    .insert({ agencia_id: auth.ctx.membro.agencia_id, nome, cor })
    .select('id, nome, cor')
    .single();
  if (error) {
    if (error.code === '23505') return respostaErro('Já existe uma etiqueta com esse nome.', 409);
    return traduzirErroBanco(error, 'criar a etiqueta');
  }
  return NextResponse.json({ etiqueta: data }, { status: 201 });
}
