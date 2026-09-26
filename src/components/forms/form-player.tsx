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
} from 'lucide-react';
import type { Form, FormField } from '@/types/form';
import {
  validateFieldAnswer,
  formatWhatsAppMask,
  getNextFieldIndex,
  calculateProgress,
  isColorDark,
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
            }, 220);
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
    cor_primaria: '#d8ff3c',
    cor_fundo: '#09090b',
    cor_texto: '#f4f4f5',
    cor_card: '#141417',
    modo: 'dark',
  };

  const isDark = useMemo(() => {
    if (tema.modo === 'dark') return true;
    if (tema.modo === 'light') return false;
    return isColorDark(tema.cor_fundo);
  }, [tema.modo, tema.cor_fundo]);

  // Contraste do texto do botão primário (se o botão for lima, o texto é escuro; se for escuro, é claro)
  const primaryBtnTextColor = useMemo(() => {
    const primary = tema.cor_primaria || (isDark ? '#d8ff3c' : '#192313');
    return isColorDark(primary) ? '#ffffff' : '#12180d';
  }, [tema.cor_primaria, isDark]);

  const variants: any = {
    enter: (dir: 'forward' | 'backward') => ({
      y: dir === 'forward' ? 24 : -24,
      opacity: 0,
      scale: 0.99,
    }),
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    },
    exit: (dir: 'forward' | 'backward') => ({
      y: dir === 'forward' ? -20 : 20,
      opacity: 0,
      scale: 0.99,
      transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  if (!currentField) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-muted-foreground font-medium text-sm">Este formulário não possui etapas ativas.</p>
      </div>
    );
  }

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className={`min-h-screen flex flex-col justify-between select-none relative font-sans transition-colors duration-200 overflow-x-hidden ${
        isDark ? 'dark bg-background text-foreground' : 'bg-background text-foreground'
      }`}
      style={{
        backgroundColor: tema.cor_fundo || (isDark ? '#09090b' : '#f7f8f2'),
        color: tema.cor_texto || (isDark ? '#f4f4f5' : '#192313'),
        colorScheme: isDark ? 'dark' : 'light',
      }}
    >
      {/* Barra de Progresso Superior Minimalista (sem neon, hairline de 2px) */}
      <div className={`fixed top-0 left-0 right-0 h-1 z-50 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
        <motion.div
          className="h-full"
          style={{ backgroundColor: tema.cor_primaria || (isDark ? '#d8ff3c' : '#192313') }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Topo Flutuante: Logo & Contador Minimalista */}
      <header className="px-6 sm:px-12 py-5 max-w-4xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {tema.logo_url ? (
            <img src={tema.logo_url} alt="Logo" className="h-8 max-w-[150px] object-contain" />
          ) : form.cliente_nome ? (
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide uppercase ${
              isDark ? 'bg-card border-border text-foreground' : 'bg-card border-border text-foreground'
            }`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tema.cor_primaria || (isDark ? '#d8ff3c' : '#192313') }} />
              <span>{form.cliente_nome}</span>
            </div>
          ) : null}
        </div>

        {currentField.tipo !== 'welcome' && currentField.tipo !== 'thank_you' && (
          <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-mono font-medium ${
            isDark ? 'bg-card border-border text-muted-foreground' : 'bg-card border-border text-muted-foreground'
          }`}>
            <span className="text-foreground font-bold">{currentIndex}</span>
            <span className="opacity-40">/</span>
            <span>{fields.length - 2 > 0 ? fields.length - 2 : fields.length}</span>
          </div>
        )}
      </header>

      {/* Área Central: A Pergunta em Foco Absoluto */}
      <main className="flex-1 flex items-center justify-center px-6 sm:px-12 py-8 max-w-2xl w-full mx-auto">
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
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold font-mono tracking-wide ${
                  isDark ? 'bg-secondary text-brand-text border-brand-ring' : 'bg-secondary text-brand-text border-brand-ring'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Formulário de Atendimento</span>
                </div>

                <div className="space-y-2.5">
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
                    {currentField.label}
                  </h1>
                  {currentField.descricao && (
                    <p className="text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-xl">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <Clock className="w-4 h-4" />
                  <span>Duração estimada: 1 a 2 minutos</span>
                </div>

                {/* Botão de Ação Primária no Padrão GENS */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      backgroundColor: tema.cor_primaria || (isDark ? '#d8ff3c' : '#192313'),
                      color: primaryBtnTextColor,
                    }}
                    className="px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base shadow-xs hover:opacity-90 active:scale-[0.985] transition-ui flex items-center gap-2.5 cursor-pointer"
                  >
                    <span>Começar</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <span>pressione</span>
                    <kbd className={`px-2 py-0.5 rounded-md border text-xs font-mono font-medium ${
                      isDark ? 'bg-muted border-border text-muted-foreground' : 'bg-muted border-border text-muted-foreground'
                    }`}>
                      Enter ↵
                    </kbd>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TELA DE AGRADECIMENTO */}
            {currentField.tipo === 'thank_you' && (
              <div className="space-y-6 w-full py-4 text-center sm:text-left">
                {/* Ícone de Sucesso Sóbrio & Refinado */}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  isDark ? 'bg-success-soft text-success border-success-ring' : 'bg-success-soft text-success border-success-ring'
                }`}>
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </div>

                <div className="space-y-2.5">
                  <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                    {currentField.label}
                  </h1>
                  {currentField.descricao && (
                    <p className="text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-xl">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                {/* Botão de WhatsApp Oficial (DESIGN.md: #25D366 com texto #052e16) */}
                {form.notificacao_whatsapp_numero && (
                  <div className="pt-2">
                    <a
                      href={`https://wa.me/55${form.notificacao_whatsapp_numero.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Acabei de enviar minhas respostas no formulário "${form.titulo}".`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#25D366] text-[#052e16] font-bold text-sm sm:text-base shadow-xs hover:brightness-105 active:scale-[0.985] transition-ui cursor-pointer"
                    >
                      <MessageCircle className="w-5 h-5 fill-current" />
                      <span>Falar no WhatsApp com nossa equipe</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 3. PERGUNTAS INTERATIVAS */}
            {currentField.tipo !== 'welcome' && currentField.tipo !== 'thank_you' && (
              <div className="space-y-6 w-full">
                {/* Cabeçalho da Pergunta com Micro-Eyebrow */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono font-bold uppercase tracking-wider"
                      style={{ color: tema.cor_primaria || (isDark ? '#d8ff3c' : '#192313') }}
                    >
                      {String(currentIndex).padStart(2, '0')} →
                    </span>
                    {currentField.obrigatorio && (
                      <span className={`text-xs font-medium px-2 py-0.2 rounded-full border ${
                        isDark ? 'bg-destructive-soft text-destructive border-destructive-ring' : 'bg-destructive-soft text-destructive border-destructive-ring'
                      }`}>
                        Obrigatório
                      </span>
                    )}
                  </div>

                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug">
                    {currentField.label}
                  </h2>

                  {currentField.descricao && (
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                      {currentField.descricao}
                    </p>
                  )}
                </div>

                {/* Input: TEXTO CURTO */}
                {currentField.tipo === 'text' && (
                  <div className="pt-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentAnswer || ''}
                      onChange={(e) => handleSetAnswer(e.target.value)}
                      placeholder={currentField.placeholder || 'Digite sua resposta...'}
                      className={`w-full text-xl sm:text-2xl font-display font-medium bg-transparent border-b-2 pb-3 transition-colors focus:outline-none placeholder:text-muted-foreground/40 ${
                        isDark ? 'border-border focus:border-primary text-foreground' : 'border-border focus:border-primary text-foreground'
                      }`}
                    />
                  </div>
                )}

                {/* Input: TEXTAREA */}
                {currentField.tipo === 'textarea' && (
                  <div className="pt-2 space-y-2">
                    <textarea
                      ref={inputRef}
                      rows={4}
                      value={currentAnswer || ''}
                      onChange={(e) => handleSetAnswer(e.target.value)}
                      placeholder={currentField.placeholder || 'Descreva em detalhes aqui...'}
                      className={`w-full text-base font-sans rounded-xl p-3.5 border transition-ui resize-none focus:outline-none focus:ring-2 focus:ring-ring/25 ${
                        isDark
                          ? 'bg-card border-input text-foreground placeholder:text-muted-foreground'
                          : 'bg-card border-input text-foreground placeholder:text-muted-foreground'
                      }`}
                    />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span>Dica: Use</span>
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground text-xs">
                        Shift + Enter
                      </kbd>
                      <span>para pular linha</span>
                    </div>
                  </div>
                )}

                {/* Input: WHATSAPP COM MÁSCARA & FLAG */}
                {currentField.tipo === 'whatsapp' && (
                  <div className="pt-2">
                    <div className={`flex items-center gap-3 border-b-2 pb-3 transition-colors ${
                      isDark ? 'border-border focus-within:border-primary' : 'border-border focus-within:border-primary'
                    }`}>
                      <span className="text-base sm:text-lg font-bold text-muted-foreground flex items-center gap-1.5">
                        <span>🇧🇷</span> +55
                      </span>
                      <input
                        ref={inputRef}
                        type="tel"
                        value={currentAnswer || ''}
                        onChange={(e) => handleSetAnswer(formatWhatsAppMask(e.target.value))}
                        placeholder={currentField.placeholder || '(11) 99999-9999'}
                        className="w-full text-xl sm:text-2xl font-display font-medium bg-transparent focus:outline-none tracking-wide text-foreground placeholder:text-muted-foreground/40"
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
                      className={`w-full text-xl sm:text-2xl font-display font-medium bg-transparent border-b-2 pb-3 transition-colors focus:outline-none placeholder:text-muted-foreground/40 ${
                        isDark ? 'border-border focus:border-primary text-foreground' : 'border-border focus:border-primary text-foreground'
                      }`}
                    />
                  </div>
                )}

                {/* Input: MÚLTIPLA ESCOLHA (Cards Estilo Linear) */}
                {currentField.tipo === 'choice' && currentField.opcoes && (
                  <div className="pt-2 grid gap-2.5 w-full">
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
                          className={`w-full p-3.5 rounded-xl border text-left font-medium text-sm sm:text-base flex items-center justify-between cursor-pointer transition-ui active:scale-[0.985] ${
                            isSelected || isPulsing
                              ? 'border-primary bg-secondary/40 shadow-xs'
                              : 'border-border bg-card hover:border-border-strong hover:bg-accent text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-colors ${
                                isSelected || isPulsing
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted border border-border text-muted-foreground'
                              }`}
                            >
                              {letra}
                            </span>
                            <span className="font-medium text-foreground">{opt.label}</span>
                          </div>

                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Input: NPS (0 a 10) */}
                {currentField.tipo === 'nps' && (
                  <div className="pt-2 space-y-2.5 w-full">
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
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
                            className={`h-11 rounded-lg border font-mono font-bold text-sm flex items-center justify-center cursor-pointer transition-ui active:scale-95 ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                : 'border-border hover:border-border-strong hover:bg-accent bg-card text-foreground'
                            }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground px-1 font-medium">
                      <span>0 - Pouco provável</span>
                      <span>10 - Altamente provável</span>
                    </div>
                  </div>
                )}

                {/* Input: AVALIAÇÃO COM ESTRELAS */}
                {currentField.tipo === 'rating' && (
                  <div className="pt-2 flex items-center gap-2">
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
                          className="p-1.5 cursor-pointer hover:scale-110 active:scale-90 transition-transform"
                        >
                          <Star
                            className={`w-9 h-9 transition-colors ${
                              isFilled
                                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]'
                                : 'text-muted-foreground/30 fill-transparent'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Input: UPLOAD DE ARQUIVO */}
                {currentField.tipo === 'file' && (
                  <div className="pt-2">
                    <label className="border-2 border-dashed border-border hover:border-border-strong rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-ui bg-card hover:bg-accent group">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      {uploadingFile ? (
                        <div className="flex items-center gap-2 text-primary font-semibold animate-pulse text-sm">
                          <UploadCloud className="w-6 h-6 animate-bounce" />
                          <span>Enviando para o servidor seguro...</span>
                        </div>
                      ) : currentAnswer?.url ? (
                        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                          <FileCheck2 className="w-6 h-6" />
                          <span>Arquivo anexado: {currentAnswer.nome}</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 rounded-xl bg-muted text-foreground group-hover:scale-105 transition-transform">
                            <UploadCloud className="w-6 h-6" />
                          </div>
                          <span className="font-semibold text-sm text-foreground">Clique ou arraste um arquivo aqui</span>
                          <span className="text-xs text-muted-foreground">Fotos, vídeos ou documentos sem limite de tamanho</span>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* Input: TERMOS / LGPD */}
                {currentField.tipo === 'terms' && (
                  <div className="pt-2">
                    <label className="p-3.5 rounded-xl border border-border bg-card hover:border-border-strong flex items-start gap-3 cursor-pointer transition-ui">
                      <input
                        type="checkbox"
                        checked={currentAnswer === true}
                        onChange={(e) => handleSetAnswer(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                      />
                      <span className="text-xs sm:text-sm font-normal text-foreground leading-relaxed">
                        {currentField.placeholder || 'Concordo com os termos de privacidade e autorizo o contato via WhatsApp.'}
                      </span>
                    </label>
                  </div>
                )}

                {/* Alerta de Validação */}
                {errorMsg && (
                  <div className="flex items-center gap-2 text-destructive text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Botão de Avanço / OK */}
                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={submitting}
                    style={{
                      backgroundColor: tema.cor_primaria || (isDark ? '#d8ff3c' : '#192313'),
                      color: primaryBtnTextColor,
                    }}
                    className="px-6 py-2.5 rounded-xl font-bold text-sm shadow-xs hover:opacity-90 active:scale-[0.985] transition-ui flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{currentIndex === fields.length - 2 ? 'Enviar Respostas' : 'OK'}</span>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <span>pressione</span>
                    <kbd className="px-2 py-0.5 rounded-md border border-border bg-muted text-muted-foreground text-xs font-mono font-medium">
                      Enter ↵
                    </kbd>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Rodapé Flutuante: Navegação & Dock Minimalista */}
      <footer className="px-6 sm:px-12 py-4 max-w-4xl w-full mx-auto flex items-center justify-between z-10 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="text-caption text-muted-foreground uppercase tracking-widest font-mono">Tecnologia</span>
          <span className="text-xs font-bold font-display text-foreground tracking-tight">GENSBot</span>
        </div>

        {/* Botões Chevron Tipo Dock */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-card shadow-2xs">
          <button
            type="button"
            onClick={handleBack}
            disabled={history.length <= 1}
            title="Pergunta anterior (Shift + Enter ou ↑)"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="w-px h-3.5 bg-border" />
          <button
            type="button"
            onClick={handleNext}
            disabled={currentIndex >= fields.length - 1}
            title="Próxima pergunta (Enter ou ↓)"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
