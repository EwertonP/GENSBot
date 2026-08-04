'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message || 'Erro ao criar conta. Tente novamente.');
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/30 shadow-lg shadow-primary/20 mb-5 text-primary-foreground">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
            </svg>
          </div>
          <h2 className="text-xl font-black text-foreground mb-3">Conta criada com sucesso!</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Verifique seu e-mail <strong className="text-foreground">{email}</strong> e clique no link de confirmação para ativar sua conta.
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-sm shadow-md transition-all"
          >
            Ir para o Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/30 shadow-lg shadow-primary/20 mb-5 text-primary-foreground">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">GENSBot</h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium">Crie sua conta para começar</p>
        </div>

        {/* Register Card */}
        <div className="bg-card border border-accent rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-foreground mb-6">Criar nova conta</h2>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome completo</label>
              <input
                id="register-name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="bg-accent border border-border text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">E-mail</label>
              <input
                id="register-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-accent border border-border text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Senha</label>
              <input
                id="register-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-accent border border-border text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-confirm-password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirmar Senha</label>
              <input
                id="register-confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
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
              id="register-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-accent disabled:text-muted-foreground text-primary-foreground font-extrabold text-sm shadow-md cursor-pointer transition-all"
            >
              {loading ? 'Criando conta...' : 'Criar Conta Gratuita'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-accent text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <a href="/login" className="text-primary hover:text-primary/80 font-bold transition-colors">
                Entrar agora
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao criar uma conta, você concorda com nossa{' '}
          <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
