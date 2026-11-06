import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { notificar } from '@/lib/notificar';
import { etapaNoLinkDoMes } from '@/lib/link-do-mes';
import { campoValido, podeSugerirTexto, ROTULO_CAMPO, validarSugestao } from '@/lib/sugestoes-texto';
import type { StatusConteudo } from '@/lib/conteudo';

type Params = { params: Promise<{ token: string }> };

/**
 * A cliente sugere uma mudança no texto de um post em planejamento.
 * Nada é sobrescrito: a sugestão fica pendente até a agência aceitar ou recusar.
 */
export async function POST(req: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) return NextResponse.json({ error: 'Token não fornecido.' }, { status: 400 });

  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, agencia_id, nome')
    .eq('token_aprovacao_mes', token)
    .maybeSingle();
  if (!cliente) return NextResponse.json({ error: 'Link não encontrado ou expirado.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const itemId = typeof body.item_id === 'string' ? body.item_id : '';
  const campo = body.campo;
  const autor = typeof body.autor === 'string' ? body.autor.trim().slice(0, 80) : '';

  if (!itemId || !campoValido(campo)) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  if (!autor) return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });

  const { data: item } = await supabase
    .from('conteudo_items')
    .select('id, cliente_id, agencia_id, status, titulo, briefing, legenda, responsavel_id, co_responsaveis_ids, visivel_cliente, arquivada_em')
    .eq('id', itemId)
    .maybeSingle();

  if (!item || item.cliente_id !== cliente.id || item.visivel_cliente === false || item.arquivada_em) {
    return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  }

  const etapa = etapaNoLinkDoMes(item.status as StatusConteudo);
  if (!etapa || !podeSugerirTexto(etapa)) {
    return NextResponse.json(
      { error: 'Este post já está em produção. Use "Pedir ajuste" quando ele chegar para sua aprovação.' },
      { status: 409 }
    );
  }

  const atual = (item as Record<string, string | null>)[campo];
  const valid = validarSugestao(campo, body.texto, atual);
  if (!valid.ok) return NextResponse.json({ error: valid.erro }, { status: 400 });

  const agora = new Date().toISOString();
  const dados = { texto_original: atual ?? null, texto_proposto: valid.texto, autor, criado_em: agora };

  // Uma pendente por campo: reenviar substitui a anterior.
  const { data: existente } = await supabase
    .from('conteudo_sugestoes_texto')
    .select('id')
    .eq('item_id', item.id)
    .eq('campo', campo)
    .eq('status', 'pendente')
    .maybeSingle();

  const { error } = existente
    ? await supabase.from('conteudo_sugestoes_texto').update(dados).eq('id', existente.id)
    : await supabase.from('conteudo_sugestoes_texto').insert({ ...dados, agencia_id: item.agencia_id, item_id: item.id, campo });

  if (error) {
    console.error('[sugestao-texto] falhou:', error.message);
    return NextResponse.json({ error: 'Não foi possível enviar a sugestão.' }, { status: 500 });
  }

  await notificar([item.responsavel_id, ...(Array.isArray(item.co_responsaveis_ids) ? item.co_responsaveis_ids : [])], {
    tipo: 'cliente_sugeriu_texto',
    titulo: `${cliente.nome} sugeriu mudança no texto`,
    corpo: `${ROTULO_CAMPO[campo]}: ${item.titulo || 'Publicação'}`,
    url: `/?tab=esteira&item=${item.id}`,
  });

  return NextResponse.json({ ok: true });
}
