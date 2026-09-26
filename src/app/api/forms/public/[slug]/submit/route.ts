import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateFieldAnswer } from '@/lib/form-engine';
import type { FormField } from '@/types/form';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const {
      respostas = {},
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      tempo_preenchimento_segundos,
    } = body || {};

    // 1. Busca o formulário e suas perguntas
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, user_id, cliente_id, slug, titulo, publicado, redirect_url, notificacao_whatsapp_numero, tags_padrao')
      .eq('slug', slug)
      .maybeSingle();

    if (formError || !form) {
      return NextResponse.json({ error: 'Formulário não encontrado.' }, { status: 404 });
    }

    if (!form.publicado) {
      return NextResponse.json({ error: 'Este formulário está pausado ou arquivado.' }, { status: 403 });
    }

    const { data: fields } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', form.id)
      .order('ordem', { ascending: true });

    const activeFields = (fields || []) as FormField[];

    // 2. Valida os campos obrigatórios
    for (const field of activeFields) {
      const answer = respostas[field.id];
      const validation = validateFieldAnswer(field, answer);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Erro no campo "${field.label}": ${validation.error}`, fieldId: field.id },
          { status: 400 }
        );
      }
    }

    // 3. Extrai dados chave para criação/atualização de lead (Nome, WhatsApp, E-mail, Procedimento)
    let leadNome: string | null = null;
    let leadWhatsapp: string | null = null;
    let leadEmail: string | null = null;
    const leadTags: string[] = ['Origem: Formulário', `Form: ${form.titulo}`];

    if (form.tags_padrao && Array.isArray(form.tags_padrao)) {
      leadTags.push(...form.tags_padrao);
    }

    for (const field of activeFields) {
      const answer = respostas[field.id];
      if (!answer) continue;

      if (field.tipo === 'text' && !leadNome && /nome/i.test(field.label)) {
        leadNome = String(answer).trim();
      }
      if (field.tipo === 'whatsapp' || (field.tipo === 'text' && /whatsapp|telefone|celular/i.test(field.label))) {
        leadWhatsapp = String(answer).trim();
      }
      if (field.tipo === 'email') {
        leadEmail = String(answer).trim().toLowerCase();
      }
      if (field.tipo === 'choice') {
        // Encontra o texto da opção selecionada para adicionar como tag de interesse
        let optionLabel = String(answer);
        if (field.opcoes) {
          const matchOpt = field.opcoes.find((o) => o.id === answer || o.label === answer);
          if (matchOpt) optionLabel = matchOpt.label;
        }
        leadTags.push(`${field.label.slice(0, 20)}: ${optionLabel}`);
      }
    }

    // 4. Salva a resposta no banco de dados
    const { data: savedResponse, error: responseError } = await supabase
      .from('form_responses')
      .insert({
        form_id: form.id,
        cliente_id: form.cliente_id || null,
        respostas,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        tempo_preenchimento_segundos: tempo_preenchimento_segundos || null,
      })
      .select()
      .single();

    if (responseError) throw responseError;

    // 5. Integração com Leads & Contatos do GENSBot se houver nome ou WhatsApp
    if ((leadNome || leadWhatsapp) && form.user_id) {
      try {
        const cleanPhone = (leadWhatsapp || '').replace(/\D/g, '');
        await supabase.from('contacts').insert({
          user_id: form.user_id,
          name: leadNome || 'Lead do Formulário',
          phone: cleanPhone || null,
          email: leadEmail || null,
          tags: leadTags,
          notes: `Lead capturado pelo formulário "${form.titulo}" em ${new Date().toLocaleString('pt-BR')}`,
        });
      } catch (contactErr) {
        console.warn('Aviso: Não foi possível salvar contato automaticamente:', contactErr);
      }
    }

    return NextResponse.json({
      success: true,
      responseId: savedResponse.id,
      redirect_url: form.redirect_url || null,
    });
  } catch (error: any) {
    console.error('Erro ao submeter resposta do formulário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
