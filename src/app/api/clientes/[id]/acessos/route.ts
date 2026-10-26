import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { ehUuid } from '@/lib/clientes';

type Params = { params: Promise<{ id: string }> };

export interface AcessoCliente {
  id: string;
  agencia_id: string;
  cliente_id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  cargo: string | null;
  criado_em: string;
}

// GET: Lista todos os acessos de usuários (secretárias/equipe) vinculados a este cliente
export async function GET(_req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  const { id: clienteId } = await params;
  if (!ehUuid(clienteId)) return respostaErro('Cliente não encontrado.', 404);

  // Acessos externos são cofre: master vê tudo; portal do cliente, só o próprio cliente.
  const podeVer = membro.papel === 'master' || (membro.papel === 'cliente' && membro.cliente_id === clienteId);
  if (!podeVer) {
    return respostaErro('Permissão negada.', 403);
  }

  try {
    const { data: acessos, error } = await serviceSupabase
      .from('membros')
      .select('id, agencia_id, cliente_id, nome, email, papel, ativo, cargo, criado_em')
      .eq('agencia_id', membro.agencia_id)
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: false });

    if (error) return traduzirErroBanco(error, 'GET /api/clientes/[id]/acessos');

    return NextResponse.json({ acessos: acessos || [] });
  } catch (err: any) {
    console.error('Erro ao listar acessos do cliente:', err);
    return respostaErro('Falha interna ao carregar acessos do cliente.', 500);
  }
}

// POST: Cria um novo acesso exclusivo para a secretária/equipe do cliente
export async function POST(req: Request, { params }: Params) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  // Só master gera acessos externos (cofre).
  if (membro.papel !== 'master') {
    return respostaErro('Apenas administradores podem criar acessos de clientes.', 403);
  }

  const { id: clienteId } = await params;
  if (!ehUuid(clienteId)) return respostaErro('Cliente não encontrado.', 404);

  // Confere se o cliente existe e pertence à agência
  const { data: cliente } = await serviceSupabase
    .from('clientes')
    .select('id, nome')
    .eq('id', clienteId)
    .eq('agencia_id', membro.agencia_id)
    .maybeSingle();

  if (!cliente) return respostaErro('Cliente não encontrado.', 404);

  try {
    const body = await req.json();
    const { nome, email, password, cargo = 'Secretária / Atendimento' } = body;

    if (!nome?.trim() || !email?.trim()) {
      return respostaErro('Nome e e-mail são obrigatórios.', 400);
    }

    const emailLimpo = email.trim().toLowerCase();
    const senhaFinal = password?.trim() || `Cliente@${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;

    if (senhaFinal.length < 6) {
      return respostaErro('A senha deve ter no mínimo 6 caracteres.', 400);
    }

    // 1. Cria usuário no Supabase Auth
    let userId: string;
    const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: emailLimpo,
      password: senhaFinal,
      email_confirm: true,
      user_metadata: {
        full_name: nome.trim(),
        nome: nome.trim(),
        cliente_id: clienteId,
        cliente_nome: cliente.nome,
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered') || (authError as any).code === 'email_exists') {
        const { data: listData } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData.users.find((u) => u.email?.toLowerCase() === emailLimpo);
        if (!existing) {
          return respostaErro('E-mail já cadastrado no sistema.', 400);
        }
        userId = existing.id;
      } else {
        return respostaErro(authError.message || 'Erro ao criar conta de autenticação.', 400);
      }
    } else {
      userId = authUser.user.id;
    }

    // 2. Insere ou atualiza na tabela membros com papel 'cliente' e cliente_id vinculado
    const { data: membroCriado, error: membroError } = await serviceSupabase
      .from('membros')
      .upsert({
        id: userId,
        agencia_id: membro.agencia_id,
        cliente_id: clienteId,
        nome: nome.trim(),
        email: emailLimpo,
        papel: 'cliente',
        cargo: cargo?.trim() || 'Secretária / Atendimento',
        ativo: true,
      })
      .select('id, agencia_id, cliente_id, nome, email, papel, ativo, cargo, criado_em')
      .single();

    if (membroError) {
      return traduzirErroBanco(membroError, 'POST /api/clientes/[id]/acessos upsert membro');
    }

    return NextResponse.json(
      {
        acesso: membroCriado,
        senhaGerada: senhaFinal,
        clienteNome: cliente.nome,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Erro ao gerar acesso de cliente:', err);
    return respostaErro(err.message || 'Erro ao processar solicitação.', 500);
  }
}
