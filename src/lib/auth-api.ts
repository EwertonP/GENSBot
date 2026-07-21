/**
 * getAuthUser - Helper para obter o usuário autenticado nas API Routes.
 *
 * Usa o cookie de sessão do Supabase para identificar quem está fazendo
 * a requisição. Retorna null se não houver sessão válida.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function getAuthUser() {
  const cookieStore = await cookies();

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Read-only in server components */ }
        },
      },
    }
  );

  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user ?? null;
}

/**
 * Retorna uma resposta 401 padronizada para usar nas API Routes.
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Não autorizado. Faça login para continuar.' },
    { status: 401 }
  );
}
