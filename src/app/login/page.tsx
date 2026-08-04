'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/theme-toggle';
import { LogoMark } from '@/components/logo';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('E-mail ou senha incorretos. Verifique e tente novamente.');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-md">

        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/20 mb-5 text-primary-foreground">
            <LogoMark className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">GENSBot</h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium">Automações para o Instagram da sua agência</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-accent rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-foreground mb-6">Entrar na sua conta</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">E-mail</label>
              <input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-accent border border-border text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Senha</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-accent border border-border text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            {error && (
              <div role="alert" className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-accent disabled:text-muted-foreground text-primary-foreground font-extrabold text-sm shadow-md cursor-pointer transition-all"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-accent text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não tem conta?{' '}
              <a href="/register" className="text-primary hover:text-primary/80 font-bold transition-colors">
                Criar conta gratuita
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao entrar, você concorda com nossos{' '}
          <a href="/privacidade" className="text-primary hover:underline">Termos de Uso</a>
        </p>
      </div>
    </div>
  );
}
