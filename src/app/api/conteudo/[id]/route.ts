import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

const SELECT_CONTEUDO = `
  *,
  responsavel:membros!responsavel_id(
    id,
    nome,
    email,
    papel,
    cargo
  ),
  editor:membros!editor_id(
    id,
    nome,
    email,
    papel,
    cargo
  ),
  cliente:clientes(
    id,
    nome,
    cor,
    nicho,
    foto_url,
    instagram_account_id,
    contatos:cliente_contatos(
      id,
      nome,
      cargo,
      telefone,
      email,
      e_grupo_whatsapp
    )
  )
`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;
  const { data, error } = await supabase
    .from('conteudo_items')
    .select(SELECT_CONTEUDO)
    .eq('id', id)
    .single();

  if (error || !data) {
    return respostaErro('Item de conteúdo não encontrado', 404);
  }

  return NextResponse.json({ item: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;

  try {
    const body = await req.json();

    // Whitelist de campos permitidos para atualização
    const permitidos = [
      'tipo',
      'status',
      'titulo',
      'legenda',
      'briefing',
      'mes_referencia',
      'ordem',
      'data_programada',
      'prazo',
      'publicado_em',
      'responsavel_id',
      'editor_id',
      'arquivos',
      'comentarios_revisao',
    ];

    const updates: Record<string, any> = {};
    for (const key of permitidos) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    const { data, error } = await supabase
      .from('conteudo_items')
      .update(updates)
      .eq('id', id)
      .select(SELECT_CONTEUDO)
      .single();

    if (error) {
      return traduzirErroBanco(error, 'PATCH /api/conteudo/[id]');
    }

    return NextResponse.json({ item: data });
  } catch {
    return respostaErro('Erro ao processar atualização', 400);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { id } = await params;
  const { error } = await supabase.from('conteudo_items').delete().eq('id', id);

  if (error) {
    return traduzirErroBanco(error, 'DELETE /api/conteudo/[id]');
  }

  return NextResponse.json({ ok: true });
}
