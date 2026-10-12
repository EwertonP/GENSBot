'use client';

import React, { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Bot, Sparkles, Key, Check, ShieldCheck, X } from 'lucide-react';
import type { CrmPipeline, CrmEstagio } from '@/types/crm';
import type { AIAgentConfig, AIProvider } from '@/types/ai';

interface CrmAiConfigModalProps {
  open: boolean;
  onClose: () => void;
  clienteId?: string | null;
  pipelines: CrmPipeline[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

const MODELOS_POR_PROVEDOR: Record<AIProvider, { id: string; nome: string; desc: string }[]> = {
  openai: [
    { id: 'gpt-4o-mini', nome: 'GPT-4o Mini (Recomendado)', desc: 'Rápido, econômico e excelente em tool-calling' },
    { id: 'gpt-4o', nome: 'GPT-4o (Completo)', desc: 'Maior raciocínio e persuasão comercial' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', nome: 'Gemini 1.5 Flash (Ultra Rápido)', desc: 'Latência mínima para respostas em tempo real' },
    { id: 'gemini-1.5-pro', nome: 'Gemini 1.5 Pro', desc: 'Contexto gigante e raciocínio profundo' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-20241022', nome: 'Claude 3.5 Haiku', desc: 'Rápido, tom humano impecável e econômico' },
    { id: 'claude-3-5-sonnet-20241022', nome: 'Claude 3.5 Sonnet', desc: 'O melhor modelo para persuasão e nuances' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', nome: 'Llama 3.3 70B (Groq)', desc: 'Velocidade instantânea de tokens' },
  ],
};

export default function CrmAiConfigModal({
  open,
  onClose,
  clienteId,
  pipelines,
  showToast,
}: CrmAiConfigModalProps) {
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Form states
  const [ativo, setAtivo] = useState(false);
  const [provedor, setProvedor] = useState<AIProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [modelo, setModelo] = useState('gpt-4o-mini');
  const [nomeAgente, setNomeAgente] = useState('Assistente Comercial');
  const [promptSistema, setPromptSistema] = useState(
    'Você é o assistente comercial oficial. Converse com simpatia e agilidade. Descubra o nome, WhatsApp com DDD e a necessidade do cliente para apresentar soluções e direcionar para o agendamento.'
  );

  // Pipeline mapeamento
  const [pipelineId, setPipelineId] = useState<string>('');
  const [estagioInicialId, setEstagioInicialId] = useState<string>('');
  const [estagioQualificadoId, setEstagioQualificadoId] = useState<string>('');
  const [estagioPropostaId, setEstagioPropostaId] = useState<string>('');
  const [estagioAgendadoId, setEstagioAgendadoId] = useState<string>('');

  const pipelineSelecionado = pipelines.find((p) => p.id === pipelineId) || pipelines[0];
  const estagios = pipelineSelecionado?.estagios || [];

  useEffect(() => {
    if (!open) return;
    async function carregarConfig() {
      setCarregando(true);
      try {
        const url = clienteId
          ? `/api/crm/ai/config?cliente_id=${encodeURIComponent(clienteId)}`
          : '/api/crm/ai/config';
        const res = await fetch(url);
        if (res.ok) {
          const data: AIAgentConfig | null = await res.json();
          if (data) {
            setAtivo(Boolean(data.ativo));
            setProvedor(data.provedor || 'openai');
            setModelo(data.modelo || 'gpt-4o-mini');
            setNomeAgente(data.nome_agente || 'Assistente Comercial');
            setPromptSistema(data.prompt_sistema || '');
            setPipelineId(data.pipeline_id || (pipelines[0]?.id || ''));
            setEstagioInicialId(data.estagio_inicial_id || '');
            setEstagioQualificadoId(data.estagio_qualificado_id || '');
            setEstagioPropostaId(data.estagio_proposta_id || '');
            setEstagioAgendadoId(data.estagio_agendado_id || '');
            // Se já tem apiKey no banco, mantém vazio no form para segurança
            setApiKey('');
          } else {
            setPipelineId(pipelines[0]?.id || '');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar config de IA:', err);
      } finally {
        setCarregando(false);
      }
    }
    carregarConfig();
  }, [open, clienteId, pipelines]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch('/api/crm/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId || null,
          ativo,
          provedor,
          api_key: apiKey.trim() || undefined,
          modelo,
          nome_agente: nomeAgente.trim(),
          prompt_sistema: promptSistema.trim(),
          pipeline_id: pipelineId || null,
          estagio_inicial_id: estagioInicialId || null,
          estagio_qualificado_id: estagioQualificadoId || null,
          estagio_proposta_id: estagioPropostaId || null,
          estagio_agendado_id: estagioAgendadoId || null,
          responder_direct_geral: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar configuração de IA');
      }

      showToast('Configuração de IA atualizada com sucesso!', 'success');
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Falha ao salvar IA', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogShell open={open} onRequestClose={onClose} aria-label="Configurar Agente de IA Multi-LLM" className="max-w-2xl w-full">
      <form onSubmit={handleSalvar} className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <span>Agente de IA SDR & Qualificador</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Multi-LLM
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Conecte OpenAI, Gemini ou Claude para responder leads no Instagram e movimentar o CRM automaticamente.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {carregando ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Spinner className="w-6 h-6 text-primary" />
            <span className="text-xs text-muted-foreground">Carregando configurações de IA...</span>
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto text-xs">
            {/* Status Ativo/Inativo */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-accent/40 border border-border">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-foreground">Habilitar IA no Instagram Direct</span>
                <span className="text-[11px] text-muted-foreground">
                  Quando ativo, a IA responderá aos leads recebidos no Direct e atualizará o CRM.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Provedor e Chave de API */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-border bg-card">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Provedor de LLM</label>
                <select
                  value={provedor}
                  onChange={(e) => {
                    const novoProv = e.target.value as AIProvider;
                    setProvedor(novoProv);
                    setModelo(MODELOS_POR_PROVEDOR[novoProv][0]?.id || '');
                  }}
                  className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold"
                >
                  <option value="openai">OpenAI (ChatGPT / GPT-4o)</option>
                  <option value="gemini">Google Gemini (Flash / Pro)</option>
                  <option value="anthropic">Anthropic (Claude 3.5)</option>
                  <option value="groq">Groq (Llama 3.3 Ultra Rápido)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Modelo de Linguagem</label>
                <select
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-medium"
                >
                  {MODELOS_POR_PROVEDOR[provedor]?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5 pt-1">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-primary" />
                    <span>Chave de API ({provedor.toUpperCase()})</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">BYOK - Pague direto no provedor</span>
                </label>
                <Input
                  type="password"
                  placeholder="Insira sua chave (ex: sk-... ou AIzaSy...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            {/* Persona e Instruções */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Instruções do Sistema (Prompt do SDR)</label>
              <Textarea
                rows={4}
                value={promptSistema}
                onChange={(e) => setPromptSistema(e.target.value)}
                placeholder="Defina as regras de atendimento, FAQ, tom de voz e critérios para direcionar o lead..."
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Mapeamento de Etapas do CRM */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border bg-accent/20">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Mapeamento de Etapas do CRM</span>
                <span className="text-[10px] text-muted-foreground">Onde a IA movimentará os cards</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">1. Etapa de Entrada (Lead Novo)</label>
                  <select
                    value={estagioInicialId}
                    onChange={(e) => setEstagioInicialId(e.target.value)}
                    className="w-full h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                  >
                    <option value="">Primeira etapa do funil (padrão)</option>
                    {estagios.map((est) => (
                      <option key={est.id} value={est.id}>{est.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">2. Etapa Lead Qualificado</label>
                  <select
                    value={estagioQualificadoId}
                    onChange={(e) => setEstagioQualificadoId(e.target.value)}
                    className="w-full h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                  >
                    <option value="">Selecione...</option>
                    {estagios.map((est) => (
                      <option key={est.id} value={est.id}>{est.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">3. Etapa Proposta / Link Enviado</label>
                  <select
                    value={estagioPropostaId}
                    onChange={(e) => setEstagioPropostaId(e.target.value)}
                    className="w-full h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                  >
                    <option value="">Selecione...</option>
                    {estagios.map((est) => (
                      <option key={est.id} value={est.id}>{est.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-medium">4. Etapa Agendamento Feito / Ganho</label>
                  <select
                    value={estagioAgendadoId}
                    onChange={(e) => setEstagioAgendadoId(e.target.value)}
                    className="w-full h-7 px-2 rounded-md border border-border bg-background text-[11px]"
                  >
                    <option value="">Selecione...</option>
                    {estagios.map((est) => (
                      <option key={est.id} value={est.id}>{est.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-accent/20">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={salvando || carregando}>
            {salvando && <Spinner className="w-3.5 h-3.5 mr-1" />}
            <span>Salvar Configuração de IA</span>
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
