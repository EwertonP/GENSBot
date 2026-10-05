import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import FormClient from './form-client';
import type { Form, FormField } from '@/types/form';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const { data: form } = await supabase
    .from('forms')
    .select('titulo, descricao, tema_config')
    .eq('slug', slug)
    .maybeSingle();

  if (!form) {
    return {
      title: 'Formulário não encontrado | GENSBot',
    };
  }

  return {
    title: `${form.titulo} | GENSBot`,
    description: form.descricao || 'Preencha este formulário rápido.',
  };
}

export default async function FormPage({ params }: PageProps) {
  const { slug } = await params;

  // Busca dados do formulário e cliente
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('*, clientes(nome, cor, foto_url)')
    .eq('slug', slug)
    .maybeSingle();

  if (formError || !form) {
    notFound();
  }

  // Se não estiver publicado, mostra tela de formulário indisponível
  if (!form.publicado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background font-sans">
        <div className="max-w-md w-full bg-card p-8 rounded-3xl border border-border shadow-sm space-y-4">
          <span className="text-4xl">🔒</span>
          <h1 className="text-2xl font-bold text-foreground">{form.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            Este formulário ainda não foi publicado ou está pausado no momento.
          </p>
        </div>
      </div>
    );
  }

  // Busca os campos do formulário
  const { data: fields } = await supabase
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('ordem', { ascending: true });

  const completeForm: Form = {
    ...form,
    cliente_nome: (form as any).clientes?.nome || null,
    fields: (fields || []) as FormField[],
  };

  return <FormClient form={completeForm} />;
}
