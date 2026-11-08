'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  MessageCircle,
  ExternalLink,
  Send,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { ExecutiveKPIGrid } from '@/components/dashboard/executive-kpi-grid';
import { PerformanceAreaChart } from '@/components/dashboard/performance-area-chart';
import { TransformationPipeline } from '@/components/dashboard/transformation-pipeline';
import { VisualSystemShowcase } from '@/components/dashboard/visual-system-showcase';

interface DemandaPortal {
  id: string;
  titulo: string;
  formato: string;
  status: string;
  data_prazo?: string | null;
  horario?: string | null;
  legenda?: string | null;
  briefing_html?: string | null;
  midia_urls?: string[];
  pedido_info?: string | null;
  pedido_info_respondido?: boolean | null;
  pedido_info_resposta?: string | null;
  concluida?: boolean;
}

interface ContratoPortal {
  id: string;
  titulo: string;
  status: string;
  valor_mensal: number;
  dia_vencimento?: number;
  data_inicio?: string;
  data_termino?: string;
  token_publico: string;
}

interface ClientePortal {
  id: string;
  nome: string;
  nicho?: string;
  cor?: string;
  cor_capa?: string;
  foto_url?: string;
  foto_url_dark?: string;
  valor_mensal?: number;
  dia_vencimento?: number;
  agencia?: {
    nome: string;
    email_contato?: string;
    telefone_contato?: string;
    chave_pix?: string;
  };
}

export default function PaginaPortalCliente() {
  const params = useParams();
  const token = params?.token as string;

  const [carregando, setCarregando] = useState(true);
  const [cliente, setCliente] = useState<ClientePortal | null>(null);
  const [demandas, setDemandas] = useState<DemandaPortal[]>([]);
  const [contratos, setContratos] = useState<ContratoPortal[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de ações interativas
  const [respostaInfo, setRespostaInfo] = useState<Record<string, string>>({});
  const [enviandoInfoId, setEnviandoInfoId] = useState<string | null>(null);

  const [modalAjusteItem, setModalAjusteItem] = useState<DemandaPortal | null>(null);
  const [feedbackAjuste, setFeedbackAjuste] = useState('');
  const [processandoAprovacaoId, setProcessandoAprovacaoId] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'aprovacoes' | 'contrato'>('dashboard');

  useEffect(() => {
    if (!token) return;

    async function carregarPortal() {
      try {
        setCarregando(true);
        const res = await fetch(`/api/portal/public/${token}`);
        if (!res.ok) throw new Error('Portal do cliente não encontrado ou link expirado.');
        const data = await res.json();
        setCliente(data.cliente);
        setDemandas(data.demandas || []);
        setContratos(data.contratos || []);
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : 'Falha ao carregar portal.');
      } finally {
        setCarregando(false);
      }
    }

    carregarPortal();
  }, [token]);

  // Responder pedido de informação
  async function handleEnviarRespostaInfo(itemId: string) {
    const texto = respostaInfo[itemId]?.trim();
    if (!texto) {
      alert('Por favor, digite sua resposta.');
      return;
    }

    try {
      setEnviandoInfoId(itemId);
      const res = await fetch(`/api/portal/public/${token}/responder-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, resposta: texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar resposta.');

      setDemandas((prev) =>
        prev.map((d) =>
          d.id === itemId
            ? { ...d, pedido_info_respondido: true, pedido_info_resposta: texto }
            : d
        )
      );
      alert('Resposta enviada com sucesso para a equipe da agência!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha no envio.');
    } finally {
      setEnviandoInfoId(null);
    }
  }

  // Aprovar demanda
  async function handleAprovarDemanda(itemId: string) {
    try {
      setProcessandoAprovacaoId(itemId);
      const res = await fetch(`/api/portal/public/${token}/aprovar-demanda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, acao: 'aprovar' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar post.');

      setDemandas((prev) =>
        prev.map((d) => (d.id === itemId ? { ...d, status: data.item.status } : d))
      );
      alert('Post aprovado com sucesso! Já está liberado para agendamento.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao aprovar post.');
    } finally {
      setProcessandoAprovacaoId(null);
    }
  }

  // Solicitar ajustes na demanda
  async function handleEnviarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!modalAjusteItem || !feedbackAjuste.trim()) return;

    try {
      setProcessandoAprovacaoId(modalAjusteItem.id);
      const res = await fetch(`/api/portal/public/${token}/aprovar-demanda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: modalAjusteItem.id,
          acao: 'ajustes',
          feedback: feedbackAjuste.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao solicitar ajustes.');

      setDemandas((prev) =>
        prev.map((d) => (d.id === modalAjusteItem.id ? { ...d, status: data.item.status } : d))
      );
      setModalAjusteItem(null);
      setFeedbackAjuste('');
      alert('Ajustes enviados para o time de criação!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao registrar ajustes.');
    } finally {
      setProcessandoAprovacaoId(null);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <Loader2 className="w-8 h-8 animate-spin text-[#192313]/60 mb-3" />
        <p className="text-sm font-medium text-[#192313]/70">Abrindo portal do cliente...</p>
      </div>
    );
  }

  if (erro || !cliente) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-black/5 text-center">
          <Layers className="w-12 h-12 text-[#192313]/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#192313] mb-2">Portal Indisponível</h2>
          <p className="text-sm text-[#192313]/60 mb-6">{erro || 'Link de portal incorreto ou expirado.'}</p>
        </div>
      </div>
    );
  }

  const pedidosPendentes = demandas.filter(
    (d) => d.pedido_info && !d.pedido_info_respondido
  );
  const demandasEmAprovacao = demandas.filter((d) => d.status === 'aprovacao');
  const proximasPublicacoes = demandas.filter((d) => d.status !== 'aprovacao');

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-[#192313] pb-24">
      {/* Topo / Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClienteAvatar
              nome={cliente.nome}
              cor={cliente.cor}
              fotoUrl={cliente.foto_url}
              tamanho="sm"
            />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#192313]/50 block truncate">
                Portal do Cliente
              </span>
              <span className="text-sm font-bold text-[#192313] block truncate">
                {cliente.nome}
              </span>
            </div>
          </div>

          {cliente.agencia?.telefone_contato && (
            <a
              href={`https://wa.me/55${cliente.agencia.telefone_contato.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Falar com a Agência</span>
            </a>
          )}
        </div>
      </header>

      {/* Hero do Portal */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div
          className="rounded-3xl p-6 sm:p-10 relative overflow-hidden text-white shadow-sm"
          style={{ backgroundColor: cliente.cor_capa || '#192313' }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-[#bada55] text-xs font-semibold uppercase tracking-wider mb-2">
                Painel Oficial
              </span>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
                Olá! Acompanhe suas entregas e aprove posts
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-xl">
                Seu espaço exclusivo para validar conteúdos, responder dúvidas da equipe e acompanhar o cronograma do seu contrato.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 text-xs shrink-0 border border-white/15">
              <span className="text-white/60 block text-[11px]">Agência Responsável</span>
              <span className="font-bold text-white text-sm block">{cliente.agencia?.nome}</span>
              {cliente.agencia?.email_contato && (
                <span className="text-white/70 block mt-0.5">{cliente.agencia.email_contato}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navegação de Abas do Portal */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center gap-2 border-b border-black/5 pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setAbaAtiva('dashboard')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              abaAtiva === 'dashboard'
                ? 'bg-[#192313] text-[#bada55] shadow-xs'
                : 'bg-white text-[#192313]/70 hover:bg-black/5 hover:text-[#192313] border border-black/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Visão Geral & Resultados</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('aprovacoes')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all relative ${
              abaAtiva === 'aprovacoes'
                ? 'bg-[#192313] text-[#bada55] shadow-xs'
                : 'bg-white text-[#192313]/70 hover:bg-black/5 hover:text-[#192313] border border-black/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Aprovações & Conteúdos</span>
            {(pedidosPendentes.length > 0 || demandasEmAprovacao.length > 0) && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pedidosPendentes.length + demandasEmAprovacao.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('contrato')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
              abaAtiva === 'contrato'
                ? 'bg-[#192313] text-[#bada55] shadow-xs'
                : 'bg-white text-[#192313]/70 hover:bg-black/5 hover:text-[#192313] border border-black/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Contrato & Cronograma</span>
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ============================================================= */}
        {/* ABA 1: DASHBOARD EXECUTIVO & RESULTADOS VISUAIS */}
        {/* ============================================================= */}
        {abaAtiva === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Aviso inteligente caso haja pendências de aprovação */}
            {(pedidosPendentes.length > 0 || demandasEmAprovacao.length > 0) && (
              <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-amber-500/20 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#192313]">
                      Você tem itens aguardando sua validação
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#192313]/70">
                      {demandasEmAprovacao.length} post(s) para aprovação e {pedidosPendentes.length} dúvida(s) da equipe.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAbaAtiva('aprovacoes')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#192313] text-[#bada55] text-xs font-semibold hover:bg-[#2a3820] transition-colors shrink-0"
                >
                  <span>Ver Aprovações</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Grid Bento de KPIs */}
            <ExecutiveKPIGrid />

            {/* Gráfico de Evolução de Audiência */}
            <PerformanceAreaChart />

            {/* Esteira de Transformação */}
            <TransformationPipeline />

            {/* Vitrine Visual do Sistema (Mobile Mockup + Blog) */}
            <VisualSystemShowcase />
          </div>
        )}

        {/* ============================================================= */}
        {/* ABA 2: APROVAÇÕES & CONTEÚDOS */}
        {/* ============================================================= */}
        {abaAtiva === 'aprovacoes' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* PEDIDOS DE INFORMAÇÃO PENDENTES */}
            {pedidosPendentes.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <HelpCircle className="w-5 h-5 text-amber-600" />
                  <h2 className="text-sm font-bold tracking-tight uppercase">
                    A equipe precisa de informações para avançar ({pedidosPendentes.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {pedidosPendentes.map((item) => (
                    <div
                      key={item.id}
                      className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-5 shadow-xs"
                    >
                      <span className="text-xs font-bold text-amber-900 block mb-1">
                        Demanda: {item.titulo} ({item.formato})
                      </span>
                      <p className="text-xs sm:text-sm text-amber-950/80 mb-3 leading-relaxed">
                        <strong>Pergunta da agência:</strong> {item.pedido_info}
                      </p>

                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={respostaInfo[item.id] || ''}
                          onChange={(e) =>
                            setRespostaInfo({ ...respostaInfo, [item.id]: e.target.value })
                          }
                          placeholder="Digite sua resposta aqui para a agência..."
                          className="w-full text-xs p-3 rounded-2xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          onClick={() => handleEnviarRespostaInfo(item.id)}
                          disabled={enviandoInfoId === item.id}
                          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
                        >
                          {enviandoInfoId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Enviar Resposta</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CONTEÚDOS AGUARDANDO SUA APROVAÇÃO */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#192313]" />
                  <h2 className="text-base font-bold text-[#192313]">
                    Conteúdos Prontos para sua Aprovação ({demandasEmAprovacao.length})
                  </h2>
                </div>
              </div>

              {demandasEmAprovacao.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-black/5 shadow-xs">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600/40 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-[#192313] mb-1">Tudo em dia!</h3>
                  <p className="text-xs text-[#192313]/60 max-w-sm mx-auto">
                    No momento não há nenhum post aguardando validação. Quando a equipe finalizar novas peças, elas aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {demandasEmAprovacao.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-3xl p-5 border border-black/5 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#192313]/5 text-[#192313]">
                            {item.formato}
                          </span>
                          {item.data_prazo && (
                            <span className="text-xs text-[#192313]/60 font-medium">
                              Data sugerida: {new Date(item.data_prazo).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-[#192313] mb-2">{item.titulo}</h3>

                        {/* Miniaturas de Mídia se houver */}
                        {Array.isArray(item.midia_urls) && item.midia_urls.length > 0 && (
                          <div className="mb-3 rounded-2xl overflow-hidden aspect-video bg-black/5 relative">
                            <img
                              src={item.midia_urls[0]}
                              alt={item.titulo}
                              className="w-full h-full object-cover"
                            />
                            {item.midia_urls.length > 1 && (
                              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                +{item.midia_urls.length - 1} mídias
                              </span>
                            )}
                          </div>
                        )}

                        {/* Legenda do Post */}
                        {item.legenda && (
                          <div className="bg-[#f7f8f2] p-3 rounded-2xl text-xs text-[#192313]/80 mb-4 max-h-32 overflow-y-auto leading-relaxed border border-black/5">
                            <span className="text-[10px] font-bold text-[#192313]/50 block mb-1">
                              Legenda do Post:
                            </span>
                            <p className="whitespace-pre-wrap">{item.legenda}</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-black/5 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setModalAjusteItem(item)}
                          className="px-4 h-9 rounded-full border border-black/15 text-xs font-semibold hover:bg-black/5 transition-colors"
                        >
                          Pedir Alteração
                        </button>
                        <button
                          onClick={() => handleAprovarDemanda(item.id)}
                          disabled={processandoAprovacaoId === item.id}
                          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full bg-[#192313] text-[#bada55] text-xs font-semibold hover:bg-[#2a3820] transition-colors disabled:opacity-50"
                        >
                          {processandoAprovacaoId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Aprovar Post</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ============================================================= */}
        {/* ABA 3: CONTRATO & CRONOGRAMA */}
        {/* ============================================================= */}
        {abaAtiva === 'contrato' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contrato Ativo */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-black/5">
                <div className="flex items-center gap-2 mb-4 text-[#192313]">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold">Contrato de Prestação de Serviços</h3>
                </div>

                {contratos.length === 0 ? (
                  <p className="text-xs text-[#192313]/60 leading-relaxed">
                    Nenhum contrato formalizado no momento.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {contratos.slice(0, 1).map((c) => (
                      <div key={c.id} className="bg-[#f7f8f2] p-4 rounded-2xl border border-black/5 text-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[#192313]">{c.titulo}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            {c.status === 'assinado' ? 'Assinado Digitalmente' : 'Em formalização'}
                          </span>
                        </div>

                        <div className="text-[#192313]/70 space-y-1 mb-3">
                          <div>Honorários mensais: <strong>R$ {Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                          {c.dia_vencimento && <div>Vencimento: Todo dia {c.dia_vencimento}</div>}
                        </div>

                        <a
                          href={`/contrato/${c.token_publico}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#192313] hover:underline"
                        >
                          <span>Visualizar Instrumento Contratual</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo de Entregas do Mês */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-black/5">
                <div className="flex items-center gap-2 mb-4 text-[#192313]">
                  <Calendar className="w-5 h-5 text-[#192313]" />
                  <h3 className="text-sm font-bold">Próximas Publicações no Mês</h3>
                </div>

                {proximasPublicacoes.length === 0 ? (
                  <p className="text-xs text-[#192313]/60 leading-relaxed">
                    Nenhuma publicação agendada para os próximos dias.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {proximasPublicacoes.slice(0, 5).map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#f7f8f2] text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="font-semibold text-[#192313] block truncate">{d.titulo}</span>
                          <span className="text-[10px] text-[#192313]/50 uppercase">{d.formato}</span>
                        </div>
                        {d.data_prazo && (
                          <span className="text-[11px] font-medium text-[#192313]/70 shrink-0">
                            {new Date(d.data_prazo).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Modal Pedir Ajustes no Post */}
      {modalAjusteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-black/10">
            <h3 className="text-base font-bold text-[#192313] mb-2">Solicitar Ajustes</h3>
            <p className="text-xs text-[#192313]/70 mb-4">
              Descreva com detalhes o que você gostaria de alterar no post &quot;{modalAjusteItem.titulo}&quot;:
            </p>

            <form onSubmit={handleEnviarAjuste} className="space-y-4">
              <textarea
                required
                rows={4}
                value={feedbackAjuste}
                onChange={(e) => setFeedbackAjuste(e.target.value)}
                placeholder="Ex: Trocar a foto da capa pela imagem de número 2 e ajustar a frase da legenda..."
                className="w-full text-xs p-3 rounded-2xl border border-black/15 bg-white focus:outline-none focus:ring-2 focus:ring-[#192313] resize-none"
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAjusteItem(null)}
                  className="flex-1 h-10 rounded-full border border-black/15 text-xs font-semibold hover:bg-black/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoAprovacaoId === modalAjusteItem.id}
                  className="flex-1 h-10 rounded-full bg-[#192313] text-white text-xs font-semibold hover:bg-[#2a3820] flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {processandoAprovacaoId === modalAjusteItem.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Enviar Ajustes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
