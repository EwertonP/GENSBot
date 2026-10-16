import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';

/**
 * Cadastro público. Cria a conta como membro INATIVO: um administrador precisa aprovar
 * na tela Equipe. Esta rota nunca altera conta existente nem concede papel de master
 * (antes ela redefinia a senha de qualquer e-mail já cadastrado e promovia o cadastro).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, username, cargo } = body;

    if (!email?.trim() || !password?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios.' }, { status: 400 });
    }

    if (password.trim().length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    const emailLimpo = email.trim().toLowerCase();
    const senhaLimpa = password.trim();

    // 1. Busca id da agência padrão (gens ou primeira agência cadastrada)
    let agenciaId: string | null = null;
    const { data: agenciaGens } = await serviceSupabase
      .from('agencias')
      .select('id')
      .eq('slug', 'gens')
      .maybeSingle();

    if (agenciaGens) {
      agenciaId = agenciaGens.id;
    } else {
      const { data: primeiraAgencia } = await serviceSupabase
        .from('agencias')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (primeiraAgencia) {
        agenciaId = primeiraAgencia.id;
      }
    }

    if (!agenciaId) {
      return NextResponse.json({ error: 'Nenhuma agência encontrada no sistema.' }, { status: 500 });
    }

    // 2. Cria o usuário no Supabase Auth. Se o e-mail já existe, recusa: nada de mexer em
    // senha ou permissões de uma conta que já existe.
    const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: emailLimpo,
      password: senhaLimpa,
      email_confirm: true,
      user_metadata: {
        full_name: name.trim(),
        username: username?.trim().toLowerCase() || emailLimpo.split('@')[0],
        cargo: cargo?.trim() || 'Sócio / Membro',
      },
    });

    if (authError) {
      const jaExiste =
        authError.message?.toLowerCase().includes('already registered') ||
        authError.code === 'email_exists' ||
        authError.status === 422;

      if (jaExiste) {
        return NextResponse.json(
          { error: 'Já existe uma conta com este e-mail. Entre pelo login ou peça a um administrador para redefinir a senha.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError.message || 'Erro ao criar conta no sistema.' }, { status: 400 });
    }

    const userId = authUser.user.id;

    // 3. Registra como membro inativo, aguardando aprovação
    const { error: membroError } = await serviceSupabase.from('membros').insert({
      id: userId,
      agencia_id: agenciaId,
      nome: name.trim(),
      email: emailLimpo,
      papel: 'membro',
      cargo: cargo?.trim() || 'Sócio / Membro',
      ativo: false,
    });

    if (membroError) {
      console.error('Erro ao registrar membro no register:', membroError);
      // Não deixa uma conta de Auth órfã, sem vínculo com a agência
      await serviceSupabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Não foi possível concluir o cadastro. Tente novamente.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Cadastro enviado! Um administrador da agência precisa aprovar o seu acesso.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
