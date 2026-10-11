'use client';

import React, { useState, useEffect } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Avatar } from '@/components/ui/avatar';
import { Tip } from '@/components/ui/tooltip';
import { confirmDialog } from '@/components/ui/dialog';
import { formatarMoeda, gerarLinkWhatsApp, calcularDiasSemContato } from '@/lib/crm';
import type { CrmEstagio, CrmNegocio, CrmAtividade, CrmTarefa, CrmPrioridade } from '@/types/crm';
import {
  X,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Clock,
  User,
  Building,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Send,
  Plus,
  Zap,
  Tag,
  Check,
  FileText,
} from 'lucide-react';

interface CrmDealDrawerProps {
  negocioId: string | null;
  estagios: CrmEstagio[];
  membros: { id: string; nome: string }[];
  onClose: () => void;
  onAtualizado: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function CrmDealDrawer({
  negocioId,
  estagios,
  membros,
  onClose,
  onAtualizado,
  showToast,
}: CrmDealDrawerProps) {
  const [negocio, setNegocio] = useState<CrmNegocio | null>(null);
  const [atividades, setAtividades] = useState<CrmAtividade[]>([]);
  const [tarefas, setTarefas] = useState<CrmTarefa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Form states
  const [abaAtiva, setAbaAtiva] = useState<'timeline' | 'tarefas'>('timeline');
  const [novaNota, setNovaNota] = useState('');
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState('');
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState('');
  const [novoTagInput, setNovoTagInput] = useState('');

  // Editable fields
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState('0');
  const [nomeContato, setNomeContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [prioridade, setPrioridade] = useState<CrmPrioridade>('media');
  const [responsavelId, setResponsavelId] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const carregarDetalhes = async (id: string) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/negocios/${id}`);
      if (!res.ok) throw new Error('Falha ao carregar negócio.');
      const data = await res.json();
      setNegocio(data);
      setAtividades(data.atividades || []);
      setTarefas(data.tarefas || []);

      setTitulo(data.titulo || '');
      setValor(String(data.valor || 0));
      setNomeContato(data.nome_contato || '');
      setTelefone(data.telefone || '');
      setEmail(data.email || '');
      setInstagram(data.instagram_username || '');
      setEmpresa(data.empresa || '');
      setCargo(data.cargo || '');
      setPrioridade(data.prioridade || 'media');
      setResponsavelId(data.responsavel_id || '');
      setTags(data.tags || []);
    } catch {
      showToast('Erro ao carregar detalhes da oportunidade.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (negocioId) {
      carregarDetalhes(negocioId);
    } else {
      setNegocio(null);
    }
  }, [negocioId]);

  if (!negocioId) return null;

  const handleSalvarCampos = async () => {
    if (!negocio) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          valor: Number(valor) || 0,
          nome_contato: nomeContato,
          telefone,
          email,
          instagram_username: instagram,
          empresa,
          cargo,
          prioridade,
          responsavel_id: responsavelId || null,
          tags,
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar alterações.');
      showToast('Oportunidade atualizada!', 'success');
      onAtualizado();
    } catch {
      showToast('Erro ao salvar alterações.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleMoverEtapa = async (novoEstagioId: string) => {
    if (!negocio) return;
    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estagio_id: novoEstagioId }),
      });
      if (!res.ok) throw new Error('Falha ao mover etapa.');
      showToast('Etapa atualizada!', 'success');
      carregarDetalhes(negocio.id);
      onAtualizado();
    } catch {
      showToast('Erro ao alterar etapa.', 'error');
    }
  };

  const handleMarcarGanho = async () => {
    if (!negocio) return;
    const estagioGanho = estagios.find((e) => e.tipo_conclusao === 'ganho') || estagios[estagios.length - 1];
    if (!estagioGanho) return;

    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estagio_id: estagioGanho.id,
          valor_final: Number(valor) || 0,
        }),
      });
      if (!res.ok) throw new Error('Falha ao marcar como ganho.');
      showToast('Parabéns! Oportunidade ganha! 🏆', 'success');
      carregarDetalhes(negocio.id);
      onAtualizado();
    } catch {
      showToast('Erro ao concluir oportunidade.', 'error');
    }
  };

  const handleMarcarPerdido = async () => {
    if (!negocio) return;
    const estagioPerdido = estagios.find((e) => e.tipo_conclusao === 'perdido');
    if (!estagioPerdido) return;

    const motivo = window.prompt('Qual o motivo da perda? (ex: Preço, Concorrente, Sem contato, Momento)');
    if (motivo === null) return; // cancelou

    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estagio_id: estagioPerdido.id,
          motivo_perda: motivo.trim() || 'Não especificado',
        }),
      });
      if (!res.ok) throw new Error('Falha ao marcar como perdido.');
      showToast('Oportunidade marcada como perdida.', 'error');
      carregarDetalhes(negocio.id);
      onAtualizado();
    } catch {
      showToast('Erro ao registrar perda.', 'error');
    }
  };

  const handleExcluir = async () => {
    if (!negocio) return;
    const confirmado = await confirmDialog({
      title: 'Excluir Oportunidade',
      description: `Tem certeza que deseja excluir "${negocio.titulo}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir Definitivamente',
      tone: 'destructive',
    });
    if (!confirmado) return;

    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir.');
      showToast('Oportunidade excluída com sucesso.', 'success');
      onClose();
      onAtualizado();
    } catch {
      showToast('Erro ao excluir oportunidade.', 'error');
    }
  };

  const handleAdicionarNota = async () => {
    if (!negocio || !novaNota.trim()) return;
    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}/atividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'nota', descricao: novaNota.trim() }),
      });
      if (!res.ok) throw new Error('Falha ao adicionar nota.');
      setNovaNota('');
      showToast('Nota adicionada!', 'success');
      carregarDetalhes(negocio.id);
    } catch {
      showToast('Erro ao salvar nota.', 'error');
    }
  };

  const handleAdicionarTarefa = async () => {
    if (!negocio || !novaTarefaTitulo.trim() || !novaTarefaPrazo) return;
    try {
      const res = await fetch(`/api/crm/negocios/${negocio.id}/tarefas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: novaTarefaTitulo.trim(),
          prazo: new Date(novaTarefaPrazo).toISOString(),
          tipo: 'whatsapp',
        }),
      });
      if (!res.ok) throw new Error('Falha ao agendar tarefa.');
      setNovaTarefaTitulo('');
      setNovaTarefaPrazo('');
      showToast('Follow-up agendado!', 'success');
      carregarDetalhes(negocio.id);
    } catch {
      showToast('Erro ao agendar follow-up.', 'error');
    }
  };

  const handleAlternarTarefa = async (tarefaId: string, concluida: boolean) => {
    if (!negocio) return;
    try {
      await fetch(`/api/crm/negocios/${negocio.id}/tarefas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarefa_id: tarefaId, concluida: !concluida }),
      });
      carregarDetalhes(negocio.id);
    } catch {
      showToast('Erro ao atualizar tarefa.', 'error');
    }
  };

  const handleAddTag = () => {
    if (!novoTagInput.trim()) return;
    if (!tags.includes(novoTagInput.trim())) {
      setTags([...tags, novoTagInput.trim()]);
    }
    setNovoTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  return (
    <Sheet open={!!negocioId} onClose={onClose}>
      <div className="flex flex-col h-full bg-background max-w-2xl w-full">
        {/* Cabeçalho do Drawer */}
        <div className="p-5 border-b border-border flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: negocio?.estagio?.cor || '#3b82f6' }}
              />
              <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                {negocio?.estagio?.nome || 'Oportunidade'}
              </span>
              {negocio?.status === 'ganho' && (
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
                  Ganho 🏆
                </Badge>
              )}
              {negocio?.status === 'perdido' && (
                <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">
                  Perdido ❌
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {telefone && (
                <Tip label="Conversar no WhatsApp">
                  <a
                    href={gerarLinkWhatsApp(telefone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </Tip>
              )}

              {negocio?.status === 'aberto' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMarcarGanho}
                    className="gap-1 text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-7"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ganho</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMarcarPerdido}
                    className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 h-7"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Perdido</span>
                  </Button>
                </>
              )}

              <button
                type="button"
                onClick={handleExcluir}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Título & Valor */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título da oportunidade"
              className="text-lg font-bold font-display bg-transparent border-0 focus:ring-0 p-0 text-foreground w-full focus:outline-none"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-mono text-muted-foreground">R$</span>
              <input
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
                className="w-28 text-right font-mono font-bold text-base bg-accent/40 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Stepper Visual de Estágios */}
          <div className="flex items-center gap-1 overflow-x-auto pt-2 pb-1">
            {estagios.map((est) => {
              const ativo = negocio?.estagio_id === est.id;
              return (
                <button
                  key={est.id}
                  type="button"
                  onClick={() => handleMoverEtapa(est.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium shrink-0 transition-all border ${
                    ativo
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs font-bold'
                      : 'bg-accent/40 text-muted-foreground border-border hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {est.nome}
                </button>
              );
            })}
          </div>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {/* Dados do Contato & Lead */}
          <div className="flex flex-col gap-3 bg-card p-4 rounded-xl border border-border">
            <h4 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">
              Dados do Contato
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Nome do Lead</label>
                <Input
                  value={nomeContato}
                  onChange={(e) => setNomeContato(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">WhatsApp / Telefone</label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(DDD) 99999-9999"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">E-mail</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Instagram (@)</label>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="usuario"
                    className="h-8 text-xs"
                  />
                  {instagram && (
                    <Tip label="Ver no Instagram">
                      <a
                        href={`https://instagram.com/${instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Tip>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Empresa</label>
                <Input
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Nome da empresa"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Cargo / Profissão</label>
                <Input
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="ex: Médico, CEO"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Responsável (Vendedor)</label>
                <Select
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="">Não atribuído</option>
                  {membros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Prioridade</label>
                <Select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as CrmPrioridade)}
                  className="h-8 text-xs"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </Select>
              </div>
            </div>

            {/* Tags */}
            <div className="pt-2 border-t border-border/50 flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground">Tags & Interesses</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map((t) => (
                  <Badge key={t} variant="muted" className="text-[11px] gap-1 pr-1.5 font-mono">
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={novoTagInput}
                    onChange={(e) => setNovoTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="+ Tag..."
                    className="h-6 w-24 text-[10px]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={handleSalvarCampos} disabled={salvando} className="h-7 text-xs">
                {salvando ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>

          {/* Abas: Timeline vs Follow-ups */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center border-b border-border text-xs font-medium">
              <button
                type="button"
                onClick={() => setAbaAtiva('timeline')}
                className={`pb-2 px-3 border-b-2 font-display transition-colors ${
                  abaAtiva === 'timeline'
                    ? 'border-primary text-foreground font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Linha do Tempo ({atividades.length})
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva('tarefas')}
                className={`pb-2 px-3 border-b-2 font-display transition-colors ${
                  abaAtiva === 'tarefas'
                    ? 'border-primary text-foreground font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Follow-ups & Tarefas ({tarefas.filter((t) => !t.concluida).length})
              </button>
            </div>

            {/* Conteúdo da Aba Timeline */}
            {abaAtiva === 'timeline' && (
              <div className="flex flex-col gap-3">
                {/* Nova Nota Rápida */}
                <div className="flex gap-2 bg-card p-3 rounded-xl border border-border">
                  <Textarea
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    placeholder="Registrar anotação, resultado de ligação ou mensagem..."
                    rows={2}
                    className="text-xs resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleAdicionarNota}
                    disabled={!novaNota.trim()}
                    className="shrink-0 self-end h-8 text-xs gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Salvar</span>
                  </Button>
                </div>

                {/* Lista de Atividades */}
                <div className="flex flex-col gap-2.5 pt-2">
                  {atividades.map((atv) => (
                    <div
                      key={atv.id}
                      className="flex gap-3 p-3 rounded-xl bg-accent/20 border border-border text-xs"
                    >
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                        {atv.tipo === 'criacao' && <Zap className="w-3 h-3 text-primary" />}
                        {atv.tipo === 'mudanca_estagio' && <Clock className="w-3 h-3 text-blue-500" />}
                        {atv.tipo === 'ganho' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        {atv.tipo === 'perda' && <XCircle className="w-3 h-3 text-destructive" />}
                        {atv.tipo === 'nota' && <FileText className="w-3 h-3 text-foreground" />}
                        {atv.tipo === 'tarefa' && <Calendar className="w-3 h-3 text-amber-500" />}
                      </div>

                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {atv.membro?.nome || 'Sistema'}
                          </span>
                          <span className="font-mono">
                            {new Date(atv.criado_em).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{atv.descricao}</p>
                      </div>
                    </div>
                  ))}

                  {atividades.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma atividade registrada ainda.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Conteúdo da Aba Tarefas */}
            {abaAtiva === 'tarefas' && (
              <div className="flex flex-col gap-3">
                {/* Nova Tarefa */}
                <div className="flex flex-col gap-2 bg-card p-3 rounded-xl border border-border">
                  <span className="text-[11px] font-bold text-muted-foreground">Agendar Follow-up</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={novaTarefaTitulo}
                      onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                      placeholder="Ex: Ligar na quinta para confirmar proposta"
                      className="text-xs flex-1 h-8"
                    />
                    <Input
                      type="date"
                      value={novaTarefaPrazo}
                      onChange={(e) => setNovaTarefaPrazo(e.target.value)}
                      className="text-xs w-36 h-8 font-mono"
                    />
                    <Button
                      size="sm"
                      onClick={handleAdicionarTarefa}
                      disabled={!novaTarefaTitulo.trim() || !novaTarefaPrazo}
                      className="h-8 text-xs shrink-0"
                    >
                      Agendar
                    </Button>
                  </div>
                </div>

                {/* Lista de Tarefas */}
                <div className="flex flex-col gap-2 pt-2">
                  {tarefas.map((tar) => (
                    <div
                      key={tar.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                        tar.concluida ? 'bg-muted/40 border-border opacity-60' : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleAlternarTarefa(tar.id, tar.concluida)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            tar.concluida
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 hover:border-primary'
                          }`}
                        >
                          {tar.concluida && <Check className="w-3 h-3" />}
                        </button>
                        <span className={tar.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}>
                          {tar.titulo}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(tar.prazo).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}

                  {tarefas.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum follow-up pendente para este lead.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
