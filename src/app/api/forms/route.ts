import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-api';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const clienteId = searchParams.get('cliente_id');

    let query = supabase
      .from('forms')
      .select('*, clientes(nome, cor)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (clienteId && clienteId !== 'all') {
      query = query.eq('cliente_id', clienteId);
    }

    const { data: forms, error } = await query;
    if (error) throw error;

    // Busca contagem de respostas para cada formulário
    const formIds = (forms || []).map((f) => f.id);
    const countsMap: Record<string, number> = {};

    if (formIds.length > 0) {
      const { data: responseCounts } = await supabase
        .from('form_responses')
        .select('form_id')
        .in('form_id', formIds);

      (responseCounts || []).forEach((r) => {
        countsMap[r.form_id] = (countsMap[r.form_id] || 0) + 1;
      });
    }

    const enrichedForms = (forms || []).map((f) => ({
      ...f,
      cliente_nome: f.clientes?.nome || null,
      total_respostas: countsMap[f.id] || 0,
    }));

    return NextResponse.json(enrichedForms);
  } catch (error: any) {
    console.error('Erro ao listar formulários:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const body = await req.json();
    const { titulo, cliente_id, template } = body || {};

    if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
      return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
    }

    // Gera slug único
    const baseSlug = slugify(titulo);
    const randomSuffix = crypto.randomUUID().slice(0, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Busca cor e dados do cliente para o tema se selecionado
    let corPrimaria = '#d8ff3c';
    if (cliente_id) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('cor')
        .eq('id', cliente_id)
        .maybeSingle();

      if (cliente?.cor) {
        corPrimaria = cliente.cor;
      }
    }

    const temaConfig = {
      cor_primaria: corPrimaria,
      cor_fundo: '#09090b',
      cor_texto: '#f4f4f5',
      cor_card: '#141417',
      modo: 'dark',
    };

    // 1. Cria o formulário
    const { data: newForm, error: formError } = await supabase
      .from('forms')
      .insert({
        user_id: user.id,
        cliente_id: cliente_id || null,
        slug,
        titulo: titulo.trim(),
        descricao: body.descricao || null,
        publicado: false,
        tema_config: temaConfig,
        notificacao_whatsapp_numero: body.notificacao_whatsapp_numero || null,
      })
      .select()
      .single();

    if (formError || !newForm) throw formError;

    // 2. Cria perguntas padrão iniciais para acelerar a criação
    const starterFields = [
      {
        form_id: newForm.id,
        tipo: 'welcome',
        label: `Bem-vindo(a)!`,
        descricao: 'Preencha este formulário rápido para avaliarmos o seu caso com todo o carinho.',
        obrigatorio: true,
        ordem: 0,
        opcoes: [],
      },
      {
        form_id: newForm.id,
        tipo: 'text',
        label: 'Qual é o seu nome completo?',
        placeholder: 'Digite seu nome...',
        obrigatorio: true,
        ordem: 1,
        opcoes: [],
      },
      {
        form_id: newForm.id,
        tipo: 'whatsapp',
        label: 'Qual o seu WhatsApp com DDD?',
        descricao: 'Entraremos em contato com você por aqui.',
        placeholder: '(11) 99999-9999',
        obrigatorio: true,
        ordem: 2,
        opcoes: [],
      },
      {
        form_id: newForm.id,
        tipo: 'choice',
        label: 'Qual procedimento ou serviço mais te interessa?',
        obrigatorio: true,
        ordem: 3,
        opcoes: [
          { id: crypto.randomUUID(), label: 'Avaliação Inicial' },
          { id: crypto.randomUUID(), label: 'Procedimento Específico' },
          { id: crypto.randomUUID(), label: 'Dúvidas e Valores' },
        ],
      },
      {
        form_id: newForm.id,
        tipo: 'thank_you',
        label: 'Muito obrigado!',
        descricao: 'Recebemos suas respostas e entraremos em contato em breve pelo WhatsApp.',
        obrigatorio: false,
        ordem: 4,
        opcoes: [],
      },
    ];

    const { error: fieldsError } = await supabase.from('form_fields').insert(starterFields);
    if (fieldsError) {
      console.warn('Erro ao inserir campos iniciais:', fieldsError);
    }

    return NextResponse.json(newForm, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
