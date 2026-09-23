import { NextResponse } from 'next/server';
import { supabase as serviceSupabase } from '@/lib/supabase';

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

    // 2. Tenta criar usuário no Supabase Auth usando admin API (com email_confirm: true)
    let userId: string;

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
      // Se o usuário já existia (ex: convidado pelo painel previamente ou tentativa anterior)
      const isAlreadyRegistered =
        authError.message?.toLowerCase().includes('already registered') ||
        authError.code === 'email_exists' ||
        authError.status === 422;

      if (isAlreadyRegistered) {
        const { data: listData } = await serviceSupabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData?.users?.find((u) => u.email?.toLowerCase() === emailLimpo);

        if (!existing) {
          return NextResponse.json({ error: 'Erro ao identificar conta existente.' }, { status: 400 });
        }

        userId = existing.id;

        // Atualiza a senha e confirma o e-mail do usuário existente
        const { error: updateErr } = await serviceSupabase.auth.admin.updateUserById(userId, {
          password: senhaLimpa,
          email_confirm: true,
          user_metadata: {
            full_name: name.trim(),
            username: username?.trim().toLowerCase() || emailLimpo.split('@')[0],
            cargo: cargo?.trim() || 'Sócio / Membro',
          },
        });

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message || 'Erro ao atualizar senha do usuário.' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: authError.message || 'Erro ao criar conta no sistema.' }, { status: 400 });
      }
    } else {
      userId = authUser.user.id;
    }

    // 3. Garante que o registro na tabela `membros` esteja criado e ativo
    const { error: membroError } = await serviceSupabase
      .from('membros')
      .upsert({
        id: userId,
        agencia_id: agenciaId,
        nome: name.trim(),
        email: emailLimpo,
        papel: 'master', // Concede acesso ao membro/sócio cadastrado via link
        cargo: cargo?.trim() || 'Sócio / Membro',
        ativo: true,
      });

    if (membroError) {
      console.error('Erro ao upsert membro no register:', membroError);
    }

    return NextResponse.json({ success: true, message: 'Conta criada e ativada com sucesso!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
