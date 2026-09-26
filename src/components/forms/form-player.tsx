'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  Star,
  MessageCircle,
  AlertCircle,
  Clock,
  Sparkles,
  CornerDownLeft,
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
  const [selectedPulseId, setSelectedPulseId] = useState<string | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const inputRef = useRef<any>(null);

  const currentField: FormField | undefined = fields[currentIndex];
  const progressPct = calculateProgress(currentIndex, fields.length);

  // Foco automático e scroll suave ao trocar pergunta
  useEffect(() => {
    setErrorMsg(null);
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus?.();
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const currentAnswer = currentField ? answers[currentField.id] : undefined;

  function handleSetAnswer(value: any) {
    if (!currentField) return;
    setErrorMsg(null);
    setAnswers((prev) => ({
      ...prev,
      [currentField.id]: value,
    }));
  }

  function handleNext() {
    if (!currentField) return;

    if (currentField.tipo === 'thank_you') {
      if (isPreview && onFinishPreview) {
        onFinishPreview();
      }
      return;
    }

    const validation = validateFieldAnswer(currentField, currentAnswer);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Por favor, preencha este campo.');
      return;
    }

    const nextIdx = getNextFieldIndex(currentIndex, fields, answers);

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

  function handleBack() {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const prevIdx = newHistory[newHistory.length - 1];

    setDirection('backward');
    setHistory(newHistory);
    setCurrentIndex(prevIdx);
    setErrorMsg(null);
  }

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

  // Teclado global
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isTextarea = (e.target as HTMLElement)?.tagName === 'TEXTAREA';

      if (e.key === 'Enter') {
        if (isTextarea && !e.shiftKey) return;
        e.preventDefault();
        handleNext();
        return;
      }

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
          setSelectedPulseId(option.id);
          handleSetAnswer(option.id);
          if (!currentField.multipla_escolha) {
            setTimeout(() => {
              handleNext();
              setSelectedPulseId(null);
            }, 240);
          }
        }
      }

      if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey && !isTextarea)) {
        e.preventDefault();
        handleBack();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentField, currentAnswer, answers, history]);

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
      y: dir === 'forward' ? 32 : -32,
      opacity: 0,
      scale: 0.985,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.28, ease: 'easeOut' },
    },
    exit: (dir: 'forward' | 'backward') => ({
      y: dir === 'forward' ? -28 : 28,
      opacity: 0,
      scale: 0.985,
      transition: { duration: 0.18, ease: 'easeIn' },
    }),
  };

  if (!currentField) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-zinc-400 font-medium text-sm">Este formulário não possui etapas ativas.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-between select-none relative font-sans transition-colors duration-500 overflow-x-hidden"
      style={{
        backgroundColor: tema.cor_fundo || '#ffffff',
        color: tema.cor_texto || '#09090b',
      }}
    >
      {/* Barra de Progresso Superior com Gradiente Suave */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-200/50 dark:bg-zinc-800/40 z-50 overflow-hidden">
        <motion.div
          className="h-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ backgroundColor: tema.cor_primaria || '#10b981' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>

      {/* Topo Flutuante: Logo & Contador Minimalista */}
      <header className="px-6 sm:px-12 py-6 max-w-4xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {tema.logo_url ? (
            <img src={tema.logo_url} alt="Logo" className="h-9 max-w-[160px] object-contain" />
          ) : form.cliente_nome ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tema.cor_primaria || '#10b981' }} />
              <span className="text-xs font-semibold tracking-wide uppercase opacity-80">
                {form.cliente_nome}
              </span>
            </div>
          ) : null}
        </div>

        {currentField.tipo !== 'welcome' && currentField.tipo !== 'thank_you' && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/50 text-xs font-mono font-medium opacity-70">
            <span>{currentIndex}</span>
            <span className="opacity-40">/</span>
            <span>{fields.length - 2 > 0 ? fields.length - 2 : fields.length}</span>
          </div>
        )}
      </header>

      {/* Área Central: A Pergunta em Foco Absoluto */}
      <main className="flex-1 flex items-center justify-center px-6 sm:px-12 py-10 max-w-2xl w-full mx-auto">
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
              <div className="space-y-8 w-full py-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Formulário Exclusivo</span>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-[1.12]">
                    {currentField.label}
                  </h1>
                  {currentField.descricao && (
                    <p className="text-lg sm:text-xl opacity-75 font-normal leading-relaxed max-w-xl">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs opacity-50 font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Leva aproximadamente 1 a 2 minutos</span>
                </div>

                {/* Botão Estilo Button-in-Button */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    style={{ backgroundColor: tema.cor_primaria || '#10b981', color: '#ffffff' }}
                    className="group px-7 py-4 rounded-full font-bold text-base sm:text-lg shadow-lg hover:shadow-xl hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-3.5 cursor-pointer"
                  >
                    <span>Começar Agora</span>
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-50 font-mono">
                    <span>pressione</span>
                    <kbd className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 font-bold shadow-2xs">
                      Enter ↵
                    </kbd>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TELA DE AGRADECIMENTO */}
            {currentField.tipo === 'thank_you' && (
              <div className="space-y-8 w-full py-4 text-center sm:text-left">
                {/* Aura de Sucesso */}
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 250 }}
                  className="inline-flex p-4 rounded-3xl bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 shadow-inner"
                >
                  <Check className="w-10 h-10 stroke-[2.75]" />
                </motion.div>

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-tight">
                    {currentField.label}
                  </h1>
                  {currentField.descricao && (
                    <p className="text-lg sm:text-xl opacity-75 font-normal leading-relaxed max-w-xl">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                {form.notificacao_whatsapp_numero && (
                  <div className="pt-2">
                    <a
                      href={`https://wa.me/55${form.notificacao_whatsapp_numero.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Acabei de enviar minhas respostas no formulário "${form.titulo}".`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-3.5 px-8 py-4 rounded-full bg-[#25D366] text-white font-bold text-base sm:text-lg shadow-lg hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-6 h-6 fill-white" />
                      <span>Falar no WhatsApp com nossa equipe</span>
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 3. PERGUNTAS INTERATIVAS */}
            {currentField.tipo !== 'welcome' && currentField.tipo !== 'thank_you' && (
              <div className="space-y-7 w-full">
                {/* Cabeçalho da Pergunta com Micro-Eyebrow */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono font-bold tracking-wider uppercase opacity-50"
                      style={{ color: tema.cor_primaria || '#10b981' }}
                    >
                      {String(currentIndex).padStart(2, '0')} →
                    </span>
                    {currentField.obrigatorio && (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        Obrigatório
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-[-0.025em] leading-[1.2]">
                    {currentField.label}
                  </h2>

                  {currentField.descricao && (
                    <p className="text-sm sm:text-base opacity-65 leading-relaxed max-w-xl">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                {/* Input: TEXTO CURTO */}
                {currentField.tipo === 'text' && (
                  <div className="pt-2">
                    <div className="relative group">
                      <input
                        ref={inputRef}
                        type="text"
                        value={currentAnswer || ''}
                        onChange={(e) => handleSetAnswer(e.target.value)}
                        placeholder={currentField.placeholder || 'Digite sua resposta...'}
                        className="w-full text-xl sm:text-2xl font-medium bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700/80 focus:border-emerald-500 focus:outline-none pb-3 transition-colors placeholder:text-zinc-400/50"
                      />
                    </div>
                  </div>
                )}

                {/* Input: TEXTAREA */}
                {currentField.tipo === 'textarea' && (
                  <div className="pt-2 space-y-2">
                    <div className="p-1 rounded-3xl bg-black/5 dark:bg-white/5 border border-zinc-200/80 dark:border-zinc-700/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
                      <textarea
                        ref={inputRef}
                        rows={4}
                        value={currentAnswer || ''}
                        onChange={(e) => handleSetAnswer(e.target.value)}
                        placeholder={currentField.placeholder || 'Descreva em detalhes aqui...'}
                        className="w-full text-base sm:text-lg font-medium bg-white dark:bg-zinc-900 rounded-[calc(1.5rem-4px)] p-4 focus:outline-none placeholder:text-zinc-400/50 resize-none transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-2xs opacity-40 font-mono">
                      <span>Dica: Use</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border">Shift + Enter</kbd>
                      <span>para pular linha</span>
                    </div>
                  </div>
                )}

                {/* Input: WHATSAPP COM MÁSCARA & FLAG */}
                {currentField.tipo === 'whatsapp' && (
                  <div className="pt-2">
                    <div className="flex items-center gap-3 border-b-2 border-zinc-200 dark:border-zinc-700/80 focus-within:border-emerald-500 pb-3 transition-colors">
                      <span className="text-base sm:text-lg font-bold opacity-70 flex items-center gap-1.5">
                        <span className="text-xl">🇧🇷</span> +55
                      </span>
                      <input
                        ref={inputRef}
                        type="tel"
                        value={currentAnswer || ''}
                        onChange={(e) => handleSetAnswer(formatWhatsAppMask(e.target.value))}
                        placeholder={currentField.placeholder || '(11) 99999-9999'}
                        className="w-full text-xl sm:text-2xl font-medium bg-transparent focus:outline-none placeholder:text-zinc-400/50 tracking-wide"
                      />
                    </div>
                  </div>
                )}

                {/* Input: E-MAIL */}
                {currentField.tipo === 'email' && (
                  <div className="pt-2">
                    <input
                      ref={inputRef}
                      type="email"
                      value={currentAnswer || ''}
                      onChange={(e) => handleSetAnswer(e.target.value)}
                      placeholder={currentField.placeholder || 'seuemail@exemplo.com'}
                      className="w-full text-xl sm:text-2xl font-medium bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700/80 focus:border-emerald-500 focus:outline-none pb-3 transition-colors placeholder:text-zinc-400/50"
                    />
                  </div>
                )}

                {/* Input: MÚLTIPLA ESCOLHA (CARDS COM KEYCAPS) */}
                {currentField.tipo === 'choice' && currentField.opcoes && (
                  <div className="pt-2 grid gap-3 w-full">
                    {currentField.opcoes.map((opt, i) => {
                      const isSelected = currentAnswer === opt.id || currentAnswer === opt.label;
                      const isPulsing = selectedPulseId === opt.id;
                      const letra = LETRAS_OPCOES[i] || `${i + 1}`;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedPulseId(opt.id);
                            handleSetAnswer(opt.id);
                            if (!currentField.multipla_escolha) {
                              setTimeout(() => {
                                handleNext();
                                setSelectedPulseId(null);
                              }, 220);
                            }
                          }}
                          className={`w-full p-4 rounded-2xl border-2 text-left font-medium text-base sm:text-lg flex items-center justify-between cursor-pointer transition-all active:scale-[0.985] ${
                            isSelected || isPulsing
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                              : 'border-zinc-200/90 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/80'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Keycap Badge */}
                            <span
                              className={`w-8 h-8 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all ${
                                isSelected || isPulsing
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 shadow-[0_2px_0_rgba(0,0,0,0.06)]'
                              }`}
                            >
                              {letra}
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{opt.label}</span>
                          </div>

                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Input: NPS (0 a 10) */}
                {currentField.tipo === 'nps' && (
                  <div className="pt-2 space-y-3 w-full">
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                      {Array.from({ length: 11 }).map((_, n) => {
                        const isSelected = currentAnswer === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              handleSetAnswer(n);
                              setTimeout(() => handleNext(), 220);
                            }}
                            className={`h-13 rounded-xl border-2 font-mono font-bold text-base flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500 text-white shadow-md scale-105'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-white/60 dark:bg-zinc-900/60'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs opacity-50 px-1 font-medium">
                      <span>0 - Pouco provável</span>
                      <span>10 - Altamente provável</span>
                    </div>
                  </div>
                )}

                {/* Input: AVALIAÇÃO COM ESTRELAS */}
                {currentField.tipo === 'rating' && (
                  <div className="pt-2 flex items-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (currentAnswer || 0) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            handleSetAnswer(star);
                            setTimeout(() => handleNext(), 220);
                          }}
                          className="p-2 cursor-pointer hover:scale-115 active:scale-90 transition-transform"
                        >
                          <Star
                            className={`w-11 h-11 transition-all ${
                              isFilled
                                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]'
                                : 'text-zinc-300 dark:text-zinc-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Input: UPLOAD DE ARQUIVO (Cloudflare R2) */}
                {currentField.tipo === 'file' && (
                  <div className="pt-2">
                    <label className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-zinc-50/60 dark:bg-zinc-900/50 hover:bg-zinc-50 group">
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
                          <span>Enviando para Cloudflare R2...</span>
                        </div>
                      ) : currentAnswer?.url ? (
                        <div className="flex items-center gap-3 text-emerald-600 font-semibold">
                          <FileCheck2 className="w-8 h-8" />
                          <span>Arquivo anexado: {currentAnswer.nome}</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3.5 rounded-2xl bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:scale-110 transition-transform">
                            <UploadCloud className="w-8 h-8" />
                          </div>
                          <span className="font-semibold text-base">Clique ou arraste um arquivo aqui</span>
                          <span className="text-xs opacity-50">Fotos, vídeos ou documentos sem limite de tamanho</span>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* Input: TERMOS / LGPD */}
                {currentField.tipo === 'terms' && (
                  <div className="pt-2">
                    <label className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 flex items-start gap-3.5 cursor-pointer hover:border-zinc-300 transition-all">
                      <input
                        type="checkbox"
                        checked={currentAnswer === true}
                        onChange={(e) => handleSetAnswer(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 cursor-pointer"
                      />
                      <span className="text-sm sm:text-base font-normal leading-relaxed opacity-85">
                        {currentField.placeholder || 'Concordo com os termos de privacidade e autorizo o contato via WhatsApp.'}
                      </span>
                    </label>
                  </div>
                )}

                {/* Alerta de Validação */}
                {errorMsg && (
                  <div className="flex items-center gap-2 text-rose-500 text-sm font-semibold animate-bounce">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Botão de Avanço com Haptic Feel */}
                <div className="pt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={submitting}
                    style={{ backgroundColor: tema.cor_primaria || '#10b981', color: '#ffffff' }}
                    className="px-7 py-3.5 rounded-2xl font-bold text-base shadow-md hover:shadow-lg hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{currentIndex === fields.length - 2 ? 'Enviar Respostas' : 'OK'}</span>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs opacity-50 font-mono">
                    <span>pressione</span>
                    <kbd className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold shadow-2xs">
                      Enter ↵
                    </kbd>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Rodapé Flutuante: Navegação & Dock */}
      <footer className="px-6 sm:px-12 py-5 max-w-4xl w-full mx-auto flex items-center justify-between z-10 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-semibold opacity-40 uppercase tracking-widest">Tecnologia</span>
          <span className="text-xs font-bold tracking-tight text-emerald-600">GENSBot</span>
        </div>

        {/* Botões Chevron Tipo Dock */}
        <div className="flex items-center gap-1 bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/60 dark:border-zinc-700/60 p-1 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={handleBack}
            disabled={history.length <= 1}
            title="Pergunta anterior (Shift + Enter ou ↑)"
            className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= fields.length - 1}
            title="Próxima pergunta (Enter ou ↓)"
            className="p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
