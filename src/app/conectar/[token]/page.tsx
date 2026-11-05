'use client';

import React, { useEffect, useState, useTransition, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Laptop,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Share2,
  Check,
  Send,
} from 'lucide-react';
import { Instagram } from '@/components/instagram-icon';
import { ClienteAvatar } from '@/components/cliente-avatar';

interface OnboardingDados {
  token: string;
  expirado: boolean;
  concluido_em: string | null;
  agencia: {
    id: string;
    nome: string;
    logo_url: string | null;
  };
  cliente: {
    id: string;
    nome: string;
    foto_url: string | null;
    token_portal: string | null;
  };
  handles: {
    instagram: string | null;
    threads: string | null;
    tiktok: string | null;
  };
  convites: {
    instagram_enviado: boolean;
    threads_enviado: boolean;
  };
  conexoes: {
    instagram: boolean;
    instagram_conectado_em: string | null;
    threads: boolean;
    threads_conectado_em: string | null;
    tiktok: boolean;
    tiktok_conectado_em: string | null;
  };
  urlsAuth: {
    instagram: string | null;
    threads: string | null;
    tiktok: string | null;
  };
}

export default function OnboardingPublicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
          <Loader2 className="w-8 h-8 animate-spin text-[#192313]/60 mb-3" />
          <p className="text-sm font-medium text-[#192313]/70">Preparando conexão de redes...</p>
        </div>
      }
    >
      <OnboardingPublicoConteudo />
    </Suspense>
  );
}

function OnboardingPublicoConteudo() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params?.token as string;

  const [dados, setDados] = useState<OnboardingDados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  // Formulário de handles
  const [handleInstagram, setHandleInstagram] = useState('');
  const [handleThreads, setHandleThreads] = useState('');
  const [handleTikTok, setHandleTikTok] = useState('');
  const [salvandoHandles, setSalvandoHandles] = useState(false);
  const [handlesSalvosMsg, setHandlesSalvosMsg] = useState(false);

  // Conclusão
  const [concluindo, setConcluindo] = useState(false);

  // Alertas vindos da query string do OAuth
  const sucessoParam = searchParams.get('sucesso');
  const errorParam = searchParams.get('error');

  async function carregarDados() {
    if (!token) return;
    try {
      setCarregando(true);
      const res = await fetch(`/api/onboarding/public/${token}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar dados do onboarding.');
      }
      setDados(data);
      setHandleInstagram(data.handles?.instagram || '');
      setHandleThreads(data.handles?.threads || '');
      setHandleTikTok(data.handles?.tiktok || '');
    } catch (err) {
      setErroCarregamento(err instanceof Error ? err.message : 'Falha na conexão.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [token]);

  async function handleSalvarHandles(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    try {
      setSalvandoHandles(true);
      setHandlesSalvosMsg(false);
      const res = await fetch(`/api/onboarding/public/${token}/informar-handles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram: handleInstagram,
          threads: handleThreads,
          tiktok: handleTikTok,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar perfis.');

      setHandlesSalvosMsg(true);
      setTimeout(() => setHandlesSalvosMsg(false), 4000);
      carregarDados();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao salvar perfis.');
    } finally {
      setSalvandoHandles(false);
    }
  }

  async function handleConcluirOnboarding() {
    if (!token) return;
    try {
      setConcluindo(true);
      const res = await fetch(`/api/onboarding/public/${token}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao concluir.');

      if (data.portalUrl) {
        router.push(data.portalUrl);
      } else {
        alert('Onboarding concluído com sucesso!');
        carregarDados();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao concluir onboarding.');
      setConcluindo(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <Loader2 className="w-8 h-8 animate-spin text-[#192313]/60 mb-3" />
        <p className="text-sm font-medium text-[#192313]/70">Preparando conexão de redes...</p>
      </div>
    );
  }

  if (erroCarregamento || !dados) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#192313]/10 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold text-[#192313] mb-2">Link Indisponível</h1>
          <p className="text-sm text-[#192313]/70 mb-6">
            {erroCarregamento || 'Este link de conexão não existe ou já expirou. Peça um novo link à sua agência.'}
          </p>
        </div>
      </div>
    );
  }

  const totalConectadas = [
    dados.conexoes.instagram,
    dados.conexoes.threads,
    dados.conexoes.tiktok,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-[#192313] pb-24">
      {/* Topo / Marca da Agência */}
      <header className="bg-white border-b border-[#192313]/10 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {dados.agencia.logo_url ? (
              <img
                src={dados.agencia.logo_url}
                alt={dados.agencia.nome}
                className="w-8 h-8 rounded-lg object-contain border border-[#192313]/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#bada55] flex items-center justify-center text-xs font-bold text-[#192313]">
                {dados.agencia.nome.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-[#192313]/50 font-bold">
                {dados.agencia.nome}
              </p>
              <h2 className="text-sm font-semibold text-[#192313]">Conexão de Redes Sociais</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ClienteAvatar fotoUrl={dados.cliente.foto_url} nome={dados.cliente.nome} tamanho="sm" />
            <span className="text-xs font-medium text-[#192313]/80 hidden sm:inline">
              {dados.cliente.nome}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Banner de Feedback OAuth */}
        {sucessoParam && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                Conta do {sucessoParam.toUpperCase()} conectada com sucesso!
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                A autorização foi validada e vinculada à agência para publicações e métricas.
              </p>
            </div>
          </div>
        )}

        {errorParam && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Aviso de Conexão</p>
              <p className="text-xs text-amber-700 mt-0.5">{errorParam}</p>
            </div>
          </div>
        )}

        {/* Hero explicativo */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#192313]/10 shadow-sm relative overflow-hidden">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#bada55]/30 text-xs font-bold text-[#192313] mb-4">
              <ShieldCheck className="w-3.5 h-3.5" /> Conexão Oficial e Segura
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#192313]">
              Olá, {dados.cliente.nome}! Vamos conectar suas redes.
            </h1>
            <p className="text-sm sm:text-base text-[#192313]/70 mt-3 leading-relaxed">
              Você não precisa compartilhar login e senha com a equipe da{' '}
              <strong className="text-[#192313]">{dados.agencia.nome}</strong>. A conexão é feita de
              forma oficial pelas APIs da Meta e TikTok, permitindo agendamento automático de
              conteúdos e leitura de estatísticas.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#192313]/5 text-xs font-medium text-[#192313]">
                <Laptop className="w-4 h-4 text-[#192313]/70" />
                Dica: abrir no computador agiliza a autorização
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#bada55]/20 text-xs font-semibold text-[#192313]">
                <Check className="w-4 h-4 text-emerald-700" />
                {totalConectadas} de 3 redes vinculadas
              </div>
            </div>
          </div>
        </div>

        {/* Passo 1: Informar Handles */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#192313]/10 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#192313] text-[#f7f8f2] flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#192313]">
                Informe seus perfis (@usuario)
              </h2>
              <p className="text-xs sm:text-sm text-[#192313]/60">
                A agência utilizará esses perfis para liberar seu acesso como usuário de teste no painel da Meta.
              </p>
            </div>
          </div>

          <form onSubmit={handleSalvarHandles} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#192313]/80 mb-1">
                  Instagram
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[#192313]/40 font-bold">@</span>
                  <input
                    type="text"
                    value={handleInstagram}
                    onChange={(e) => setHandleInstagram(e.target.value)}
                    placeholder="seu.instagram"
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-xl border border-[#192313]/15 focus:outline-none focus:ring-2 focus:ring-[#bada55] bg-[#f7f8f2]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#192313]/80 mb-1">
                  Threads
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[#192313]/40 font-bold">@</span>
                  <input
                    type="text"
                    value={handleThreads}
                    onChange={(e) => setHandleThreads(e.target.value)}
                    placeholder="seu.threads"
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-xl border border-[#192313]/15 focus:outline-none focus:ring-2 focus:ring-[#bada55] bg-[#f7f8f2]/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#192313]/80 mb-1">
                  TikTok
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-[#192313]/40 font-bold">@</span>
                  <input
                    type="text"
                    value={handleTikTok}
                    onChange={(e) => setHandleTikTok(e.target.value)}
                    placeholder="seu.tiktok"
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-xl border border-[#192313]/15 focus:outline-none focus:ring-2 focus:ring-[#bada55] bg-[#f7f8f2]/40"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={salvandoHandles}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#192313] text-[#f7f8f2] text-xs font-bold hover:bg-[#192313]/90 transition-all disabled:opacity-50 min-h-[44px]"
              >
                {salvandoHandles ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Salvar Perfis Informados
                  </>
                )}
              </button>

              {handlesSalvosMsg && (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" /> Perfis salvos com sucesso!
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Passo 2: Guia de Convites da Meta */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#192313]/10 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#192313] text-[#f7f8f2] flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#192313]">
                Aceite os Convites de Testador da Meta
              </h2>
              <p className="text-xs sm:text-sm text-[#192313]/60">
                Como as integrações com a Meta operam em modo de segurança avançado, seu perfil precisa aceitar o convite para liberar a autorização.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Box Instagram */}
            <div className="p-5 rounded-2xl border border-[#192313]/10 bg-[#f7f8f2]/40 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#192313]/60">
                    Instagram Tester
                  </span>
                  {dados.convites.instagram_enviado ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Convite Enviado pela Agência
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Aguardando Envio
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#192313] mb-1">
                  1. Aceitar no Instagram
                </h3>
                <p className="text-xs text-[#192313]/70 leading-relaxed">
                  Abra a tela de permissões de aplicativos do Instagram, procure o aplicativo da agência e clique em <strong>Aceitar Convite</strong>.
                </p>
              </div>

              <a
                href="https://www.instagram.com/accounts/manage_access/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#192313]/15 text-xs font-bold text-[#192313] hover:bg-[#192313]/5 transition-all min-h-[44px]"
              >
                Abrir Convites do Instagram <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Box Threads */}
            <div className="p-5 rounded-2xl border border-[#192313]/10 bg-[#f7f8f2]/40 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#192313]/60">
                    Threads Tester
                  </span>
                  {dados.convites.threads_enviado ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Convite Enviado pela Agência
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Aguardando Envio
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#192313] mb-1">
                  2. Aceitar no Threads
                </h3>
                <p className="text-xs text-[#192313]/70 leading-relaxed">
                  Acesse as permissões de site do Threads e confirme o aceite do convite de testador do aplicativo.
                </p>
              </div>

              <a
                href="https://www.threads.net/settings/site_permissions"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#192313]/15 text-xs font-bold text-[#192313] hover:bg-[#192313]/5 transition-all min-h-[44px]"
              >
                Abrir Permissões do Threads <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Passo 3: Autorizar Contas */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#192313]/10 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#192313] text-[#f7f8f2] flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#192313]">
                Autorizar e Conectar Redes
              </h2>
              <p className="text-xs sm:text-sm text-[#192313]/60">
                Clique nos botões abaixo para autorizar cada conta oficial. Você será direcionado para a tela oficial da rede.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Card Instagram */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[#192313]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Instagram className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#192313]">Instagram Profissional</h3>
                    {dados.conexoes.instagram ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#192313]/10 text-[#192313]/70 text-[10px] font-bold">
                        Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#192313]/60 mt-0.5">
                    Permite postagem direta de Reels, Carrosséis e fotos no feed.
                  </p>
                </div>
              </div>

              {dados.conexoes.instagram ? (
                <div className="text-right">
                  <span className="text-xs font-semibold text-emerald-700 block">
                    Pronto para publicação
                  </span>
                  {dados.urlsAuth.instagram && (
                    <a
                      href={dados.urlsAuth.instagram}
                      className="text-[11px] text-[#192313]/50 underline hover:text-[#192313]"
                    >
                      Reconectar conta
                    </a>
                  )}
                </div>
              ) : dados.urlsAuth.instagram ? (
                <a
                  href={dados.urlsAuth.instagram}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#bada55] text-[#192313] text-xs font-bold hover:brightness-95 transition-all min-h-[44px]"
                >
                  Conectar Instagram <ArrowRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-[#192313]/50 italic">
                  Configuração de app pendente
                </span>
              )}
            </div>

            {/* Card Threads */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[#192313]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm font-black text-xl">
                  @
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#192313]">Threads</h3>
                    {dados.conexoes.threads ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#192313]/10 text-[#192313]/70 text-[10px] font-bold">
                        Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#192313]/60 mt-0.5">
                    Permite postar threads de texto, links e imagens automaticamente.
                  </p>
                </div>
              </div>

              {dados.conexoes.threads ? (
                <div className="text-right">
                  <span className="text-xs font-semibold text-emerald-700 block">
                    Pronto para publicação
                  </span>
                  {dados.urlsAuth.threads && (
                    <a
                      href={dados.urlsAuth.threads}
                      className="text-[11px] text-[#192313]/50 underline hover:text-[#192313]"
                    >
                      Reconectar conta
                    </a>
                  )}
                </div>
              ) : dados.urlsAuth.threads ? (
                <a
                  href={dados.urlsAuth.threads}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#192313] text-[#f7f8f2] text-xs font-bold hover:bg-[#192313]/90 transition-all min-h-[44px]"
                >
                  Conectar Threads <ArrowRight className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </div>

            {/* Card TikTok */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[#192313]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#010101] text-[#00f2fe] flex items-center justify-center shrink-0 shadow-sm font-bold text-lg">
                  TT
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#192313]">TikTok</h3>
                    {dados.conexoes.tiktok ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#192313]/10 text-[#192313]/70 text-[10px] font-bold">
                        Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#192313]/60 mt-0.5">
                    Permite postar vídeos diretamente no canal do TikTok.
                  </p>
                </div>
              </div>

              {dados.conexoes.tiktok ? (
                <div className="text-right">
                  <span className="text-xs font-semibold text-emerald-700 block">
                    Pronto para publicação
                  </span>
                  {dados.urlsAuth.tiktok && (
                    <a
                      href={dados.urlsAuth.tiktok}
                      className="text-[11px] text-[#192313]/50 underline hover:text-[#192313]"
                    >
                      Reconectar conta
                    </a>
                  )}
                </div>
              ) : dados.urlsAuth.tiktok ? (
                <a
                  href={dados.urlsAuth.tiktok}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#192313] text-[#f7f8f2] text-xs font-bold hover:bg-[#192313]/90 transition-all min-h-[44px]"
                >
                  Conectar TikTok <ArrowRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-[#192313]/50 italic">
                  Configuração de app pendente
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Passo 4: Conclusão e Acesso ao Portal */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#192313]/10 shadow-sm text-center space-y-4">
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-[#192313]">
              Tudo pronto? Vamos ao seu Portal!
            </h2>
            <p className="text-xs sm:text-sm text-[#192313]/70">
              Ao concluir, marcaremos a etapa de conexões como finalizada e você terá acesso direto ao seu portal de aprovação de conteúdos.
            </p>
          </div>

          <button
            onClick={handleConcluirOnboarding}
            disabled={concluindo}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-[#bada55] text-[#192313] font-extrabold text-sm hover:brightness-95 transition-all shadow-sm disabled:opacity-50 min-h-[44px]"
          >
            {concluindo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Concluindo e redirecionando...
              </>
            ) : (
              <>
                Concluir Onboarding e Ir para o Portal <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </section>
      </main>
    </div>
  );
}
