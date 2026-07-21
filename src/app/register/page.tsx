'use client';

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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#125835] shadow-lg shadow-[#1DB954]/20 mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="black"/>
            </svg>
          </div>
          <h2 className="text-xl font-black text-white mb-3">Conta criada com sucesso!</h2>
          <p className="text-sm text-[#A7A7A7] mb-6 leading-relaxed">
            Verifique seu e-mail <strong className="text-white">{email}</strong> e clique no link de confirmação para ativar sua conta.
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#1DB954] hover:bg-[#1ED760] text-black font-extrabold text-sm shadow-md transition-all"
          >
            Ir para o Login
          </a>
        </div>
      </div>
    );
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
          <p className="text-sm text-[#A7A7A7] mt-1.5 font-medium">Crie sua conta para começar</p>
        </div>

        {/* Register Card */}
        <div className="bg-[#1A1A1A] border border-[#282828] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6">Criar nova conta</h2>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#A7A7A7] uppercase tracking-wider">Nome completo</label>
              <input
                id="register-name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="bg-[#282828] border border-[#3E3E3E] text-white text-sm rounded-xl px-4 py-3 placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#A7A7A7] uppercase tracking-wider">E-mail</label>
              <input
                id="register-email"
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
                id="register-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-[#282828] border border-[#3E3E3E] text-white text-sm rounded-xl px-4 py-3 placeholder:text-[#A7A7A7]/50 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/30 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#A7A7A7] uppercase tracking-wider">Confirmar Senha</label>
              <input
                id="register-confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
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
              id="register-submit"
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl bg-[#1DB954] hover:bg-[#1ED760] disabled:bg-[#282828] disabled:text-[#A7A7A7] text-black font-extrabold text-sm shadow-md cursor-pointer transition-all"
            >
              {loading ? 'Criando conta...' : 'Criar Conta Gratuita'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#282828] text-center">
            <p className="text-sm text-[#A7A7A7]">
              Já tem uma conta?{' '}
              <a href="/login" className="text-[#1DB954] hover:text-[#1ED760] font-bold transition-colors">
                Entrar agora
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#A7A7A7] mt-6">
          Ao criar uma conta, você concorda com nossa{' '}
          <a href="/privacidade" className="text-[#1DB954] hover:underline">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
