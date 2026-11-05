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
} from 'lucide-react';

interface ContratoPublico {
  id: string;
  titulo: string;
  status: 'rascunho' | 'aguardando_assinatura' | 'assinado' | 'cancelado';
  valor_mensal: number;
  dia_vencimento?: number | null;
  data_inicio?: string | null;
  data_termino?: string | null;
  renovacao_automatica: boolean;
  conteudo_html: string;
  token_publico: string;
  assinatura_cliente_nome?: string | null;
  assinatura_cliente_doc?: string | null;
  assinatura_cliente_email?: string | null;
  assinatura_cliente_ip?: string | null;
  assinatura_cliente_data?: string | null;
  assinatura_cliente_imagem?: string | null;
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
        if (!res.ok) {
          throw new Error('Contrato não encontrado ou link expirado.');
        }
        const data = await res.json();
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
    ctx.strokeStyle = '#192313';
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

    if (!nomeSignatario.trim()) {
      alert('Por favor, informe seu nome completo.');
      return;
    }
    if (!docSignatario.trim()) {
      alert('Por favor, informe seu CPF ou CNPJ.');
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
              status: 'assinado',
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
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <Loader2 className="w-8 h-8 animate-spin text-[#192313]/60 mb-3" />
        <p className="text-sm font-medium text-[#192313]/70">Carregando instrumento contratual...</p>
      </div>
    );
  }

  if (erro || !contrato) {
    return (
      <div className="min-h-screen bg-[#f7f8f2] flex flex-col items-center justify-center p-6 text-[#192313]">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-black/5 text-center">
          <FileText className="w-12 h-12 text-[#192313]/30 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#192313] mb-2">Contrato indisponível</h2>
          <p className="text-sm text-[#192313]/60 mb-6">{erro || 'Este contrato não foi localizado ou já foi arquivado.'}</p>
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

  const jaAssinado = contrato.status === 'assinado';

  return (
    <div className="min-h-screen bg-[#f7f8f2] text-[#192313] pb-24 print:bg-white print:pb-0">
      {/* Topo do Contrato */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20 print:static print:border-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#192313] text-[#bada55] flex items-center justify-center font-bold text-sm shrink-0">
              G
            </div>
            <div className="min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#192313]/50 block truncate">
                Contrato Digital
              </span>
              <span className="text-sm font-bold text-[#192313] block truncate">
                {contrato.agencia?.nome || 'Agência'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {jaAssinado ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Assinado Digitalmente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/20">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                Aguardando Assinatura
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

      {/* Hero do Contrato */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="bg-[#192313] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-[#bada55] text-xs font-semibold uppercase tracking-wider mb-3">
            Instrumento Jurídico
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
            {contrato.titulo}
          </h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-white/10 text-xs sm:text-sm">
            <div>
              <span className="text-white/50 block text-[11px]">Contratada</span>
              <span className="font-semibold text-white/90 truncate block">{contrato.agencia?.nome}</span>
            </div>
            {contrato.valor_mensal > 0 && (
              <div>
                <span className="text-white/50 block text-[11px]">Valor Mensal</span>
                <span className="font-semibold text-[#bada55] truncate block">
                  R$ {Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {contrato.dia_vencimento && (
              <div>
                <span className="text-white/50 block text-[11px]">Vencimento</span>
                <span className="font-semibold text-white/90 truncate block">Dia {contrato.dia_vencimento}</span>
              </div>
            )}
            {contrato.data_inicio && (
              <div>
                <span className="text-white/50 block text-[11px]">Início</span>
                <span className="font-semibold text-white/90 truncate block">
                  {new Date(contrato.data_inicio).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Jurídico */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        <div className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-black/5">
          <div
            className="prose prose-olive max-w-none text-[#192313] leading-relaxed text-xs sm:text-sm
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mb-6 [&_h1]:text-[#192313]
              [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[#192313]
              [&_p]:mb-3 [&_p]:text-[#192313]/85 [&_p]:text-justify
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
              [&_hr]:my-6 [&_hr]:border-black/5"
            dangerouslySetInnerHTML={{ __html: contrato.conteudo_html }}
          />

          {/* Seção de Assinatura */}
          <div className="mt-12 pt-8 border-t border-black/10">
            {jaAssinado ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-900">
                      Certificado de Assinatura Eletrônica
                    </h3>
                    <p className="text-xs text-emerald-700">
                      Válido juridicamente nos termos da MP 2.200-2/2001 e Lei 14.063/2020.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#192313]/80 bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
                  <div>
                    <span className="text-[11px] text-[#192313]/50 block">Signatário CONTRATANTE</span>
                    <span className="font-bold text-sm text-[#192313]">{contrato.assinatura_cliente_nome}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#192313]/50 block">CPF / CNPJ</span>
                    <span className="font-semibold text-sm text-[#192313]">{contrato.assinatura_cliente_doc}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#192313]/50 block">Data e Hora (UTC)</span>
                    <span className="font-semibold text-[#192313]">
                      {contrato.assinatura_cliente_data ? new Date(contrato.assinatura_cliente_data).toLocaleString('pt-BR') : 'Data registrada'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#192313]/50 block">Endereço IP Registrado</span>
                    <span className="font-semibold font-mono text-[#192313]">{contrato.assinatura_cliente_ip || '127.0.0.1'}</span>
                  </div>
                </div>

                {contrato.assinatura_cliente_imagem && (
                  <div className="mt-4 pt-4 border-t border-emerald-100 flex items-center gap-4">
                    <span className="text-xs text-[#192313]/60 font-medium">Assinatura Gráfica:</span>
                    <img
                      src={contrato.assinatura_cliente_imagem}
                      alt="Assinatura"
                      className="h-12 border border-black/10 rounded-lg p-1 bg-white"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#f7f8f2] rounded-3xl p-6 sm:p-8 border border-black/10 print:hidden">
                <div className="flex items-center gap-2 mb-2">
                  <PenTool className="w-5 h-5 text-[#192313]" />
                  <h3 className="text-base font-bold text-[#192313]">
                    Assinatura Digital do Contrato
                  </h3>
                </div>
                <p className="text-xs text-[#192313]/70 mb-6">
                  Preencha seus dados para formalizar e assinar eletronicamente este contrato com plena validade legal.
                </p>

                <form onSubmit={handleAssinar} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#192313] mb-1">
                        Nome completo do signatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={nomeSignatario}
                        onChange={(e) => setNomeSignatario(e.target.value)}
                        placeholder="Ex: Carlos Eduardo Silveira"
                        className="w-full h-11 px-3 rounded-2xl border border-black/15 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#192313]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#192313] mb-1">
                        CPF ou CNPJ do signatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={docSignatario}
                        onChange={(e) => setDocSignatario(e.target.value)}
                        placeholder="Ex: 000.000.000-00"
                        className="w-full h-11 px-3 rounded-2xl border border-black/15 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#192313]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#192313] mb-1">
                      E-mail para envio de cópia autenticada
                    </label>
                    <input
                      type="email"
                      value={emailSignatario}
                      onChange={(e) => setEmailSignatario(e.target.value)}
                      placeholder="seuemail@empresa.com.br"
                      className="w-full h-11 px-3 rounded-2xl border border-black/15 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#192313]"
                    />
                  </div>

                  {/* Modo de Assinatura */}
                  <div>
                    <label className="block text-xs font-semibold text-[#192313] mb-2">
                      Como deseja assinar:
                    </label>
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setTipoAssinatura('digitar')}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-colors ${
                          tipoAssinatura === 'digitar'
                            ? 'bg-[#192313] text-white'
                            : 'bg-white border border-black/15 text-[#192313]/70 hover:bg-black/5'
                        }`}
                      >
                        Digitar Nome (Certificado Digital)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoAssinatura('desenhar')}
                        className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-colors ${
                          tipoAssinatura === 'desenhar'
                            ? 'bg-[#192313] text-white'
                            : 'bg-white border border-black/15 text-[#192313]/70 hover:bg-black/5'
                        }`}
                      >
                        Desenhar Assinatura na Tela
                      </button>
                    </div>

                    {tipoAssinatura === 'desenhar' ? (
                      <div className="bg-white p-3 rounded-2xl border border-black/15">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-[#192313]/60">Desenhe sua rubrica no quadro abaixo:</span>
                          <button
                            type="button"
                            onClick={limparCanvas}
                            className="text-[11px] font-semibold text-rose-600 hover:underline"
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
                          className="w-full h-[120px] bg-[#fdfdfc] border border-dashed border-black/20 rounded-xl cursor-crosshair touch-none"
                        />
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-2xl border border-black/15 flex items-center justify-center">
                        <span className="font-serif italic text-lg sm:text-2xl text-[#192313] tracking-wide">
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
                      className="mt-0.5 rounded border-black/20 text-[#192313] focus:ring-[#192313]"
                    />
                    <span className="text-xs text-[#192313]/80 leading-relaxed">
                      Declaro que li e concordo integralmente com as cláusulas deste contrato e confirmo a autenticidade da assinatura digital, com registro do meu endereço IP e carimbo de data/hora.
                    </span>
                  </label>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={assinando}
                      className="w-full h-12 rounded-full bg-[#192313] text-[#bada55] font-semibold text-xs hover:bg-[#2a3820] flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
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
