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
          throw new Error('Proposta não encontrada ou link expirado.');
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
        throw new Error(data.error || 'Falha ao processar resposta.');
      }

      setProposta((prev) =>
        prev
          ? {
              ...prev,
              status: acao === 'aceitar' ? 'aceita' : 'recusada',
              aceita_em: acao === 'aceitar' ? new Date().toISOString() : prev.aceita_em,
              recusada_em: acao === 'recusar' ? new Date().toISOString() : prev.recusada_em,
            }
          : null
      );

      if (data.contrato?.token_publico) {
        setTokenContratoGerado(data.contrato.token_publico);
      }

      setModalAceitarAberto(false);
      setModalAjusteAberto(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao responder proposta.');
    } finally {
      setEnviandoResposta(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Carregando proposta comercial...
        </p>
      </div>
    );
  }

  if (erro || !proposta) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-lg">
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Proposta indisponível</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {erro || 'Esta proposta comercial não foi localizada ou já expirou.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
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
    <div className="min-h-screen bg-background text-foreground pb-28 print:bg-white print:text-black print:pb-0">
      {/* Topo da Proposta */}
      <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-20 print:static print:border-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
              G
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground block truncate">
                Proposta Comercial
              </span>
              <span className="text-sm font-bold text-foreground block truncate">
                {agenciaNome}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {proposta.status === 'aceita' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Aprovada
              </span>
            ) : proposta.status === 'recusada' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Ajustes Solicitados
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Aguardando Decisão
              </span>
            )}

            <button
              onClick={() => window.print()}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors print:hidden"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Resumo */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
              Documento Oficial
            </span>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight mb-3 text-foreground">
              {proposta.titulo}
            </h1>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-border text-xs sm:text-sm">
              <div>
                <span className="text-muted-foreground block text-[11px]">Agência</span>
                <span className="font-semibold text-foreground truncate block">{agenciaNome}</span>
              </div>
              {valorFormatado && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Investimento</span>
                  <span className="font-semibold text-primary truncate block">{valorFormatado}</span>
                </div>
              )}
              {proposta.validade && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Validade da Proposta</span>
                  <span className="font-semibold text-foreground truncate block">
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
        <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-12 shadow-xs border border-border">
          <div
            className="prose dark:prose-invert max-w-none text-foreground leading-relaxed text-sm sm:text-base
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mb-4 [&_h1]:text-foreground
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-foreground
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-foreground
              [&_p]:mb-3 [&_p]:text-foreground/90
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5
              [&_li]:text-foreground/85
              [&_.quadro-investimento]:bg-muted [&_.quadro-investimento]:p-5 [&_.quadro-investimento]:rounded-2xl [&_.quadro-investimento]:border [&_.quadro-investimento]:border-border [&_.quadro-investimento]:my-5
              [&_hr]:my-6 [&_hr]:border-border"
            dangerouslySetInnerHTML={{ __html: proposta.conteudo_html }}
          />

          {/* Rodapé de autenticidade */}
          <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
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
      <div className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur-md border-t border-border py-3 px-4 z-30 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="hidden sm:block">
            <span className="text-xs text-muted-foreground block">Status da proposta:</span>
            <span className="text-xs font-bold text-foreground">
              {proposta.status === 'aceita' ? 'Proposta Aprovada' : proposta.status === 'recusada' ? 'Ajustes Pendentes' : 'Aguardando sua Aprovação'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {proposta.status === 'aceita' ? (
              tokenContratoGerado ? (
                <a
                  href={`/contrato/${tokenContratoGerado}`}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity"
                >
                  <span>Assinar Contrato Agora</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-4 py-2.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Proposta Aprovada! O time da agência já foi notificado.</span>
                </div>
              )
            ) : (
              <>
                <button
                  onClick={() => setModalAjusteAberto(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 h-11 rounded-full border border-border bg-card text-foreground font-medium text-xs hover:bg-muted transition-colors cursor-pointer"
                >
                  Solicitar Ajustes
                </button>
                <button
                  onClick={() => setModalAceitarAberto(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 shadow-sm transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-border">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Confirmar aprovação</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
              Ao aprovar esta proposta comercial, você declara estar de acordo com os serviços, valores e condições apresentadas. Em seguida, o contrato de prestação de serviços será gerado para formalização digital.
            </p>

            <div className="flex gap-2.5">
              <button
                onClick={() => setModalAceitarAberto(false)}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={() => responder('aceitar')}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {enviandoResposta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar e Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar Ajustes */}
      {modalAjusteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-border">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Solicitar ajustes</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed">
              Descreva abaixo o que gostaria de alterar na proposta (escopo, entregáveis, investimento ou prazos):
            </p>

            <textarea
              value={motivoAjuste}
              onChange={(e) => setMotivoAjuste(e.target.value)}
              placeholder="Ex: Gostaríamos de incluir mais 4 Reels mensais e verificar condição de pagamento..."
              rows={4}
              className="w-full text-xs p-3 rounded-2xl border border-input bg-background text-foreground mb-6 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />

            <div className="flex gap-2.5">
              <button
                onClick={() => setModalAjusteAberto(false)}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => responder('recusar')}
                disabled={enviandoResposta}
                className="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-50 cursor-pointer"
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
