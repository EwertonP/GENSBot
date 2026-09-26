'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
  UploadCloud,
  FileCheck,
  Star,
  MessageCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { Form, FormField } from '@/types/form';
import {
  validateFieldAnswer,
  formatWhatsAppMask,
  getNextFieldIndex,
  calculateProgress,
} from '@/lib/form-engine';
import { uploadMediaFile } from '@/lib/storage-upload';

interface FormPlayerProps {
  form: Form;
  isPreview?: boolean;
  onFinishPreview?: () => void;
}

const LETRAS_OPCOES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export default function FormPlayer({ form, isPreview = false, onFinishPreview }: FormPlayerProps) {
  const fields = useMemo(() => form.fields || [], [form.fields]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([0]);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const inputRef = useRef<any>(null);

  const currentField: FormField | undefined = fields[currentIndex];
  const progressPct = calculateProgress(currentIndex, fields.length);

  // Foco automático no input quando a tela muda
  useEffect(() => {
    setErrorMsg(null);
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus?.();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const currentAnswer = currentField ? answers[currentField.id] : undefined;

  // Atualiza resposta
  function handleSetAnswer(value: any) {
    if (!currentField) return;
    setErrorMsg(null);
    setAnswers((prev) => ({
      ...prev,
      [currentField.id]: value,
    }));
  }

  // Avança para a próxima pergunta
  function handleNext() {
    if (!currentField) return;

    // Se for thank_you final
    if (currentField.tipo === 'thank_you') {
      if (isPreview && onFinishPreview) {
        onFinishPreview();
      }
      return;
    }

    // Validação da pergunta atual
    const validation = validateFieldAnswer(currentField, currentAnswer);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Preencha este campo para continuar.');
      return;
    }

    // Se for a última pergunta antes do thank_you ou o fim do formulário
    const nextIdx = getNextFieldIndex(currentIndex, fields, answers);

    // Se chegamos no final e não enviamos ainda
    if (nextIdx >= fields.length - 1 && fields[nextIdx]?.tipo === 'thank_you' && !submitted && !isPreview) {
      handleSubmit(answers);
    } else if (nextIdx >= fields.length && !submitted && !isPreview) {
      handleSubmit(answers);
      return;
    }

    setDirection('forward');
    setHistory((prev) => [...prev, nextIdx]);
    setCurrentIndex(nextIdx);
  }

  // Volta para a pergunta anterior usando o histórico
  function handleBack() {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // remove atual
    const prevIdx = newHistory[newHistory.length - 1];

    setDirection('backward');
    setHistory(newHistory);
    setCurrentIndex(prevIdx);
    setErrorMsg(null);
  }

  // Submissão real
  async function handleSubmit(finalAnswers: Record<string, any>) {
    setSubmitting(true);
    try {
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const utm_source = searchParams?.get('utm_source');
      const utm_medium = searchParams?.get('utm_medium');
      const utm_campaign = searchParams?.get('utm_campaign');
      const utm_content = searchParams?.get('utm_content');
      const tempo_preenchimento_segundos = Math.round((Date.now() - startTimeRef.current) / 1000);

      const res = await fetch(`/api/forms/public/${form.slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: finalAnswers,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          tempo_preenchimento_segundos,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao enviar respostas.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  // Listener de Teclado global para experiência Typeform
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignora se estiver num textarea e apertar enter sem shift
      const isTextarea = (e.target as HTMLElement)?.tagName === 'TEXTAREA';

      if (e.key === 'Enter') {
        if (isTextarea && !e.shiftKey) {
          // Permite quebra de linha no textarea
          return;
        }
        e.preventDefault();
        handleNext();
        return;
      }

      // Atalhos de letra para múltipla escolha (A, B, C...)
      if (
        currentField?.tipo === 'choice' &&
        currentField.opcoes &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        const keyUpper = e.key.toUpperCase();
        const letterIdx = LETRAS_OPCOES.indexOf(keyUpper);
        if (letterIdx !== -1 && letterIdx < currentField.opcoes.length) {
          e.preventDefault();
          const option = currentField.opcoes[letterIdx];
          handleSetAnswer(option.id);
          // Auto-advance para opção única
          if (!currentField.multipla_escolha) {
            setTimeout(() => {
              handleNext();
            }, 220);
          }
        }
      }

      // Seta para cima / para baixo
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleBack();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentField, currentAnswer, answers, history]);

  // Upload de arquivo
  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    setErrorMsg(null);
    try {
      const result = await uploadMediaFile(file, 'forms');
      handleSetAnswer({
        url: result.url,
        nome: result.nome,
        tamanho: result.tamanho,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar arquivo.');
    } finally {
      setUploadingFile(false);
    }
  }

  const tema = form.tema_config || {
    cor_primaria: '#10b981',
    cor_fundo: '#ffffff',
    cor_texto: '#09090b',
    cor_card: '#f4f4f5',
  };

  const variants: any = {
    enter: (dir: 'forward' | 'backward') => ({
      y: dir === 'forward' ? 35 : -35,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.25, ease: 'easeOut' },
    },
    exit: (dir: 'forward' | 'backward') => ({
      y: dir === 'forward' ? -35 : 35,
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.2, ease: 'easeIn' },
    }),
  };

  if (!currentField) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-zinc-500">Este formulário não possui perguntas configuradas.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between select-none overflow-x-hidden relative font-sans"
      style={{
        backgroundColor: tema.cor_fundo || '#ffffff',
        color: tema.cor_texto || '#09090b',
      }}
    >
      {/* Barra de Progresso Superior */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-200/40 z-50">
        <motion.div
          className="h-full"
          style={{ backgroundColor: tema.cor_primaria || '#10b981' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Topo: Logo ou Nome do Cliente / Agência */}
      <header className="px-6 py-6 max-w-3xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {tema.logo_url ? (
            <img src={tema.logo_url} alt="Logo" className="h-8 max-w-[140px] object-contain" />
          ) : form.cliente_nome ? (
            <span className="text-xs uppercase font-bold tracking-widest opacity-60">
              {form.cliente_nome}
            </span>
          ) : null}
        </div>
        <div className="text-xs font-medium opacity-40">
          {currentIndex + 1} de {fields.length}
        </div>
      </header>

      {/* Área Central: Pergunta Atual */}
      <main className="flex-1 flex items-center justify-center px-6 py-8 max-w-2xl w-full mx-auto">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentField.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full flex flex-col items-start text-left"
          >
            {/* 1. TELA DE BOAS-VINDAS */}
            {currentField.tipo === 'welcome' && (
              <div className="space-y-6 w-full py-4">
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                  {currentField.label}
                </h1>
                {currentField.descricao && (
                  <p className="text-lg sm:text-xl opacity-75 font-normal leading-relaxed max-w-xl">
                    {currentField.descricao}
                  </p>
                )}
                <div className="pt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    style={{ backgroundColor: tema.cor_primaria || '#10b981', color: '#ffffff' }}
                    className="px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:brightness-105 active:scale-98 transition-all flex items-center gap-3 cursor-pointer"
                  >
                    <span>Começar</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <span className="hidden sm:inline-block text-xs opacity-50 font-medium">
                    pressione <strong className="underline">Enter ↵</strong>
                  </span>
                </div>
              </div>
            )}

            {/* 2. TELA DE AGRADECIMENTO */}
            {currentField.tipo === 'thank_you' && (
              <div className="space-y-6 w-full py-4 text-center sm:text-left">
                <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 text-emerald-500 mb-2">
                  <Check className="w-10 h-10 stroke-[2.5]" />
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                  {currentField.label}
                </h1>
                {currentField.descricao && (
                  <p className="text-lg sm:text-xl opacity-75 leading-relaxed max-w-xl">
                    {currentField.descricao}
                  </p>
                )}
                {form.notificacao_whatsapp_numero && (
                  <div className="pt-4">
                    <a
                      href={`https://wa.me/55${form.notificacao_whatsapp_numero.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Acabei de preencher o formulário.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-98"
                    >
                      <MessageCircle className="w-6 h-6" />
                      <span>Falar no WhatsApp agora</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 3. PERGUNTAS NORMAIS */}
            {currentField.tipo !== 'welcome' && currentField.tipo !== 'thank_you' && (
              <div className="space-y-6 w-full">
                {/* Cabeçalho da Pergunta */}
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold opacity-40">
                      {currentIndex}.
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                      {currentField.label}
                      {currentField.obrigatorio && (
                        <span className="text-rose-500 ml-1.5" title="Obrigatório">*</span>
                      )}
                    </h2>
                  </div>
                  {currentField.descricao && (
                    <p className="text-sm sm:text-base opacity-60 pl-6 leading-relaxed">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                {/* Input: TEXTO CURTO */}
                {currentField.tipo === 'text' && (
                  <div className="pt-2 pl-6">
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentAnswer || ''}
                      onChange={(e) => handleSetAnswer(e.target.value)}
                      placeholder={currentField.placeholder || 'Digite sua resposta aqui...'}
                      className="w-full text-xl sm:text-2xl font-medium bg-transparent border-b-2 border-zinc-300/80 focus:border-emerald-500 focus:outline-none pb-2 transition-colors placeholder:text-zinc-400/60"
                    />
                  </div>
                )}

                {/* Input: TEXTAREA */}
                {currentField.tipo === 'textarea' && (
                  <div className="pt-2 pl-6">
                    <textarea
                      ref={inputRef}
                      rows={3}
                      value={currentAnswer || ''}
                      onChange={(e) => handleSetAnswer(e.target.value)}
                      placeholder={currentField.placeholder || 'Digite sua resposta detalhada...'}
                      className="w-full text-lg sm:text-xl font-medium bg-transparent border-2 border-zinc-300/80 rounded-2xl p-4 focus:border-emerald-500 focus:outline-none transition-colors placeholder:text-zinc-400/60 resize-none"
                    />
                    <p className="text-xs opacity-40 mt-1">Pressione Shift + Enter para quebrar linha</p>
                  </div>
                )}

                {/* Input: WHATSAPP */}
                {currentField.tipo === 'whatsapp' && (
                  <div className="pt-2 pl-6">
                    <div className="flex items-center gap-3 border-b-2 border-zinc-300/80 focus-within:border-emerald-500 pb-2 transition-colors">
                      <span className="text-lg font-bold opacity-60">🇧🇷 +55</span>
                      <input
                        ref={inputRef}
                        type="tel"
                        value={currentAnswer || ''}
                        onChange={(e) => handleSetAnswer(formatWhatsAppMask(e.target.value))}
                        placeholder={currentField.placeholder || '(11) 99999-9999'}
                        className="w-full text-xl sm:text-2xl font-medium bg-transparent focus:outline-none placeholder:text-zinc-400/60"
                      />
                    </div>
                  </div>
                )}

                {/* Input: E-MAIL */}
                {currentField.tipo === 'email' && (
                  <div className="pt-2 pl-6">
                    <input
                      ref={inputRef}
                      type="email"
                      value={currentAnswer || ''}
                      onChange={(e) => handleSetAnswer(e.target.value)}
                      placeholder={currentField.placeholder || 'nome@exemplo.com'}
                      className="w-full text-xl sm:text-2xl font-medium bg-transparent border-b-2 border-zinc-300/80 focus:border-emerald-500 focus:outline-none pb-2 transition-colors placeholder:text-zinc-400/60"
                    />
                  </div>
                )}

                {/* Input: MÚLTIPLA ESCOLHA */}
                {currentField.tipo === 'choice' && currentField.opcoes && (
                  <div className="pt-2 pl-6 grid gap-2.5 w-full">
                    {currentField.opcoes.map((opt, i) => {
                      const isSelected = currentAnswer === opt.id || currentAnswer === opt.label;
                      const letra = LETRAS_OPCOES[i] || `${i + 1}`;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            handleSetAnswer(opt.id);
                            if (!currentField.multipla_escolha) {
                              setTimeout(() => handleNext(), 200);
                            }
                          }}
                          className={`w-full p-4 rounded-2xl border-2 text-left font-medium text-base sm:text-lg flex items-center justify-between cursor-pointer transition-all active:scale-99 ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-zinc-200/80 text-zinc-700'
                              }`}
                            >
                              {letra}
                            </span>
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-emerald-500 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Input: NPS (0 a 10) */}
                {currentField.tipo === 'nps' && (
                  <div className="pt-2 pl-6 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 11 }).map((_, n) => {
                        const isSelected = currentAnswer === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              handleSetAnswer(n);
                              setTimeout(() => handleNext(), 200);
                            }}
                            className={`w-11 h-12 rounded-xl border-2 font-bold text-base flex items-center justify-center cursor-pointer transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                                : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-100'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs opacity-50 px-1">
                      <span>0 - Pouco provável</span>
                      <span>10 - Muito provável</span>
                    </div>
                  </div>
                )}

                {/* Input: AVALIAÇÃO / RATING (1 a 5 estrelas) */}
                {currentField.tipo === 'rating' && (
                  <div className="pt-2 pl-6 flex items-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (currentAnswer || 0) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            handleSetAnswer(star);
                            setTimeout(() => handleNext(), 200);
                          }}
                          className="p-2 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                        >
                          <Star
                            className={`w-10 h-10 transition-colors ${
                              isFilled ? 'text-amber-400 fill-amber-400' : 'text-zinc-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Input: UPLOAD DE ARQUIVO (Cloudflare R2) */}
                {currentField.tipo === 'file' && (
                  <div className="pt-2 pl-6">
                    <label className="border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-zinc-50/50 hover:bg-zinc-50">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      {uploadingFile ? (
                        <div className="flex items-center gap-3 text-emerald-600 font-semibold animate-pulse">
                          <UploadCloud className="w-8 h-8 animate-bounce" />
                          <span>Enviando arquivo com segurança...</span>
                        </div>
                      ) : currentAnswer?.url ? (
                        <div className="flex items-center gap-3 text-emerald-600 font-semibold">
                          <FileCheck className="w-8 h-8" />
                          <span>Arquivo anexado: {currentAnswer.nome}</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 rounded-2xl bg-zinc-200/80 text-zinc-600">
                            <UploadCloud className="w-8 h-8" />
                          </div>
                          <span className="font-semibold text-base">Clique ou arraste um arquivo aqui</span>
                          <span className="text-xs opacity-50">Fotos, vídeos ou documentos</span>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* Input: TERMOS / LGPD */}
                {currentField.tipo === 'terms' && (
                  <div className="pt-2 pl-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentAnswer === true}
                        onChange={(e) => handleSetAnswer(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 cursor-pointer"
                      />
                      <span className="text-base font-normal leading-relaxed opacity-80">
                        {currentField.placeholder || 'Concordo com os termos e autorizo o contato via WhatsApp.'}
                      </span>
                    </label>
                  </div>
                )}

                {/* Mensagem de Erro / Alerta */}
                {errorMsg && (
                  <div className="pl-6 flex items-center gap-2 text-rose-500 text-sm font-medium animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Botão de Avançar com atalho de teclado */}
                <div className="pl-6 pt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={submitting}
                    style={{ backgroundColor: tema.cor_primaria || '#10b981', color: '#ffffff' }}
                    className="px-6 py-3 rounded-xl font-bold text-base shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{currentIndex === fields.length - 2 ? 'Concluir' : 'OK'}</span>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                  <span className="hidden sm:inline-block text-xs opacity-40 font-medium">
                    pressione <strong className="underline">Enter ↵</strong>
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Rodapé: Navegação Inferior & Branding */}
      <footer className="px-6 py-4 max-w-3xl w-full mx-auto flex items-center justify-between z-10 border-t border-zinc-200/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold opacity-40">Feito com</span>
          <span className="text-xs font-bold tracking-tight text-emerald-600">GENSBot</span>
        </div>

        {/* Botões Chevron de navegação */}
        <div className="flex items-center gap-1.5 bg-zinc-200/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={handleBack}
            disabled={history.length <= 1}
            title="Pergunta anterior (Shift + Enter ou ↑)"
            className="p-1.5 rounded-lg hover:bg-white text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= fields.length - 1}
            title="Próxima pergunta (Enter ou ↓)"
            className="p-1.5 rounded-lg hover:bg-white text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
