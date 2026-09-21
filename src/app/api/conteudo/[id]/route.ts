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
      'historico_atividades',
      'automacao_config',
    ];

    const updates: Record<string, any> = {};
    for (const key of permitidos) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    // Se houve alteração de status ou envio de novo comentário, registra no histórico (audit trail)
    if ('status' in updates || body.novo_comentario_equipe) {
      const { data: itemAtual } = await supabase
        .from('conteudo_items')
        .select('status, historico_atividades')
        .eq('id', id)
        .single();

      if (itemAtual) {
        const historico = Array.isArray(itemAtual.historico_atividades) ? [...itemAtual.historico_atividades] : [];
        const autorNome = body.autor_nome || auth.ctx.user.email?.split('@')[0] || 'Equipe';

        if ('status' in updates && updates.status !== itemAtual.status) {
          historico.push({
            id: crypto.randomUUID(),
            tipo: 'status',
            autor_nome: autorNome,
            autor_id: auth.ctx.user.id,
            de_status: itemAtual.status,
            para_status: updates.status,
            texto: `Status alterado para ${String(updates.status).toUpperCase()}`,
            criado_em: new Date().toISOString(),
          });
        }

        if (body.novo_comentario_equipe && String(body.novo_comentario_equipe).trim()) {
          historico.push({
            id: crypto.randomUUID(),
            tipo: 'comentario',
            autor_nome: autorNome,
            autor_id: auth.ctx.user.id,
            texto: String(body.novo_comentario_equipe).trim(),
            criado_em: new Date().toISOString(),
          });
        }

        updates.historico_atividades = historico;
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
