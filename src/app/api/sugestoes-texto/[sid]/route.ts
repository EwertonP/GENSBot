import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, validarAcessoItemConteudo } from '@/lib/clientes-server';
import { ehUuid } from '@/lib/clientes';
import { campoValido, patchAoAceitar } from '@/lib/sugestoes-texto';
import { recomporCampo } from '@/lib/roteiro-cliente';

/** Aceita ou recusa uma sugestão de texto. Aceitar grava o texto na demanda. */
export async function POST(req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { sid } = await params;
  if (!ehUuid(sid)) return respostaErro('Sugestão inválida.', 400);

  const body = await req.json().catch(() => ({}));
  const acao = body.acao;
  if (acao !== 'aceitar' && acao !== 'recusar') return respostaErro('Ação inválida.', 400);

  const { data: sug } = await db
    .from('conteudo_sugestoes_texto')
    .select('id, item_id, agencia_id, campo, texto_proposto, status')
    .eq('id', sid)
    .eq('agencia_id', auth.ctx.membro.agencia_id)
    .maybeSingle();
  if (!sug) return respostaErro('Sugestão não encontrada.', 404);
  if (sug.status !== 'pendente') return respostaErro('Esta sugestão já foi resolvida.', 409);
  if (!campoValido(sug.campo)) return respostaErro('Sugestão inválida.', 400);

  const negado = await validarAcessoItemConteudo(auth.ctx, sug.item_id);
  if (negado) return negado;

  const agora = new Date().toISOString();
  let textoAplicado: string | null = null;

  // Marca como resolvida só se ainda estiver pendente (evita aplicar duas vezes).
  const { data: marcada, error: erroMarca } = await db
    .from('conteudo_sugestoes_texto')
    .update({ status: acao === 'aceitar' ? 'aceita' : 'recusada', resolvido_em: agora, resolvido_por: auth.ctx.membro.id })
    .eq('id', sug.id)
    .eq('status', 'pendente')
    .select('id');
  if (erroMarca) return respostaErro('Não foi possível resolver a sugestão.', 500);
  if (!marcada?.length) return respostaErro('Esta sugestão já foi resolvida.', 409);

  if (acao === 'aceitar') {
    // A cliente editou só a parte visível: recoloca prefixo do título e notas internas do roteiro.
    const { data: atualItem } = await db.from('conteudo_items').select('titulo, briefing, legenda').eq('id', sug.item_id).maybeSingle();
    const valorAtual = (atualItem as Record<string, string | null> | null)?.[sug.campo] ?? null;
    const textoFinal = recomporCampo(sug.campo, sug.texto_proposto, valorAtual);
    textoAplicado = textoFinal;
    const { error } = await db
      .from('conteudo_items')
      .update({ ...patchAoAceitar(sug.campo, textoFinal), atualizado_em: agora })
      .eq('id', sug.item_id)
      .eq('agencia_id', auth.ctx.membro.agencia_id);
    if (error) {
      // Desfaz a marcação para a sugestão não se perder.
      await db.from('conteudo_sugestoes_texto').update({ status: 'pendente', resolvido_em: null, resolvido_por: null }).eq('id', sug.id);
      return respostaErro('Não foi possível aplicar o texto na demanda.', 500);
    }
  }

  // texto_final: valor completo gravado (com prefixo/notas internas), para o formulário aberto não sobrescrever.
  return NextResponse.json({ ok: true, status: acao === 'aceitar' ? 'aceita' : 'recusada', texto_final: textoAplicado });
}
