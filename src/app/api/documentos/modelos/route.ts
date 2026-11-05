import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos } from '@/lib/documentos-server';
import { obterModelosPadrao } from '@/lib/documentos-modelos';
import { respostaErro } from '@/lib/clientes-server';
import type { TipoDocumento } from '@/types/documentos';

export async function GET(req: Request) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const tipoParam = searchParams.get('tipo');
  const tipo = (tipoParam === 'proposta' || tipoParam === 'contrato') ? (tipoParam as TipoDocumento) : undefined;

  try {
    const padroes = obterModelosPadrao(tipo);

    // Busca modelos personalizados salvos pela agência no banco
    const query = db
      .from('modelos_documento')
      .select('id, agencia_id, tipo, categoria, titulo, descricao, conteudo_html, variaveis, padrao, criado_em, atualizado_em')
      .or(`agencia_id.is.null,agencia_id.eq.${membro.agencia_id}`)
      .order('criado_em', { ascending: false });

    if (tipo) {
      query.eq('tipo', tipo);
    }

    const { data: doBanco, error } = await query;

    if (error && error.code !== '42P01') {
      console.warn('Erro ao consultar modelos_documento:', error);
    }

    // Se tabela ainda não existir no banco ou estiver vazia, usa os padrões do código
    const personalizados = (doBanco || []).filter((m) => m.agencia_id === membro.agencia_id);
    const bancoPadroes = (doBanco || []).filter((m) => !m.agencia_id);

    // Se houver padrões no banco, une, caso contrário usa os embutidos
    const listaFinal = [...personalizados, ...(bancoPadroes.length > 0 ? bancoPadroes : padroes)];

    return NextResponse.json({ modelos: listaFinal });
  } catch (err) {
    console.error('Erro na rota de modelos:', err);
    return NextResponse.json({ modelos: obterModelosPadrao(tipo) });
  }
}

export async function POST(req: Request) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    if (!body.titulo?.trim()) return respostaErro('Título do modelo é obrigatório.', 400);
    if (!body.conteudo_html?.trim()) return respostaErro('Conteúdo do modelo é obrigatório.', 400);

    const payload = {
      agencia_id: membro.agencia_id,
      tipo: body.tipo === 'contrato' ? 'contrato' : 'proposta',
      categoria: body.categoria || 'social_media',
      titulo: body.titulo.trim(),
      descricao: body.descricao?.trim() || null,
      conteudo_html: body.conteudo_html,
      variaveis: body.variaveis || [],
      padrao: false,
    };

    const { data, error } = await db
      .from('modelos_documento')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar modelo:', error);
      return respostaErro('Não foi possível salvar o modelo de documento.', 500);
    }

    return NextResponse.json({ modelo: data }, { status: 201 });
  } catch (err) {
    console.error('Erro ao criar modelo:', err);
    return respostaErro('Erro ao processar dados.', 500);
  }
}
