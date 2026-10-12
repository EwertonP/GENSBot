'use client';

import React, { useState, useEffect } from 'react';
import { DialogShell } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { CrmEstagio, CrmNegocio, CrmOrigem, CrmPrioridade } from '@/types/crm';
import { X, Target, User, Phone, Mail, Building, DollarSign } from 'lucide-react';

interface CrmNovoNegocioModalProps {
  open: boolean;
  onClose: () => void;
  pipelineId: string;
  estagios: CrmEstagio[];
  estagioInicialId?: string | null;
  clienteId?: string | null;
  membros: { id: string; nome: string }[];
  onCriado: (negocio: CrmNegocio) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function CrmNovoNegocioModal({
  open,
  onClose,
  pipelineId,
  estagios,
  estagioInicialId,
  clienteId,
  membros,
  onCriado,
  showToast,
}: CrmNovoNegocioModalProps) {
  const [salvando, setSalvando] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('');
  const [estagioId, setEstagioId] = useState('');
  const [contatoNome, setContatoNome] = useState('');
  const [contatoWhatsapp, setContatoWhatsapp] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [empresaNome, setEmpresaNome] = useState('');
  const [origem, setOrigem] = useState<CrmOrigem>('manual');
  const [prioridade, setPrioridade] = useState<CrmPrioridade>('media');
  const [responsavelId, setResponsavelId] = useState('');
  const [descricao, setDescricao] = useState('');

  // Sincroniza estágio inicial quando abre
  useEffect(() => {
    if (open) {
      setTitulo('');
      setValor('');
      setContatoNome('');
      setContatoWhatsapp('');
      setContatoEmail('');
      setEmpresaNome('');
      setOrigem('manual');
      setPrioridade('media');
      setResponsavelId(membros[0]?.id || '');
      setDescricao('');

      if (estagioInicialId && estagios.some((e) => e.id === estagioInicialId)) {
        setEstagioId(estagioInicialId);
      } else if (estagios.length > 0) {
        setEstagioId(estagios[0].id);
      }
    }
  }, [open, estagioInicialId, estagios, membros]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      showToast('Preencha o título do negócio.', 'error');
      return;
    }

    setSalvando(true);
    try {
      const valorNumerico = parseFloat(valor.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;

      const res = await fetch('/api/crm/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: pipelineId,
          cliente_id: clienteId || null,
          estagio_id: estagioId || estagios[0]?.id,
          titulo: titulo.trim(),
          valor: valorNumerico,
          nome_contato: contatoNome.trim() || titulo.trim(),
          contato_nome: contatoNome.trim() || null,
          telefone: contatoWhatsapp.trim() || null,
          contato_whatsapp: contatoWhatsapp.trim() || null,
          email: contatoEmail.trim() || null,
          contato_email: contatoEmail.trim() || null,
          empresa: empresaNome.trim() || null,
          empresa_nome: empresaNome.trim() || null,
          origem,
          prioridade,
          responsavel_id: responsavelId || null,
          descricao: descricao.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar oportunidade');
      }

      showToast('Oportunidade adicionada com sucesso!', 'success');
      const negocioCriado = data.negocio || data;
      onCriado(negocioCriado);
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao cadastrar oportunidade', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onRequestClose={onClose}
      aria-label="Nova Oportunidade no CRM"
      className="max-w-xl w-full"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Nova Oportunidade</h3>
              <p className="text-xs text-muted-foreground">Cadastre um novo lead no funil de negociação.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Título & Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-foreground">Título do Negócio *</label>
              <Input
                placeholder="Ex: Contrato Gestão de Tráfego"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Valor (R$)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Estágio & Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Estágio Inicial</label>
              <Select value={estagioId} onChange={(e) => setEstagioId(e.target.value)}>
                {estagios.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Prioridade</label>
              <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as CrmPrioridade)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente 🔥</option>
              </Select>
            </div>
          </div>

          {/* Dados do Contato */}
          <div className="border border-border/60 rounded-xl p-3.5 bg-accent/15 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dados do Contato & Empresa
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <User className="w-3 h-3 text-muted-foreground" /> Nome do Lead
                </label>
                <Input
                  placeholder="Ex: Carlos Silva"
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Building className="w-3 h-3 text-muted-foreground" /> Empresa / Marca
                </label>
                <Input
                  placeholder="Ex: Alpha Cosméticos"
                  value={empresaNome}
                  onChange={(e) => setEmpresaNome(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-muted-foreground" /> WhatsApp / Tel
                </label>
                <Input
                  placeholder="+55 11 99999-9999"
                  value={contatoWhatsapp}
                  onChange={(e) => setContatoWhatsapp(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-muted-foreground" /> E-mail
                </label>
                <Input
                  type="email"
                  placeholder="carlos@exemplo.com"
                  value={contatoEmail}
                  onChange={(e) => setContatoEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Origem & Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Canal de Origem</label>
              <Select value={origem} onChange={(e) => setOrigem(e.target.value as CrmOrigem)}>
                <option value="manual">Manual (Prospecção Direta)</option>
                <option value="instagram">Instagram Direct</option>
                <option value="formulario">Formulário GENSBot</option>
                <option value="webhook_ads">Meta Ads (Webhook)</option>
                <option value="indicacao">Indicação / Parceiro</option>
                <option value="outros">Outros</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Responsável</label>
              <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                <option value="">Não atribuído</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Descrição / Observação inicial */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Observação Inicial / Briefing</label>
            <Textarea
              rows={2}
              placeholder="Descreva detalhes da conversa, interesse do cliente, etc."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20 shrink-0">
          <Button type="button" variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={salvando}>
            {salvando ? (
              <>
                <Spinner className="w-4 h-4 mr-2" /> Salvando...
              </>
            ) : (
              'Criar Oportunidade'
            )}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
