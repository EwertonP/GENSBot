import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';

export interface MembroEquipe {
  id: string;
  agencia_id: string;
  nome: string;
  email: string;
  papel: 'master' | 'membro';
  ativo: boolean;
  cargo: string | null;
  foto_url: string | null;
  criado_em: string;
  total_demandas?: number;
}

export async function GET() {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { supabase, membro } = auth.ctx;

  // Busca todos os membros da agência atual
  const { data: membros, error } = await supabase
    .from('membros')
    .select('*')
    .eq('agencia_id', membro.agencia_id)
    .order('criado_em', { ascending: true });

  if (error) {
    return traduzirErroBanco(error, 'GET /api/equipe');
  }

  // Busca contagem de demandas ativas sob responsabilidade
  const { data: demandas } = await supabase
    .from('conteudo_items')
    .select('responsavel_id')
    .eq('agencia_id', membro.agencia_id)
    .not('status', 'in', '("publicado")');

  const contagemDemandas: Record<string, number> = {};
  if (demandas) {
    for (const d of demandas) {
      if (d.responsavel_id) {
        contagemDemandas[d.responsavel_id] = (contagemDemandas[d.responsavel_id] || 0) + 1;
      }
    }
  }

  const membrosFormatados: MembroEquipe[] = (membros || []).map((m: any) => ({
    ...m,
    total_demandas: contagemDemandas[m.id] || 0,
  }));

  return NextResponse.json({ membros: membrosFormatados });
}

export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const { membro } = auth.ctx;

  if (membro.papel !== 'master') {
    return respostaErro('Apenas administradores/sócios masters podem convidar membros.', 403);
  }

  try {
    const body = await req.json();
    const { nome, email, papel = 'membro', cargo, password } = body;

    if (!nome?.trim() || !email?.trim()) {
      return respostaErro('Nome e e-mail são obrigatórios.', 400);
    }

    const emailLimpo = email.trim().toLowerCase();
    const senhaFinal = password?.trim() || `Gens@${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;

    // 1. Cria usuário no Supabase Auth usando a service role
    let userId: string;
    const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: emailLimpo,
      password: senhaFinal,
      email_confirm: true,
      user_metadata: { full_name: nome.trim(), nome: nome.trim() },
    });

    if (authError) {
      // Se o usuário já existe no Auth, busca o ID dele
      if (authError.message?.toLowerCase().includes('already registered') || authError.code === 'email_exists') {
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

    // 2. Insere ou atualiza na tabela membros
    const { data: membroCriado, error: membroError } = await serviceSupabase
      .from('membros')
      .upsert({
        id: userId,
        agencia_id: membro.agencia_id,
        nome: nome.trim(),
        email: emailLimpo,
        papel: papel === 'master' ? 'master' : 'membro',
        cargo: cargo?.trim() || null,
        ativo: true,
      })
      .select('*')
      .single();

    if (membroError) {
      return traduzirErroBanco(membroError, 'POST /api/equipe upsert membro');
    }

    return NextResponse.json(
      {
        membro: membroCriado,
        senhaGerada: password ? undefined : senhaFinal,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return respostaErro(err.message || 'Erro ao processar solicitação.', 500);
  }
}
