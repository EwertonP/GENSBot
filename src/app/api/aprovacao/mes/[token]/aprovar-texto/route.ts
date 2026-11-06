import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { notificar } from '@/lib/notificar';
import { etapaNoLinkDoMes } from '@/lib/link-do-mes';
import { limparTitulo } from '@/lib/roteiro-cliente';
import type { StatusConteudo } from '@/lib/conteudo';

type Params = { params: Promise<{ token: string }> };

/**
 * A cliente aprova o texto de um post em planejamento. O post continua em
 * planejamento (a equipe segue para a produção); a aprovação fica registrada e
 * o responsável é avisado. Se a equipe aceitar depois uma mudança no texto, a
 * aprovação é desfeita.
 */
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) return NextResponse.json({ error: 'Token não fornecido.' }, { status: 400 });

  const { data: cliente } = await supabase.from('clientes').select('id, nome').eq('token_aprovacao_mes', token).maybeSingle();
  if (!cliente) return NextResponse.json({ error: 'Link não encontrado ou expirado.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const itemId = typeof body.item_id === 'string' ? body.item_id : '';
  const autor = typeof body.autor === 'string' ? body.autor.trim().slice(0, 80) : '';
  if (!itemId) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  if (!autor) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });

  const { data: item } = await supabase.from('conteudo_items').select('*').eq('id', itemId).maybeSingle();
  if (!item || item.cliente_id !== cliente.id || item.visivel_cliente === false || item.arquivada_em) {
    return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  }
  if (etapaNoLinkDoMes(item.status as StatusConteudo) !== 'texto') {
    return NextResponse.json({ error: 'Este post já saiu do planejamento.' }, { status: 409 });
  }
  if (item.texto_aprovado_em) return NextResponse.json({ ok: true, ja_aprovado: true });

  // Há sugestão pendente: a cliente ainda está pedindo mudança, então não aprova o texto atual.
  const { count } = await supabase
    .from('conteudo_sugestoes_texto')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', item.id)
    .eq('status', 'pendente');
  if (count && count > 0) {
    return NextResponse.json({ error: 'Você tem uma sugestão de mudança aguardando a equipe. Aprove depois que ela for resolvida.' }, { status: 409 });
  }

  const agora = new Date().toISOString();
  const { data: atualizado, error } = await supabase
    .from('conteudo_items')
    .update({ texto_aprovado_em: agora, texto_aprovado_por: autor, atualizado_em: agora })
    .eq('id', item.id)
    .is('texto_aprovado_em', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[aprovar-texto] falhou:', error.message);
    return NextResponse.json({ error: 'Não foi possível registrar a aprovação.' }, { status: 500 });
  }
  if (!atualizado) return NextResponse.json({ ok: true, ja_aprovado: true });

  await notificar([item.responsavel_id, ...(Array.isArray(item.co_responsaveis_ids) ? item.co_responsaveis_ids : [])], {
    tipo: 'cliente_aprovou',
    titulo: `${cliente.nome} aprovou o texto`,
    corpo: limparTitulo(item.titulo) || 'Publicação',
    url: `/?tab=esteira&item=${item.id}`,
  });

  return NextResponse.json({ ok: true });
}
