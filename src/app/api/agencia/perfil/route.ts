import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { contextoDocumentos, verificarPerfilAgencia } from '@/lib/documentos-server';
import { respostaErro } from '@/lib/clientes-server';

export async function GET() {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const { data: agencia, error } = await db
      .from('agencias')
      .select('id, nome, slug, cnpj_cpf, razao_social, endereco, cidade_estado, chave_pix, telefone_contato, email_contato')
      .eq('id', membro.agencia_id)
      .maybeSingle();

    if (error && error.code !== '42703') { // 42703 = coluna não existe ainda caso migration não rodou
      return respostaErro('Falha ao buscar perfil da agência.', 500);
    }

    const { completo, faltantes } = verificarPerfilAgencia(agencia);
    return NextResponse.json({
      agencia: agencia || { id: membro.agencia_id, nome: 'Minha Agência' },
      completo,
      faltantes,
    });
  } catch (err) {
    console.error('Erro ao buscar dados da agência:', err);
    return respostaErro('Erro interno ao carregar perfil.', 500);
  }
}

export async function PATCH(req: Request) {
  const auth = await contextoDocumentos();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const dados = {
      nome: body.nome?.trim() || undefined,
      razao_social: body.razao_social?.trim() || null,
      cnpj_cpf: body.cnpj_cpf?.trim() || null,
      endereco: body.endereco?.trim() || null,
      cidade_estado: body.cidade_estado?.trim() || null,
      chave_pix: body.chave_pix?.trim() || null,
      telefone_contato: body.telefone_contato?.trim() || null,
      email_contato: body.email_contato?.trim() || null,
    };

    const { data, error } = await db
      .from('agencias')
      .update(dados)
      .eq('id', membro.agencia_id)
      .select('id, nome, slug, cnpj_cpf, razao_social, endereco, cidade_estado, chave_pix, telefone_contato, email_contato')
      .single();

    if (error) {
      console.error('Erro ao atualizar agência:', error);
      return respostaErro('Não foi possível salvar os dados da agência.', 400);
    }

    const { completo, faltantes } = verificarPerfilAgencia(data);
    return NextResponse.json({
      agencia: data,
      completo,
      faltantes,
    });
  } catch (err) {
    console.error('Erro ao atualizar dados da agência:', err);
    return respostaErro('Erro ao processar atualização.', 500);
  }
}
