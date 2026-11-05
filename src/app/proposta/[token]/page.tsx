'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Loader2,
} from 'lucide-react';

interface PropostaPublica {
  id: string;
  titulo: string;
  status: 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'vencida';
  valor_mensal: number;
  valor_setup: number;
  validade?: string | null;
  conteudo_html: string;
  token_publico: string;
  visualizada_em?: string | null;
  aceita_em?: string | null;
  recusada_em?: string | null;
  criado_em: string;
  agencia?: {
    nome: string;
    razao_social?: string;
    cnpj_cpf?: string;
    endereco?: string;
    email_contato?: string;
    telefone_contato?: string;
  };
  cliente?: {
    nome: string;
    responsavel_legal?: string;
  };
  lead?: {
    nome_contato: string;
    empresa?: string;
  };
}

export default function PaginaPropostaPublica() {
  const params = useParams();
  const token = params?.token as string;

  const [carregando, setCarregando] = useState(true);
  const [proposta, setProposta] = useState<PropostaPublica | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Modais de ação
  const [modalAceitarAberto, setModalAceitarAberto] = useState(false);
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [tokenContratoGerado, setTokenContratoGerado] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    async function carregarProposta() {
      try {
        setCarregando(true);
        const res = await fetch(`/api/propostas/public/${token}`);
        if (!res.ok) {
          throw new Error('Proposta não encontrada ou expirada.');
        }
        const data = await res.json();
        setProposta(data.proposta);
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : 'Falha ao carregar proposta.');
      } finally {
        setCarregando(false);
      }
    }

    carregarProposta();
  }, [token]);

  async function responder(acao: 'aceitar' | 'recusar') {
    if (!token) return;
    try {
      setEnviandoResposta(true);
      const res = await fetch(`/api/propostas/public/${token}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao,
          motivo: acao === 'recusar' ? motivoAjuste : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao registrar resposta.');
      }

      if (acao === 'aceitar') {
        setProposta((prev) => (prev ? { ...prev, status: 'aceita', aceita_em: new Date().toISOString() } : null));
        if (data.token_contrato) {
          setTokenContratoGerado(data.token_contrato);
        }
        setModalAceitarAberto(false);
      } else {
        setProposta((prev) => (prev ? { ...prev, status: 'recusada' } : null));
        setModalAjusteAberto(false);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro na requisição');
    } finally {
      setEnviandoResposta(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <Loader2 className="w-8 h-8 animate-spin text-[#192313]/60 mb-3" />
        <p className="text-sm font-medium text-[#192313]/70">Carregando proposta comercial...</p>
      </div>
    );
  }

  if (erro || !proposta) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-black/5 text-center">
          <FileText className="w-12 h-12 text-[#192313]/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#192313] mb-2">Proposta indisponível</h2>
          <p className="text-sm text-[#192313]/60 mb-6">{erro || 'Esta proposta comercial não foi encontrada ou foi arquivada.'}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#192313] text-white text-xs font-semibold hover:bg-[#2a3820] transition-colors"
          >
            Ir para página inicial
          </a>
        </div>
      </div>
    );
  }

  const agenciaNome = proposta.agencia?.nome || 'Agência';
  const valorFormatado = proposta.valor_mensal
    ? `R$ ${Number(proposta.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
    : proposta.valor_setup
    ? `R$ ${Number(proposta.valor_setup).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : null;

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-[#192313] pb-28 print:bg-white print:pb-0">
      {/* Topo da Proposta */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20 print:static print:border-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#192313] text-[#bada55] flex items-center justify-center font-bold text-sm shrink-0">
              G
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#192313]/50 block truncate">
                Proposta Comercial
              </span>
              <span className="text-sm font-bold text-[#192313] block truncate">
                {agenciaNome}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {proposta.status === 'aceita' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Aprovada
              </span>
            ) : proposta.status === 'recusada' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Ajustes Solicitados
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-800 border border-blue-500/20">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Aguardando Decisão
              </span>
            )}

            <button
              onClick={() => window.print()}
              className="p-2 rounded-full hover:bg-black/5 text-[#192313]/60 hover:text-[#192313] transition-colors print:hidden"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Resumo */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="bg-[#192313] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
          <div className="absolute right-0 top-0 w-64 h-64 bg-radial from-[#bada55]/20 to-transparent pointer-events-none rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-[#bada55] text-xs font-semibold uppercase tracking-wider mb-3">
              Documento Oficial
            </span>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight mb-3">
              {proposta.titulo}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-white/10 text-xs sm:text-sm">
              <div>
                <span className="text-white/50 block text-[11px]">Agência</span>
                <span className="font-semibold text-white/90 truncate block">{agenciaNome}</span>
              </div>
              {valorFormatado && (
                <div>
                  <span className="text-white/50 block text-[11px]">Investimento</span>
                  <span className="font-semibold text-[#bada55] truncate block">{valorFormatado}</span>
                </div>
              )}
              {proposta.validade && (
                <div>
                  <span className="text-white/50 block text-[11px]">Validade da Proposta</span>
                  <span className="font-semibold text-white/90 truncate block">
                    {new Date(proposta.validade).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Rico da Proposta */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-black/5">
          <div
            className="prose prose-olive max-w-none text-[#192313] leading-relaxed text-sm sm:text-base
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mb-4 [&_h1]:text-[#192313]
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-[#192313]
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-[#192313]
              [&_p]:mb-3 [&_p]:text-[#192313]/80
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5
              [&_li]:text-[#192313]/85
              [&_.quadro-investimento]:bg-[#f7f8f2] [&_.quadro-investimento]:p-5 [&_.quadro-investimento]:rounded-2xl [&_.quadro-investimento]:border [&_.quadro-investimento]:border-black/5 [&_.quadro-investimento]:my-5
              [&_hr]:my-6 [&_hr]:border-black/5"
            dangerouslySetInnerHTML={{ __html: proposta.conteudo_html }}
          />

          {/* Rodapé de autenticidade */}
          <div className="mt-12 pt-6 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#192313]/50">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Proposta digital registrada e autenticada via GENSBot</span>
            </div>
            <div>
              ID: {proposta.id.slice(0, 8)} • Criada em {new Date(proposta.criado_em).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </main>

      {/* Barra de Ação Fixa Inferior */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-black/10 py-3 px-4 z-30 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="hidden sm:block">
            <span className="text-xs text-[#192313]/60 block">Status da proposta:</span>
            <span className="text-xs font-bold text-[#192313]">
              {proposta.status === 'aceita' ? 'Proposta Aprovada' : proposta.status === 'recusada' ? 'Ajustes Pendentes' : 'Aguardando sua Aprovação'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {proposta.status === 'aceita' ? (
              tokenContratoGerado ? (
                <a
                  href={`/contrato/${tokenContratoGerado}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-[#192313] text-[#bada55] font-semibold text-xs hover:bg-[#2a3820] transition-colors"
                >
                  <span>Assinar Contrato Agora</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Proposta Aprovada! O time da agência já foi notificado.</span>
                </div>
              )
            ) : (
              <>
                <button
                  onClick={() => setModalAjusteAberto(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 h-11 rounded-full border border-black/15 bg-white text-[#192313] font-medium text-xs hover:bg-black/5 transition-colors"
                >
                  Solicitar Ajustes
                </button>
                <button
                  onClick={() => setModalAceitarAberto(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-[#192313] text-[#bada55] font-semibold text-xs hover:bg-[#2a3820] shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprovar Proposta</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Confirmar Aprovação */}
      {modalAceitarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-black/10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#192313] mb-2">Confirmar aprovação</h3>
            <p className="text-xs sm:text-sm text-[#192313]/70 mb-6 leading-relaxed">
              Ao aprovar esta proposta comercial, você declara estar de acordo com os serviços, valores e condições apresentadas. Em seguida, o contrato de prestação de serviços será gerado para formalização digital.
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setModalAceitarAberto(false)}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full border border-black/15 text-xs font-semibold hover:bg-black/5 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => responder('aceitar')}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full bg-[#192313] text-[#bada55] text-xs font-semibold hover:bg-[#2a3820] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {enviandoResposta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar e Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar Ajustes */}
      {modalAjusteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-black/10">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#192313] mb-2">Solicitar ajustes</h3>
            <p className="text-xs sm:text-sm text-[#192313]/70 mb-4 leading-relaxed">
              Descreva abaixo o que gostaria de alterar na proposta (escopo, entregáveis, investimento ou prazos):
            </p>

            <textarea
              value={motivoAjuste}
              onChange={(e) => setMotivoAjuste(e.target.value)}
              placeholder="Ex: Gostaríamos de incluir mais 4 Reels mensais e verificar condição de pagamento..."
              rows={4}
              className="w-full text-xs p-3 rounded-2xl border border-black/15 mb-6 focus:outline-none focus:ring-2 focus:ring-[#192313] resize-none"
            />

            <div className="flex gap-2.5">
              <button
                onClick={() => setModalAjusteAberto(false)}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full border border-black/15 text-xs font-semibold hover:bg-black/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => responder('recusar')}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full bg-[#192313] text-white text-xs font-semibold hover:bg-[#2a3820] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {enviandoResposta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Ajustes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
