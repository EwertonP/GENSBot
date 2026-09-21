import { NextResponse } from 'next/server';
import { ehUuid } from '@/lib/clientes';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

type Params = { params: Promise<{ id: string; contatoId: string }> };

// DELETE: remove um contato. Exige que ele pertença ao cliente da URL, para que
// um id de contato solto não possa ser apagado por outro caminho.
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id, contatoId } = await params;
  if (!ehUuid(id) || !ehUuid(contatoId)) return respostaErro('Contato não encontrado.', 404);

  const { data, error } = await supabase
    .from('cliente_contatos')
    .delete()
    .eq('id', contatoId)
    .eq('cliente_id', id)
    .select('id')
    .maybeSingle();

  if (error) return traduzirErroBanco(error, 'DELETE contato');
  if (!data) return respostaErro('Contato não encontrado.', 404);
  return NextResponse.json({ ok: true });
}
