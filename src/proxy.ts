import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rotas de API gerenciam sua própria autenticação (getContextoAgencia, getAuthUser, etc.)
  // e retornam respostas JSON customizadas. Executar getUser() aqui para /api causa perda
  // de Set-Cookie de refresh de token pelo Next.js e corrida de Refresh Token Reuse no Supabase.
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 2. Rotas públicas de conteúdo/visualização que não necessitam de checagem de sessão
  const publicContentRoutes = [
    '/privacidade',
    '/exclusao-de-dados',
    '/aprovacao',
    '/relatorio',
    '/r',
    '/f',
    '/.well-known',
  ];
  if (publicContentRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    // Já logado vindo do fluxo OAuth do MCP: volta direto para a tela de autorização.
    const next = request.nextUrl.searchParams.get('next');
    url.pathname = next && next.startsWith('/oauth/') ? next.split('?')[0] : '/';
    url.search = next && next.startsWith('/oauth/') && next.includes('?') ? next.slice(next.indexOf('?')) : '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
