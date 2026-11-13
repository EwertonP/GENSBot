'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Printer,
  PenTool,
  Lock,
  Loader2,
  Calendar,
  Building2,
  Hash,
  AlertCircle,
  Clock,
  ExternalLink,
  Download,
  Share2,
  Sparkles,
  ArrowRight,
  UserCheck,
  Moon,
  MessageCircle,
} from 'lucide-react';

export interface ContratoPublico {
  id: string;
  titulo: string;
  status: 'rascunho' | 'aguardando_assinatura' | 'assinado_cliente' | 'assinado' | 'cancelado';
  valor_mensal: number;
  dia_vencimento?: number | null;
  data_inicio?: string | null;
  data_termino?: string | null;
  renovacao_automatica: boolean;
  conteudo_html: string;
  conteudo_final_html?: string | null;
  hash_documento?: string | null;
  enviado_em?: string | null;
  visualizado_em?: string | null;
  expira_em?: string | null;
  revogado_em?: string | null;
  token_publico: string;
  assinatura_cliente_nome?: string | null;
  assinatura_cliente_doc?: string | null;
  assinatura_cliente_email?: string | null;
  assinatura_cliente_ip?: string | null;
  assinatura_cliente_data?: string | null;
  assinatura_cliente_imagem?: string | null;
  assinatura_agencia_nome?: string | null;
  assinatura_agencia_data?: string | null;
  assinatura_agencia_ip?: string | null;
  criado_em: string;
  agencia?: {
    nome: string;
    razao_social?: string;
    cnpj_cpf?: string;
    endereco?: string;
    email_contato?: string;
    telefone_contato?: string;
    chave_pix?: string;
  };
  cliente?: {
    nome: string;
    cnpj_cpf?: string;
    responsavel_legal?: string;
    endereco?: string;
  };
  lead?: {
    nome_contato: string;
    empresa?: string;
  };
}

interface ContratoClientProps {
  token: string;
  contratoInicial?: ContratoPublico | null;
}

export default function PaginaContratoClient({ token, contratoInicial }: ContratoClientProps) {
  const [carregando, setCarregando] = useState(!contratoInicial);
  const [contrato, setContrato] = useState<ContratoPublico | null>(contratoInicial || null);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário de assinatura
  const [nomeSignatario, setNomeSignatario] = useState(
    contratoInicial?.cliente?.responsavel_legal || contratoInicial?.lead?.nome_contato || ''
  );
  const [docSignatario, setDocSignatario] = useState(contratoInicial?.cliente?.cnpj_cpf || '');
  const [emailSignatario, setEmailSignatario] = useState('');
  const [concordouTermos, setConcordouTermos] = useState(false);
  const [tipoAssinatura, setTipoAssinatura] = useState<'digitar' | 'desenhar'>('digitar');
  const [assinando, setAssinando] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // UX e Visualização
  const [modoVisualizacao, setModoVisualizacao] = useState<'dark' | 'papel'>('dark');
  const [assinaturaVisivel, setAssinaturaVisivel] = useState(false);
  const [conteudoAjustadoHtml, setConteudoAjustadoHtml] = useState(
    contratoInicial?.conteudo_final_html || contratoInicial?.conteudo_html || ''
  );
  const conteudoRef = useRef<HTMLDivElement | null>(null);

  // Canvas para desenhar assinatura
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [desenhando, setDesenhando] = useState(false);

  // Sincroniza HTML com valor mensal real do contrato
  useEffect(() => {
    if (!contrato) return;
    let html = contrato.conteudo_final_html || contrato.conteudo_html || '';

    if (contrato.valor_mensal > 0) {
      const valorFormatado = `R$ ${Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      html = html.replace(/R\$\s*2\.500,00/g, valorFormatado);
      html = html.replace(/\{\{\s*valor_mensal\s*\}\}/g, valorFormatado);
    }

    if (contrato.dia_vencimento) {
      html = html.replace(/\{\{\s*dia_vencimento\s*\}\}/g, String(contrato.dia_vencimento));
    }

    setConteudoAjustadoHtml(html);
  }, [contrato]);

  // Envolve tabelas em wrappers responsivos com overflow-x-auto
  useEffect(() => {
    if (!conteudoRef.current) return;
    const tables = conteudoRef.current.querySelectorAll('table');
    tables.forEach((table) => {
      if (table.parentElement?.classList.contains('tabela-responsiva-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'tabela-responsiva-wrapper w-full max-w-full min-w-0 overflow-x-auto my-4 rounded-xl border border-white/10 shadow-xs block';
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }, [conteudoAjustadoHtml, modoVisualizacao]);

  // Observa se a seção de assinatura está visível para ocultar a Floating Action Bar
  useEffect(() => {
    const el = document.getElementById('secao-assinatura');
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAssinaturaVisivel(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [contrato]);

  useEffect(() => {
    if (!token) return;

    async function carregarContrato() {
      try {
        if (!contratoInicial) setCarregando(true);
        const res = await fetch(`/api/contratos/public/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Contrato não encontrado ou link expirado.');
        }

        setContrato(data.contrato);

        if (!nomeSignatario) {
          if (data.contrato.cliente?.responsavel_legal) {
            setNomeSignatario(data.contrato.cliente.responsavel_legal);
          } else if (data.contrato.lead?.nome_contato) {
            setNomeSignatario(data.contrato.lead.nome_contato);
          }
        }

        if (!docSignatario && data.contrato.cliente?.cnpj_cpf) {
          setDocSignatario(data.contrato.cliente.cnpj_cpf);
        }
      } catch (err: unknown) {
        setErro(err instanceof Error ? err.message : 'Falha ao carregar contrato.');
      } finally {
        setCarregando(false);
      }
    }

    carregarContrato();
  }, [token]);

  // Funções do Canvas de desenho
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setDesenhando(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!desenhando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#22c55e';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setDesenhando(false);
  };

  const limparCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  async function handleAssinar(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!nomeSignatario.trim() || nomeSignatario.trim().split(/\s+/).length < 2) {
      alert('Por favor, informe seu nome completo (nome e sobrenome).');
      return;
    }
    const docLimpo = docSignatario.replace(/\D/g, '');
    if (docLimpo.length !== 11 && docLimpo.length !== 14) {
      alert('Por favor, informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }
    if (!concordouTermos) {
      alert('Você precisa aceitar os termos do contrato e a validade jurídica da assinatura eletrônica.');
      return;
    }

    let assinaturaImg: string | null = null;
    if (tipoAssinatura === 'desenhar' && canvasRef.current) {
      assinaturaImg = canvasRef.current.toDataURL('image/png');
    }

    try {
      setAssinando(true);
      const res = await fetch(`/api/contratos/public/${token}/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeSignatario.trim(),
          doc: docSignatario.trim(),
          email: emailSignatario.trim() || undefined,
          imagem: assinaturaImg,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar assinatura.');
      }

      setContrato((prev) =>
        prev
          ? {
              ...prev,
              status: 'assinado_cliente',
              hash_documento: data.certificado?.hash_documento || prev.hash_documento,
              assinatura_cliente_nome: nomeSignatario.trim(),
              assinatura_cliente_doc: docSignatario.trim(),
              assinatura_cliente_email: emailSignatario.trim() || null,
              assinatura_cliente_ip: data.certificado?.ip || 'IP Registrado',
              assinatura_cliente_data: data.certificado?.data_hora || new Date().toISOString(),
              assinatura_cliente_imagem: assinaturaImg,
            }
          : null
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao assinar contrato.');
    } finally {
      setAssinando(false);
    }
  }

  function handleCopiarLink() {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#0c100a] text-white flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="relative">
          <div className="size-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-xl">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
          </div>
        </div>
        <p className="text-xs font-semibold text-emerald-400/90 uppercase tracking-widest font-mono">
          Autenticando Instrumento Jurídico...
        </p>
      </div>
    );
  }

  if (erro || !contrato) {
    return (
      <div className="min-h-screen bg-[#0c100a] text-white flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="bg-[#121711] text-white border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="size-14 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2 font-display">Contrato indisponível</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {erro || 'Este contrato não foi localizado, foi revogado ou teve o prazo expirado.'}
          </p>
        </div>
      </div>
    );
  }

  const expirado = contrato.expira_em && new Date(contrato.expira_em).getTime() < Date.now();
  const totalmenteAssinado = contrato.status === 'assinado';
  const jaAssinadoCliente = contrato.status === 'assinado_cliente' || totalmenteAssinado;
  const podeAssinar = !jaAssinadoCliente && !expirado && contrato.status !== 'cancelado';

  const nomeClienteExibicao =
    contrato.cliente?.nome || contrato.lead?.empresa || contrato.lead?.nome_contato || 'Cliente';

  return (
    <div className="min-h-screen bg-[#090d08] text-foreground selection:bg-emerald-500/30 flex flex-col font-sans max-w-full overflow-x-hidden">
      {/* 1. Header Fixo com Branding e Selo Jurídico */}
      <header className="sticky top-0 z-40 bg-[#0c100a]/90 backdrop-blur-md border-b border-white/10 px-3 sm:px-8 py-3 transition-all">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1.5 sm:gap-2 text-emerald-400 font-bold text-[11px] sm:text-xs tracking-wider uppercase font-mono shadow-xs shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>Agência GENS</span>
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-white/90">Instrumento Jurídico Oficial</span>
              <span className="text-[10px] text-muted-foreground font-mono">MP 2.200-2/2001 • Lei 14.063/2020</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {totalmenteAssinado ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% Formalizado</span>
              </span>
            ) : jaAssinadoCliente ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Assinado pelo Cliente (Aguardando Agência)</span>
                <span className="sm:hidden">Assinado</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Aguardando Assinatura</span>
                <span className="xs:hidden">Pendente</span>
              </span>
            )}

            {/* Alternador de Modo Escuro / Folha A4 Corporativa */}
            <button
              type="button"
              onClick={() => setModoVisualizacao((m) => (m === 'dark' ? 'papel' : 'dark'))}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 transition-colors print:hidden cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title={modoVisualizacao === 'dark' ? 'Alternar para Folha A4 Corporativa (Fundo Claro)' : 'Alternar para Modo Escuro'}
            >
              {modoVisualizacao === 'dark' ? (
                <>
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline text-[11px] text-white/80">Folha A4</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline text-[11px] text-white/80">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopiarLink}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 transition-colors print:hidden cursor-pointer"
              title="Copiar link rastreável do contrato"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 transition-colors print:hidden cursor-pointer"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Executivo do Contrato */}
      <section className="max-w-5xl mx-auto w-full min-w-0 px-3 sm:px-8 pt-6 sm:pt-8 pb-4">
        <div className="relative overflow-hidden rounded-3xl w-full min-w-0 max-w-full bg-gradient-to-br from-[#121c10] via-[#0e160e] to-[#0c100a] border border-emerald-500/25 p-5 sm:p-8 shadow-2xl">
          {/* Luz de fundo estética */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold uppercase tracking-wider font-mono border border-emerald-500/30">
              <ShieldCheck className="size-3.5" />
              Contrato de Prestação de Serviços
            </span>

            {contrato.hash_documento && (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-black/40 border border-white/10 px-3 py-1 rounded-full"
                title={`Hash SHA-256: ${contrato.hash_documento}`}
              >
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>SHA-256: {contrato.hash_documento.slice(0, 8)}...{contrato.hash_documento.slice(-8)}</span>
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 font-display leading-tight">
            {contrato.titulo}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mb-5 leading-relaxed">
            Instrumento jurídico firmado entre <strong className="text-white">AGÊNCIA GENS</strong> e{' '}
            <strong className="text-emerald-400">{nomeClienteExibicao}</strong>.
          </p>

          {/* Grid de Resumo Executivo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-4 border-t border-white/10">
            <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
              <span className="text-muted-foreground block text-[11px] font-medium">Contratante</span>
              <span className="font-bold text-white block text-xs sm:text-sm mt-0.5 break-words line-clamp-2" title={nomeClienteExibicao}>
                {nomeClienteExibicao}
              </span>
            </div>

            {contrato.valor_mensal > 0 && (
              <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
                <span className="text-muted-foreground block text-[11px] font-medium">Fee Mensal</span>
                <span className="font-extrabold text-emerald-400 truncate block text-xs sm:text-sm mt-0.5 font-mono">
                  R$ {Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {contrato.dia_vencimento && (
              <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
                <span className="text-muted-foreground block text-[11px] font-medium">Vencimento</span>
                <span className="font-bold text-white truncate block text-xs sm:text-sm mt-0.5">
                  Todo dia {contrato.dia_vencimento}
                </span>
              </div>
            )}

            {contrato.data_inicio && (
              <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
                <span className="text-muted-foreground block text-[11px] font-medium">Início das Ações</span>
                <span className="font-bold text-white truncate block text-xs sm:text-sm mt-0.5" suppressHydrationWarning>
                  {new Date(contrato.data_inicio).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          {contrato.expira_em && !jaAssinadoCliente && (
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-amber-400">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span suppressHydrationWarning>
                Link seguro válido para assinatura até{' '}
                <strong>{new Date(contrato.expira_em).toLocaleDateString('pt-BR')}</strong>
                {expirado && <span className="text-destructive font-bold ml-1">(Prazo expirado)</span>}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 3. Corpo das Cláusulas do Contrato */}
      <main className="max-w-5xl mx-auto w-full min-w-0 px-3 sm:px-8 py-4 flex-1">
        <div
          ref={conteudoRef}
          className={`transition-colors duration-300 rounded-3xl p-5 sm:p-12 shadow-2xl relative w-full min-w-0 max-w-full overflow-hidden ${
            modoVisualizacao === 'papel'
              ? 'bg-[#fcfbf9] text-[#1e293b] border border-amber-900/10 shadow-2xl shadow-black/30'
              : 'bg-[#10160f] text-white/95 border border-white/10'
          }`}
        >
          <div
            className={
              modoVisualizacao === 'papel'
                ? `prose max-w-full min-w-0 overflow-x-hidden text-[#1e293b] leading-relaxed text-xs sm:text-sm font-sans
                  [&_h1]:text-lg sm:[&_h1]:text-2xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:text-[#0f172a] [&_h1]:mb-6
                  [&_h2]:text-sm sm:[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[#047857]
                  [&_h3]:text-xs sm:[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-[#047857]
                  [&_p]:mb-3.5 [&_p]:text-[#334155] [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-[#334155]
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-[#334155]
                  [&_table]:w-full [&_table]:min-w-[480px] [&_table]:border-collapse
                  [&_th]:bg-[#f1f5f9] [&_th]:text-[#0f172a] [&_th]:font-bold [&_th]:p-3 [&_th]:border [&_th]:border-[#cbd5e1] [&_th]:text-left
                  [&_td]:p-3 [&_td]:border [&_td]:border-[#e2e8f0] [&_td]:text-[#334155]
                  [&_strong]:text-[#0f172a] [&_strong]:font-bold
                  [&_hr]:my-6 [&_hr]:border-[#e2e8f0]`
                : `prose dark:prose-invert max-w-full min-w-0 overflow-x-hidden text-white/90 leading-relaxed text-xs sm:text-sm
                  [&_h1]:text-lg sm:[&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-white [&_h1]:mb-6
                  [&_h2]:text-sm sm:[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-emerald-400
                  [&_h3]:text-xs sm:[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-emerald-400
                  [&_p]:mb-3.5 [&_p]:text-white/80 [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ul]:text-white/80
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_ol]:text-white/80
                  [&_table]:w-full [&_table]:min-w-[480px] [&_table]:border-collapse
                  [&_th]:bg-white/5 [&_th]:text-white [&_th]:font-bold [&_th]:p-3 [&_th]:border [&_th]:border-white/10 [&_th]:text-left
                  [&_td]:p-3 [&_td]:border [&_td]:border-white/5 [&_td]:text-white/80
                  [&_strong]:text-white [&_strong]:font-bold
                  [&_hr]:my-6 [&_hr]:border-white/10`
            }
            dangerouslySetInnerHTML={{ __html: conteudoAjustadoHtml }}
          />

          {/* 4. Módulo de Assinatura e Certificados */}
          <div className="mt-12 pt-8 border-t border-white/10">
            {/* Caso A: 100% Formalizado (Cliente e Agência) */}
            {totalmenteAssinado && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                    <ShieldCheck className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-white font-display">
                      Contrato 100% Formalizado e Válido
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Instrumento digital assinado por ambas as partes com certificação nos termos da MP 2.200-2/2001 e Lei 14.063/2020.
                    </p>
                  </div>
                </div>

                {/* Certificados lado a lado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Certificado Cliente */}
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/10 text-xs space-y-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-400 block">
                      Assinatura CONTRATANTE
                    </span>
                    <div className="font-bold text-white text-sm">{contrato.assinatura_cliente_nome}</div>
                    <div className="text-muted-foreground">Documento: {contrato.assinatura_cliente_doc}</div>
                    <div className="text-muted-foreground font-mono text-[11px]">
                      Data: {contrato.assinatura_cliente_data ? new Date(contrato.assinatura_cliente_data).toLocaleString('pt-BR') : 'Registrada'}
                    </div>
                    <div className="text-muted-foreground font-mono text-[11px]">
                      IP: {contrato.assinatura_cliente_ip || 'Registrado'}
                    </div>
                    {contrato.assinatura_cliente_imagem && (
                      <div className="pt-2 border-t border-white/10">
                        <img
                          src={contrato.assinatura_cliente_imagem}
                          alt="Rubrica do contratante"
                          className="h-10 object-contain invert brightness-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* Certificado Agência GENS */}
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/10 text-xs space-y-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-400 block">
                      Assinatura CONTRATADA (Agência GENS)
                    </span>
                    <div className="font-bold text-white text-sm">
                      {contrato.assinatura_agencia_nome || 'Ewerton Monteiro / João Vitor Queiróz'}
                    </div>
                    <div className="text-muted-foreground">CNPJ: 55.823.814/0001-18</div>
                    <div className="text-muted-foreground font-mono text-[11px]">
                      Data: {contrato.assinatura_agencia_data ? new Date(contrato.assinatura_agencia_data).toLocaleString('pt-BR') : 'Registrada'}
                    </div>
                    <div className="text-muted-foreground font-mono text-[11px]">
                      IP: {contrato.assinatura_agencia_ip || 'Servidor Seguro'}
                    </div>
                  </div>
                </div>

                {/* Botão de Download do PDF Autenticado */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <a
                    href={`/api/contratos/public/${contrato.token_publico}/pdf`}
                    download={`contrato-${contrato.id.slice(0, 8)}.pdf`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Baixar PDF Autenticado com Assinaturas</span>
                  </a>

                  <span className="text-xs text-muted-foreground font-mono">
                    Hash SHA-256: {contrato.hash_documento?.slice(0, 16)}...
                  </span>
                </div>

                {/* Banner de Boas-Vindas ao Onboarding */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-black border border-emerald-500/30 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">Parabéns pela formalização da parceria! 🚀</h4>
                      <p className="text-[11px] sm:text-xs text-muted-foreground">
                        O próximo passo da nossa equipe é o alinhamento de Onboarding para coleta de acessos e briefing inicial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Caso B: Assinado pelo Cliente, aguardando Agência */}
            {contrato.status === 'assinado_cliente' && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-3xl p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500 text-black flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">
                      Sua assinatura foi registrada com sucesso!
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O instrumento jurídico foi assinado digitalmente e aguarda agora a contra-assinatura dos sócios da Agência GENS.
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 p-4 rounded-2xl border border-white/10 text-xs space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold tracking-wider text-sky-400">
                    Evidência Digital de Assinatura
                  </div>
                  <div className="font-bold text-white text-sm">{contrato.assinatura_cliente_nome}</div>
                  <div className="text-muted-foreground">CPF/CNPJ: {contrato.assinatura_cliente_doc}</div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    Data e Hora: {contrato.assinatura_cliente_data ? new Date(contrato.assinatura_cliente_data).toLocaleString('pt-BR') : 'Agora'}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    IP: {contrato.assinatura_cliente_ip || 'Gravado'}
                  </div>
                </div>
              </div>
            )}

            {/* Caso C: Pendente de Assinatura do Cliente */}
            {podeAssinar && (
              <div
                id="secao-assinatura"
                className="bg-[#121811] rounded-3xl p-5 sm:p-8 border border-white/10 print:hidden shadow-xl scroll-mt-24"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <PenTool className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white font-display">
                      Assinatura Digital do Contrato
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Preencha os dados abaixo para formalizar eletronicamente este instrumento com plena validade jurídica.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAssinar} className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/90 mb-1.5">
                        Nome completo do signatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={nomeSignatario}
                        onChange={(e) => setNomeSignatario(e.target.value)}
                        placeholder="Ex: Allyson Diniz Melo"
                        className="w-full h-11 px-3.5 rounded-xl border border-white/15 text-xs bg-black/40 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/90 mb-1.5">
                        CPF ou CNPJ do signatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={docSignatario}
                        onChange={(e) => setDocSignatario(e.target.value)}
                        placeholder="Ex: 12.661.847/0001-04"
                        className="w-full h-11 px-3.5 rounded-xl border border-white/15 text-xs bg-black/40 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/90 mb-1.5">
                      E-mail para recebimento da via assinada
                    </label>
                    <input
                      type="email"
                      value={emailSignatario}
                      onChange={(e) => setEmailSignatario(e.target.value)}
                      placeholder="financeiro@empresa.com.br"
                      className="w-full h-11 px-3.5 rounded-xl border border-white/15 text-xs bg-black/40 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* Modo de Assinatura */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-white/90 mb-2">
                      Formato da sua assinatura:
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setTipoAssinatura('digitar')}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          tipoAssinatura === 'digitar'
                            ? 'bg-emerald-500 text-black font-bold shadow-md'
                            : 'bg-black/30 border border-white/10 text-muted-foreground hover:text-white'
                        }`}
                      >
                        Digitar Nome (Certificado Digital)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoAssinatura('desenhar')}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          tipoAssinatura === 'desenhar'
                            ? 'bg-emerald-500 text-black font-bold shadow-md'
                            : 'bg-black/30 border border-white/10 text-muted-foreground hover:text-white'
                        }`}
                      >
                        Desenhar Rubrica na Tela
                      </button>
                    </div>

                    {tipoAssinatura === 'desenhar' ? (
                      <div className="bg-black/40 p-3 rounded-2xl border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-muted-foreground">Desenhe sua rubrica no quadro abaixo:</span>
                          <button
                            type="button"
                            onClick={limparCanvas}
                            className="text-[11px] font-semibold text-destructive hover:underline cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>
                        <canvas
                          ref={canvasRef}
                          width={480}
                          height={120}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-[120px] bg-[#0c100a] border border-dashed border-white/20 rounded-xl cursor-crosshair touch-none"
                        />
                      </div>
                    ) : (
                      <div className="bg-black/40 p-4 rounded-2xl border border-white/10 flex items-center justify-center">
                        <span className="font-serif italic text-lg sm:text-2xl text-emerald-400 tracking-wide">
                          {nomeSignatario || 'Sua Assinatura Formal'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Declaração e Termos de Consentimento */}
                  <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={concordouTermos}
                      onChange={(e) => setConcordouTermos(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Declaro que li e concordo integralmente com todas as cláusulas deste contrato e confirmo a autenticidade da assinatura digital, com registro do meu endereço IP, hash SHA-256 e carimbo de data/hora nos termos da MP 2.200-2/2001 e Lei 14.063/2020.
                    </span>
                  </label>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={assinando}
                      className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                    >
                      {assinando ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Autenticando e gravando certificado...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                          <span>Assinar Contrato Digitalmente</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 5. Barra Flutuante de Ação no Rodapé (Mobile e Desktop) */}
      {podeAssinar && !assinaturaVisivel && (
        <aside
          aria-label="Ações rápidas do contrato"
          className="fixed bottom-0 left-0 right-0 z-30 bg-[#0c100a]/95 backdrop-blur-lg border-t border-emerald-500/30 px-3 py-3 sm:py-3.5 sm:px-6 shadow-[0_-10px_35px_rgba(0,0,0,0.7)] animate-in fade-in slide-in-from-bottom duration-300 print:hidden"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                <PenTool className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate max-w-[160px] sm:max-w-md">
                  {contrato.titulo}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-semibold truncate">
                  {contrato.valor_mensal > 0
                    ? `R$ ${Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês`
                    : 'Aguardando formalização'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`https://wa.me/5583999075739?text=${encodeURIComponent(`Olá, estou com uma dúvida referente ao contrato "${contrato.titulo}" da Agência GENS.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 sm:h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Tirar dúvidas com a Agência GENS via WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Dúvidas</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  document.getElementById('secao-assinatura')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="h-9 sm:h-10 px-3.5 sm:px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                <span>Assinar Agora</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Footer Discreto */}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t border-white/5 print:hidden">
        <p>Agência GENS • CNPJ: 55.823.814/0001-18 • Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
