import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { respostaErro } from '@/lib/clientes-server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) return respostaErro('Token inválido.', 400);

  try {
    const { data: cliente, error } = await db
      .from('clientes')
      .select(`
        id, nome, nicho, cor, cor_capa, foto_url, foto_url_dark,
        persona, raio_x, posicionamento, tom_de_voz, paleta_cores,
        concorrentes, briefing, observacoes,
        agencia:agencias(nome, email_contato, telefone_contato)
      `)
      .eq('token_estrategia', token)
      .maybeSingle();

    if (error || !cliente) {
      return respostaErro('Dossiê estratégico não encontrado ou desativado.', 404);
    }

    return NextResponse.json({ estrategia: cliente });
  } catch (err) {
    console.error('Erro ao buscar estratégia pública:', err);
    return respostaErro('Erro interno.', 500);
  }
}
