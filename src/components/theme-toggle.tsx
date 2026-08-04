'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { applyTheme, getInitialTheme, type Theme } from '@/lib/theme';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  // Começa nulo pra não renderizar um ícone errado antes de saber o tema real
  // (evita mismatch de hidratação, já que o valor depende de localStorage/SO).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    // Reforça a classe no <html> — cobre o caso do script anti-flash não ter
    // rodado (ex: navegação client-side sem reload) sem sobrescrever a
    // escolha do usuário já persistida.
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  if (theme === null) {
    return <div className={`w-8 h-8 ${className}`} aria-hidden="true" />;
  }

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className={`w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer flex-shrink-0 ${className}`}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
