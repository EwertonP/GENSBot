'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#125835] shadow-lg shadow-[#1DB954]/20 mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="black"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">GENSBot</h1>
          <p className="text-sm text-[#A7A7A7] mt-1.5 font-medium">Automações para o Instagram da sua agência</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1A1A1A] border border-[#282828] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6">Entrar na sua conta</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#A7A7A7] uppercase tracking-wider">E-mail</label>
              <input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-[#282828] border border-[#3E3E3E] text-white text-sm rounded-xl px-4 py-3 placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#A7A7A7] uppercase tracking-wider">Senha</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-[#282828] border border-[#3E3E3E] text-white text-sm rounded-xl px-4 py-3 placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/30 transition-all"
              />
            </div>

            {error && (
              <div className="bg-[#F15E6C]/10 border border-[#F15E6C]/30 rounded-xl px-4 py-3 text-sm text-[#F15E6C] font-medium">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl bg-[#1DB954] hover:bg-[#1ED760] disabled:bg-[#282828] disabled:text-[#A7A7A7] text-black font-extrabold text-sm shadow-md cursor-pointer transition-all"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#282828] text-center">
            <p className="text-sm text-[#A7A7A7]">
              Ainda não tem conta?{' '}
              <a href="/register" className="text-[#1DB954] hover:text-[#1ED760] font-bold transition-colors">
                Criar conta gratuita
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#A7A7A7] mt-6">
          Ao entrar, você concorda com nossos{' '}
          <a href="/privacidade" className="text-[#1DB954] hover:underline">Termos de Uso</a>
        </p>
      </div>
    </div>
  );
}
