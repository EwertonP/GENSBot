'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Compass,
  Users,
  Target,
  Sparkles,
  Palette,
  ShieldCheck,
  Printer,
  Copy,
  ExternalLink,
  MessageSquare,
  Building2,
  Loader2,
  Layers,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';

interface EstrategiaCliente {
  id: string;
  nome: string;
  nicho?: string | null;
  cor?: string | null;
  cor_capa?: string | null;
  foto_url?: string | null;
  foto_url_dark?: string | null;
  persona?: string | null;
  raio_x?: string | null;
  posicionamento?: string | null;
  tom_de_voz?: string | null;
  paleta_cores?: string[] | null;
  concorrentes?: string | null;
  briefing?: string | null;
  observacoes?: string | null;
  agencia?: {
    nome: string;
    email_contato?: string;
    telefone_contato?: string;
  };
}

export default function PaginaEstrategiaPublica() {
  const params = useParams();
  const token = params?.token as string;

  const [carregando, setCarregando] = useState(true);
  const [estrategia, setEstrategia] = useState<EstrategiaCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function carregarEstrategia() {
      try {
        setCarregando(true);
        const res = await fetch(`/api/estrategia/public/${token}`);
        if (!res.ok) throw new Error('Dossiê estratégico não encontrado ou desativado.');
        const data = await res.json();
        setEstrategia(data.estrategia);
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : 'Falha ao carregar estratégia.');
      } finally {
        setCarregando(false);
      }
    }

    carregarEstrategia();
  }, [token]);

  function copiarLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <Loader2 className="w-8 h-8 animate-spin text-[#192313]/60 mb-3" />
        <p className="text-sm font-medium text-[#192313]/70">Carregando Central Estratégica...</p>
      </div>
    );
  }

  if (erro || !estrategia) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-black/5 text-center">
          <Compass className="w-12 h-12 text-[#192313]/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#192313] mb-2">Dossiê Indisponível</h2>
          <p className="text-sm text-[#192313]/60 mb-6">{erro || 'Este dossiê de marca não foi encontrado.'}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#192313] text-white text-xs font-semibold hover:bg-[#2a3820] transition-colors"
          >
            Página Inicial
          </a>
        </div>
      </div>
    );
  }

  const corCapa = estrategia.cor_capa || '#192313';
  const agenciaNome = estrategia.agencia?.nome || 'GENS Agência';
  const cores = Array.isArray(estrategia.paleta_cores) && estrategia.paleta_cores.length > 0
    ? estrategia.paleta_cores
    : [estrategia.cor || '#10b981', '#192313', '#f7f8f2', '#bada55'];

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-[#192313] pb-24 print:bg-white print:pb-0">
      {/* Topo / Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20 print:static print:border-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#192313] text-[#bada55] flex items-center justify-center font-bold text-sm shrink-0">
              G
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#192313]/50 block truncate">
                Central Estratégica & Branding
              </span>
              <span className="text-sm font-bold text-[#192313] block truncate">
                {estrategia.nome}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={copiarLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 bg-white text-xs font-semibold hover:bg-black/5 text-[#192313] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiado ? 'Copiado!' : 'Compartilhar Link'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-2 rounded-full hover:bg-black/5 text-[#192313]/60 hover:text-[#192313] transition-colors"
              title="Imprimir Dossiê"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Capa e Identidade */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div
          className="rounded-3xl p-6 sm:p-10 relative overflow-hidden text-white shadow-sm"
          style={{ backgroundColor: corCapa }}
        >
          <div className="absolute right-0 top-0 w-80 h-80 bg-radial from-white/10 to-transparent pointer-events-none rounded-full blur-2xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <ClienteAvatar
              nome={estrategia.nome}
              cor={estrategia.cor || '#10b981'}
              fotoUrl={estrategia.foto_url}
              tamanho="lg"
              className="ring-4 ring-white/20 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-white text-xs font-semibold uppercase tracking-wider mb-2">
                Dossiê Oficial de Marca
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {estrategia.nome}
              </h1>
              <p className="text-sm text-white/80 mt-1">
                {[estrategia.nicho, `Gestão por ${agenciaNome}`].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo das Seções Estratégicas */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Grid: Raio-X & Posicionamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Raio-X do Perfil e Marca */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/5">
            <div className="flex items-center gap-2.5 mb-4 text-[#192313]">
              <div className="w-9 h-9 rounded-xl bg-[#192313]/5 flex items-center justify-center text-[#192313]">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">1. Raio-X do Perfil & Marca</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#192313]/80 leading-relaxed whitespace-pre-wrap">
              {estrategia.raio_x ||
                estrategia.briefing ||
                'Diagnóstico inicial da presença digital da marca, objetivos comerciais e posicionamento frente ao mercado consumidor.'}
            </p>
          </div>

          {/* Card 2: Posicionamento & Proposta de Valor */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/5">
            <div className="flex items-center gap-2.5 mb-4 text-[#192313]">
              <div className="w-9 h-9 rounded-xl bg-[#192313]/5 flex items-center justify-center text-[#192313]">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">2. Posicionamento Único</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#192313]/80 leading-relaxed whitespace-pre-wrap">
              {estrategia.posicionamento ||
                'Declaração de posicionamento que resume como a marca resolve o problema do cliente de maneira única, diferenciando-se dos competidores.'}
            </p>
          </div>
        </div>

        {/* Card 3: Persona & Público-Alvo */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/5">
          <div className="flex items-center gap-2.5 mb-4 text-[#192313]">
            <div className="w-9 h-9 rounded-xl bg-[#192313]/5 flex items-center justify-center text-[#192313]">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">3. Persona & Comportamento do Consumidor</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#192313]/80 leading-relaxed whitespace-pre-wrap">
            {estrategia.persona ||
              'Mapeamento aprofundado do cliente ideal: dados demográficos, dores recorrentes, principais desejos de transformação e objeções na hora da compra.'}
          </p>
        </div>

        {/* Grid: Tom de Voz & Identidade Visual */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 4: Tom de Voz */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/5">
            <div className="flex items-center gap-2.5 mb-4 text-[#192313]">
              <div className="w-9 h-9 rounded-xl bg-[#192313]/5 flex items-center justify-center text-[#192313]">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">4. Tom de Voz & Diretrizes</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#192313]/80 leading-relaxed whitespace-pre-wrap">
              {estrategia.tom_de_voz ||
                'Linguagem recomendada para posts, legendas e atendimento: próximo, profissional, acolhedor e com termos que reforçam autoridade.'}
            </p>
          </div>

          {/* Card 5: Paleta Cromática da Marca */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/5">
            <div className="flex items-center gap-2.5 mb-4 text-[#192313]">
              <div className="w-9 h-9 rounded-xl bg-[#192313]/5 flex items-center justify-center text-[#192313]">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">5. Paleta de Cores Oficial</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {cores.map((corHex, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 bg-[#f7f8f2] p-3 rounded-2xl border border-black/5">
                  <div
                    className="w-12 h-12 rounded-xl shadow-xs border border-black/10"
                    style={{ backgroundColor: corHex }}
                  />
                  <span className="text-[11px] font-mono font-semibold uppercase text-[#192313]/80">
                    {corHex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 6: Concorrentes e Inspirações */}
        {estrategia.concorrentes && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-black/5">
            <div className="flex items-center gap-2.5 mb-4 text-[#192313]">
              <div className="w-9 h-9 rounded-xl bg-[#192313]/5 flex items-center justify-center text-[#192313]">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">6. Concorrentes & Mercado de Referência</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#192313]/80 leading-relaxed whitespace-pre-wrap">
              {estrategia.concorrentes}
            </p>
          </div>
        )}

        {/* Rodapé de Registro */}
        <div className="pt-6 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#192313]/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Documento estratégico gerenciado pela equipe da {agenciaNome}</span>
          </div>
          <div>
            Central Estratégica GENSBot • Atualizada em tempo real
          </div>
        </div>
      </main>
    </div>
  );
}
