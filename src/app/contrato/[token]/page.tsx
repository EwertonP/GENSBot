'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';

interface ContratoPublico {
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
  };
  lead?: {
    nome_contato: string;
    empresa?: string;
  };
}

export default function PaginaContratoPublico() {
  const params = useParams();
  const token = params?.token as string;

  const [carregando, setCarregando] = useState(true);
  const [contrato, setContrato] = useState<ContratoPublico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário de assinatura
  const [nomeSignatario, setNomeSignatario] = useState('');
  const [docSignatario, setDocSignatario] = useState('');
  const [emailSignatario, setEmailSignatario] = useState('');
  const [concordouTermos, setConcordouTermos] = useState(false);
  const [tipoAssinatura, setTipoAssinatura] = useState<'digitar' | 'desenhar'>('digitar');
  const [assinando, setAssinando] = useState(false);

  // Canvas para desenhar assinatura
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [desenhando, setDesenhando] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function carregarContrato() {
      try {
        setCarregando(true);
        const res = await fetch(`/api/contratos/public/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Contrato não encontrado ou link expirado.');
        }

        setContrato(data.contrato);

        // Preenche com dados sugeridos se disponíveis
        if (data.contrato.cliente?.responsavel_legal) {
          setNomeSignatario(data.contrato.cliente.responsavel_legal);
        } else if (data.contrato.lead?.nome_contato) {
          setNomeSignatario(data.contrato.lead.nome_contato);
        }

        if (data.contrato.cliente?.cnpj_cpf) {
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
    ctx.strokeStyle = '#0D231C';
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

  if (carregando) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Carregando instrumento jurídico...
        </p>
      </div>
    );
  }

  if (erro || !contrato) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-lg">
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Contrato indisponível</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {erro || 'Este contrato não foi localizado, foi revogado ou teve o prazo expirado.'}
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

  const jaAssinadoCliente = contrato.status === 'assinado_cliente' || contrato.status === 'assinado';
  const concluido = contrato.status === 'assinado';
  const expirado = contrato.expira_em ? Date.now() > new Date(contrato.expira_em).getTime() : false;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 print:bg-white print:text-black print:pb-0">
      {/* Topo do Contrato */}
      <header className="border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-20 print:static print:border-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
              G
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground block truncate">
                Contrato Digital
              </span>
              <span className="text-sm font-bold text-foreground block truncate">
                {contrato.agencia?.nome || 'Agência'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {concluido ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Assinado por Ambas as Partes
              </span>
            ) : jaAssinadoCliente ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Assinado pelo Cliente (Aguardando Agência)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Aguardando Sua Assinatura
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

      {/* Hero do Contrato */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="bg-card text-card-foreground border border-border rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
              Instrumento Jurídico Imutável
            </span>
            {contrato.hash_documento && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full" title={contrato.hash_documento}>
                <Hash className="w-3 h-3" />
                SHA-256: {contrato.hash_documento.slice(0, 10)}...{contrato.hash_documento.slice(-8)}
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-3 text-foreground">
            {contrato.titulo}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-border text-xs sm:text-sm">
            <div>
              <span className="text-muted-foreground block text-[11px]">Contratada</span>
              <span className="font-semibold text-foreground truncate block">{contrato.agencia?.nome}</span>
            </div>
            {contrato.valor_mensal > 0 && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Valor Mensal</span>
                <span className="font-semibold text-primary truncate block">
                  R$ {Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {contrato.dia_vencimento && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Vencimento</span>
                <span className="font-semibold text-foreground truncate block">Dia {contrato.dia_vencimento}</span>
              </div>
            )}
            {contrato.data_inicio && (
              <div>
                <span className="text-muted-foreground block text-[11px]">Início</span>
                <span className="font-semibold text-foreground truncate block">
                  {new Date(contrato.data_inicio).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          {contrato.expira_em && !jaAssinadoCliente && (
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Link válido até <strong>{new Date(contrato.expira_em).toLocaleDateString('pt-BR')}</strong>
                {expirado && <span className="text-destructive font-bold ml-1">(Prazo expirado)</span>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo Jurídico */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-12 shadow-xs border border-border">
          <div
            className="prose dark:prose-invert max-w-none text-foreground leading-relaxed text-xs sm:text-sm
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mb-6 [&_h1]:text-foreground
              [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-foreground
              [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-foreground
              [&_p]:mb-3 [&_p]:text-foreground/90 [&_p]:text-justify
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
              [&_hr]:my-6 [&_hr]:border-border"
            dangerouslySetInnerHTML={{ __html: contrato.conteudo_html }}
          />

          {/* Seção de Assinatura */}
          <div className="mt-12 pt-8 border-t border-border">
            {jaAssinadoCliente ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Certificado de Assinatura Eletrônica
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Válido juridicamente nos termos do art. 10, § 2º da MP 2.200-2/2001 e Lei 14.063/2020.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-foreground bg-card p-5 rounded-2xl border border-border shadow-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Signatário CONTRATANTE</span>
                    <span className="font-bold text-sm text-foreground">{contrato.assinatura_cliente_nome}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">CPF / CNPJ</span>
                    <span className="font-semibold text-sm text-foreground">{contrato.assinatura_cliente_doc}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Data e Hora (UTC)</span>
                    <span className="font-semibold text-foreground">
                      {contrato.assinatura_cliente_data ? new Date(contrato.assinatura_cliente_data).toLocaleString('pt-BR') : 'Data registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Endereço IP Registrado</span>
                    <span className="font-semibold font-mono text-foreground">{contrato.assinatura_cliente_ip || '127.0.0.1'}</span>
                  </div>
                  {contrato.hash_documento && (
                    <div className="sm:col-span-2 pt-2 border-t border-border">
                      <span className="text-[10px] text-muted-foreground block">Hash SHA-256 de Integridade do Documento:</span>
                      <span className="font-mono text-[11px] text-foreground break-all">{contrato.hash_documento}</span>
                    </div>
                  )}
                </div>

                {contrato.assinatura_agencia_data && (
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-card p-4 rounded-2xl border border-border">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Contra-assinatura CONTRATADA (Agência)</span>
                      <span className="font-bold text-foreground">{contrato.assinatura_agencia_nome || contrato.agencia?.nome}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Data da Contra-assinatura</span>
                      <span className="font-semibold text-foreground">
                        {new Date(contrato.assinatura_agencia_data).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                )}

                {contrato.assinatura_cliente_imagem && (
                  <div className="mt-4 pt-4 border-t border-emerald-500/20 flex items-center gap-4">
                    <span className="text-xs text-muted-foreground font-medium">Assinatura Gráfica:</span>
                    <img
                      src={contrato.assinatura_cliente_imagem}
                      alt="Assinatura"
                      className="h-12 border border-border rounded-lg p-1 bg-white"
                    />
                  </div>
                )}
              </div>
            ) : expirado ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-3xl p-6 text-center text-destructive">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <h3 className="text-base font-bold mb-1">Prazo de assinatura expirado</h3>
                <p className="text-xs text-muted-foreground">
                  O link de assinatura deste contrato expirou em {new Date(contrato.expira_em!).toLocaleDateString('pt-BR')}. Entre em contato com a agência para emitir um novo link seguro.
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border print:hidden">
                <div className="flex items-center gap-2 mb-2">
                  <PenTool className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Assinatura Digital do Contrato
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-6">
                  Preencha seus dados para formalizar e assinar eletronicamente este contrato com plena validade legal.
                </p>

                <form onSubmit={handleAssinar} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Nome completo do signatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={nomeSignatario}
                        onChange={(e) => setNomeSignatario(e.target.value)}
                        placeholder="Ex: Carlos Eduardo Silveira"
                        className="w-full h-11 px-3 rounded-2xl border border-input text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        CPF ou CNPJ do signatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={docSignatario}
                        onChange={(e) => setDocSignatario(e.target.value)}
                        placeholder="Ex: 000.000.000-00"
                        className="w-full h-11 px-3 rounded-2xl border border-input text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      E-mail para envio de cópia autenticada
                    </label>
                    <input
                      type="email"
                      value={emailSignatario}
                      onChange={(e) => setEmailSignatario(e.target.value)}
                      placeholder="seuemail@empresa.com.br"
                      className="w-full h-11 px-3 rounded-2xl border border-input text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Modo de Assinatura */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">
                      Como deseja assinar:
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setTipoAssinatura('digitar')}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-colors ${
                          tipoAssinatura === 'digitar'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Digitar Nome (Certificado Digital)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoAssinatura('desenhar')}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-colors ${
                          tipoAssinatura === 'desenhar'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Desenhar Assinatura na Tela
                      </button>
                    </div>

                    {tipoAssinatura === 'desenhar' ? (
                      <div className="bg-card p-3 rounded-2xl border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-muted-foreground">Desenhe sua rubrica no quadro abaixo:</span>
                          <button
                            type="button"
                            onClick={limparCanvas}
                            className="text-[11px] font-semibold text-destructive hover:underline"
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
                          className="w-full h-[120px] bg-white border border-dashed border-input rounded-xl cursor-crosshair touch-none"
                        />
                      </div>
                    ) : (
                      <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-center">
                        <span className="font-serif italic text-lg sm:text-2xl text-foreground tracking-wide">
                          {nomeSignatario || 'Seu Nome Estilizado'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Termos e Declaração */}
                  <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={concordouTermos}
                      onChange={(e) => setConcordouTermos(e.target.checked)}
                      className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Declaro que li e concordo integralmente com as cláusulas deste contrato e confirmo a autenticidade da assinatura digital, com registro do meu endereço IP, hash do documento e carimbo de data/hora (MP 2.200-2/2001).
                    </span>
                  </label>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={assinando}
                      className="w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {assinando ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Autenticando e gravando certificado...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
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
    </div>
  );
}
