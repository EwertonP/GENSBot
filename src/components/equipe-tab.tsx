'use client';

import React, { useEffect, useState } from 'react';
import {
  Users2,
  UserPlus,
  ShieldCheck,
  User,
  Mail,
  Briefcase,
  Layers,
  CheckCircle2,
  Clock,
  Trash2,
  Sparkles,
  UploadCloud,
  Camera,
  BarChart3,
  Edit2,
  Power,
  Calendar,
  Cake,
  Lock,
  Shield,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HeroGradientPanel, HeroKpiCard } from '@/components/ui/hero-gradient-panel';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { uploadMediaFile } from '@/lib/storage-upload';
import { confirmDialog } from '@/components/ui/dialog';
import { SegmentedItem } from '@/components/ui/segmented';
import { PainelProdutividade } from '@/components/equipe/painel-produtividade';


export interface MembroEquipe {
  id: string;
  agencia_id: string;
  nome: string;
  email: string;
  papel: 'master' | 'membro';
  ativo: boolean;
  cargo: string | null;
  setor?: string | null;
  modulos_permitidos?: string[];
  data_nascimento?: string | null;
  data_inicio?: string | null;
  foto_url: string | null;
  criado_em: string;
  total_demandas?: number;
  clientes_ids?: string[];
}

export const SETORES_SQUADS = [
  'Criação & Design',
  'Audiovisual & Edição',
  'Tráfego & Performance',
  'Comercial & Vendas',
  'Financeiro & Adm',
  'Atendimento & CS',
  'Estratégia & Conteúdo',
];

export const MODULOS_DISPONIVEIS: { id: string; rotulo: string; descricao: string }[] = [
  { id: 'meu_dia', rotulo: 'Meu Dia', descricao: 'Cockpit operacional e tarefas do dia' },
  { id: 'esteira', rotulo: 'Esteira & Kanban', descricao: 'Gestão de demandas e produção' },
  { id: 'clientes', rotulo: 'Clientes', descricao: 'Fichas estratégicas e acessos' },
  { id: 'publish', rotulo: 'Publicar & Agendar', descricao: 'Agendamento de posts e mídias' },
  { id: 'automations', rotulo: 'Automações', descricao: 'Fluxos de mensagens do Instagram' },
  { id: 'contacts', rotulo: 'Contatos & Leads', descricao: 'Base de contatos da agência' },
  { id: 'crm', rotulo: 'CRM de Vendas', descricao: 'Funil e negociações comerciais' },
  { id: 'financeiro', rotulo: 'Financeiro', descricao: 'Contas, receitas, despesas e fluxo' },
  { id: 'documentos', rotulo: 'Propostas & Contratos', descricao: 'Documentos e assinaturas' },
];

export function calcularTempoDeCasa(dataInicio?: string | null): string | null {
  if (!dataInicio) return null;
  const inicio = new Date(dataInicio);
  if (isNaN(inicio.getTime())) return null;
  const agora = new Date();
  const meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth());
  if (meses < 1) return 'Recente (< 1 mês)';
  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  if (anos === 0) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  if (mesesRestantes === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos}a ${mesesRestantes}m`;
}

export function formatarAniversario(dataNasc?: string | null): string | null {
  if (!dataNasc) return null;
  const partes = dataNasc.split('-');
  if (partes.length < 3) return null;
  return `${partes[2]}/${partes[1]}`;
}

interface ClienteOpcao {
  id: string;
  nome: string;
  cor: string | null;
  ativo: boolean;
}

interface EquipeTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function EquipeTab({ showToast }: EquipeTabProps) {
  const [subAba, setSubAba] = useState<'membros' | 'produtividade'>('membros');
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modal Novo / Editar Membro
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [membroEditando, setMembroEditando] = useState<MembroEquipe | null>(null);

  // Formulário
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCargo, setFormCargo] = useState('');
  const [formSetor, setFormSetor] = useState('');
  const [formModulosPermitidos, setFormModulosPermitidos] = useState<string[]>([
    'meu_dia',
    'esteira',
    'clientes',
    'publish',
    'automations',
    'contacts',
  ]);
  const [formDataNascimento, setFormDataNascimento] = useState('');
  const [formDataInicio, setFormDataInicio] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [formPapel, setFormPapel] = useState<'master' | 'membro'>('master');
  const [formPassword, setFormPassword] = useState('');
  const [clientesAgencia, setClientesAgencia] = useState<ClienteOpcao[]>([]);
  const [formClientesIds, setFormClientesIds] = useState<string[]>([]);
  const [senhaGeradaMsg, setSenhaGeradaMsg] = useState<string | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  async function carregarMembros() {
    setCarregando(true);
    try {
      const res = await fetch('/api/equipe');
      const data = await res.json();
      if (res.ok && data.membros) {
        setMembros(data.membros);
      } else {
        showToast(data.error || 'Erro ao carregar equipe.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao carregar equipe.', 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarMembros();
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : { clientes: [] }))
      .then((data) => setClientesAgencia(Array.isArray(data.clientes) ? data.clientes : []))
      .catch(() => setClientesAgencia([]));
  }, []);

  function abrirModalCriar() {
    setMembroEditando(null);
    setFormNome('');
    setFormEmail('');
    setFormCargo('Designer / Criativo');
    setFormSetor('Criação & Design');
    setFormModulosPermitidos(['meu_dia', 'esteira', 'clientes', 'publish', 'automations', 'contacts']);
    setFormDataNascimento('');
    setFormDataInicio(new Date().toISOString().slice(0, 10));
    setFormFotoUrl('');
    setFormPapel('master');
    setFormPassword('');
    setFormClientesIds([]);
    setSenhaGeradaMsg(null);
    setModalAberto(true);
  }

  function abrirModalEditar(m: MembroEquipe) {
    setMembroEditando(m);
    setFormNome(m.nome);
    setFormEmail(m.email);
    setFormCargo(m.cargo || '');
    setFormSetor(m.setor || '');
    setFormModulosPermitidos(m.modulos_permitidos || ['meu_dia', 'esteira', 'clientes', 'publish', 'automations', 'contacts']);
    setFormDataNascimento(m.data_nascimento ? m.data_nascimento.slice(0, 10) : '');
    setFormDataInicio(m.data_inicio ? m.data_inicio.slice(0, 10) : '');
    setFormFotoUrl(m.foto_url || '');
    setFormPapel(m.papel);
    setFormPassword('');
    setFormClientesIds(m.clientes_ids ?? []);
    setSenhaGeradaMsg(null);
    setModalAberto(true);
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    setUploadingFoto(true);
    try {
      const res = await uploadMediaFile(file, 'equipe');
      setFormFotoUrl(res.url);
      showToast('Foto de perfil enviada com sucesso!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar foto.', 'error');
    } finally {
      setUploadingFoto(false);
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!formNome.trim() || (!membroEditando && !formEmail.trim())) {
      showToast('Preencha os campos obrigatórios.', 'error');
      return;
    }

    setSalvando(true);
    setSenhaGeradaMsg(null);

    try {
      if (membroEditando) {
        // Atualização
        const res = await fetch(`/api/equipe/${membroEditando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: formNome.trim(),
            cargo: formCargo.trim() || null,
            setor: formSetor.trim() || null,
            modulos_permitidos: formPapel === 'membro' ? formModulosPermitidos : null,
            data_nascimento: formDataNascimento || null,
            data_inicio: formDataInicio || null,
            papel: formPapel,
            foto_url: formFotoUrl.trim() || null,
            // Master não precisa de lista: enxerga todos os clientes.
            ...(formPapel === 'membro' && { clientes_ids: formClientesIds }),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setMembros((prev) =>
          prev.map((m) => (m.id === membroEditando.id ? { ...m, ...data.membro } : m))
        );
        showToast('Membro atualizado com sucesso!', 'success');
        setModalAberto(false);
      } else {
        // Criação de novo membro / sócio
        const res = await fetch('/api/equipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: formNome.trim(),
            email: formEmail.trim(),
            cargo: formCargo.trim() || null,
            setor: formSetor.trim() || null,
            modulos_permitidos: formPapel === 'membro' ? formModulosPermitidos : null,
            data_nascimento: formDataNascimento || null,
            data_inicio: formDataInicio || null,
            papel: formPapel,
            password: formPassword.trim() || undefined,
            foto_url: formFotoUrl.trim() || null,
            ...(formPapel === 'membro' && { clientes_ids: formClientesIds }),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setMembros((prev) => [...prev, data.membro]);
        if (data.senhaGerada) {
          setSenhaGeradaMsg(
            `Conta criada com sucesso! Senha inicial gerada: ${data.senhaGerada}`
          );
        } else {
          showToast('Sócio/Membro adicionado com sucesso!', 'success');
          setModalAberto(false);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar membro.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function handleAlternarAtivo(m: MembroEquipe) {
    const novoAtivo = !m.ativo;
    try {
      const res = await fetch(`/api/equipe/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoAtivo }),
      });
      if (!res.ok) throw new Error();
      setMembros((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, ativo: novoAtivo } : item))
      );
      showToast(novoAtivo ? `${m.nome} foi ativado na agência!` : `${m.nome} foi desativado.`, 'success');
    } catch {
      showToast('Erro ao atualizar status do membro.', 'error');
    }
  }

  async function handleExcluirMembro(m: MembroEquipe) {
    if (!(await confirmDialog({ title: `Excluir ${m.nome} da equipe?`, description: 'A exclusão é permanente e não pode ser desfeita. As demandas atribuídas a essa pessoa ficam sem responsável.', confirmLabel: 'Excluir membro', tone: 'destructive' }))) return;
    try {
      const res = await fetch(`/api/equipe/${m.id}?hard=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir membro.');
      setMembros((prev) => prev.filter((item) => item.id !== m.id));
      showToast(`${m.nome} foi excluído da equipe.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir membro.', 'error');
    }
  }

  function handleCopiarLinkCadastro() {
    const registerUrl = `${window.location.origin}/register`;
    navigator.clipboard.writeText(registerUrl);
    showToast('Link copiado! Quem se cadastrar fica pendente até você aprovar aqui na Equipe.', 'success');
  }

  const pendentes = membros.filter((m) => !m.ativo);
  const ativos = membros.filter((m) => m.ativo);
  const mastersCount = ativos.filter((m) => m.papel === 'master').length;
  const totalDemandasEquipe = membros.reduce((acc, m) => acc + (m.total_demandas || 0), 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-12">
      <HeroGradientPanel
        eyebrow="Administração · Multi-membros"
        title="Equipe & Sócios da Agência"
        actions={
          subAba === 'membros' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={handleCopiarLinkCadastro}
                variant="outline"
                className="rounded-xl shadow-2xs bg-card/90 text-xs w-full sm:w-auto h-10 sm:h-9"
                title="Copiar link para enviar a novos membros se cadastrarem"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Copiar Link de Convite
              </Button>

              <Button
                onClick={abrirModalCriar}
                variant="primary"
                className="rounded-xl shadow-xs text-xs font-bold w-full sm:w-auto h-10 sm:h-9"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />
                Cadastrar Membro
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="inline-flex rounded-xl bg-card/80 backdrop-blur-xs p-1 border border-border/60 self-start">
          <SegmentedItem
            active={subAba === 'membros'}
            group="equipe-sub-aba"
            onClick={() => setSubAba('membros')}
          >
            <Users2 className="size-3.5" />
            Membros & Acessos ({ativos.length})
          </SegmentedItem>
          <SegmentedItem
            active={subAba === 'produtividade'}
            group="equipe-sub-aba"
            onClick={() => setSubAba('produtividade')}
          >
            <BarChart3 className="size-3.5" />
            Produtividade & Entregas
          </SegmentedItem>
        </div>

        {subAba === 'membros' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <HeroKpiCard
              icon={Users2}
              iconTone="primary"
              label="Membros Ativos"
              value={ativos.length}
              hint={`de ${membros.length} cadastrados`}
            />
            <HeroKpiCard
              icon={ShieldCheck}
              iconTone="amber"
              label="Sócios Master"
              value={mastersCount}
              hint="Acesso administrativo total"
            />
            <HeroKpiCard
              icon={Clock}
              iconTone={pendentes.length > 0 ? 'rose' : 'sky'}
              label="Aprovações Pendentes"
              value={pendentes.length}
              hint={pendentes.length > 0 ? 'Aguardando liberação' : 'Tudo em dia'}
            />
            <HeroKpiCard
              icon={Layers}
              iconTone="emerald"
              label="Demandas Atribuídas"
              value={totalDemandasEquipe}
              hint="Total vinculado à equipe"
            />
          </div>
        )}
      </HeroGradientPanel>

      {subAba === 'produtividade' ? (
        <PainelProdutividade showToast={showToast} />
      ) : (
        <>
          {/* Alerta de Cadastros Pendentes */}
      {pendentes.length > 0 && (
        <Card className="p-4 rounded-2xl border-warning/40 bg-warning/5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning flex-shrink-0" />
            <h3 className="text-xs font-bold text-foreground">
              {pendentes.length} {pendentes.length === 1 ? 'membro aguardando' : 'membros aguardando'} aprovação de acesso
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {pendentes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{p.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAlternarAtivo(p)}
                    className="text-xs text-success border-success/30 hover:bg-success/10 rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Aprovar Acesso
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grid de Membros com Avatar */}
      {carregando ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-44 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : membros.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Nenhum membro cadastrado"
          description="Adicione seus sócios ou equipe para começarem a gerenciar as demandas juntos."
          action={{
            label: 'Adicionar Membro',
            icon: UserPlus,
            onClick: abrirModalCriar,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {membros.map((membro) => {
            const isMaster = membro.papel === 'master';

            return (
              <Card
                key={membro.id}
                className={`relative overflow-hidden p-5 rounded-2xl border transition-ui flex flex-col justify-between gap-4 bg-card shadow-2xs hover:shadow-sm ${
                  !membro.ativo
                    ? 'opacity-70 border-dashed border-border bg-muted/20'
                    : isMaster
                    ? 'border-primary/35 hover:border-primary/60'
                    : 'border-border hover:border-foreground/20'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-1 ${
                    !membro.ativo ? 'bg-muted-foreground/30' : isMaster ? 'bg-primary' : 'bg-border'
                  }`}
                />
                <div className="flex items-start justify-between gap-3 pt-0.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClienteAvatar
                      nome={membro.nome}
                      fotoUrl={membro.foto_url}
                      cor="#014130"
                      tamanho="md"
                      className="shrink-0 ring-2 ring-background shadow-2xs"
                    />

                    <div className="min-w-0 leading-tight">
                      <h4 className="text-sm font-bold font-display text-foreground truncate flex items-center gap-1.5">
                        <span>{membro.nome}</span>
                        {isMaster && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{membro.email}</p>
                    </div>
                  </div>

                  <Badge
                    variant={isMaster ? 'brand' : 'muted'}
                    className="text-[11px] font-bold flex-shrink-0"
                  >
                    {isMaster ? 'Sócio Master' : 'Colaborador'}
                  </Badge>
                </div>

                <div className="flex flex-col gap-2.5 rounded-xl bg-muted/40 border border-border/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/90 font-medium flex items-center gap-1.5 min-w-0 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{membro.cargo || (isMaster ? 'Sócio / Diretor' : 'Especialista')}</span>
                    </span>

                    <span className="text-muted-foreground font-sans tabular-nums text-xs flex items-center gap-1 shrink-0 font-semibold">
                      <Layers className="w-3 h-3" />
                      <span>{membro.total_demandas || 0} demandas</span>
                    </span>
                  </div>

                  {/* Setor / Squad e Permissões */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {membro.setor ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/12">
                        {membro.setor}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Sem setor definido</span>
                    )}

                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {isMaster ? (
                        <span className="text-primary font-semibold flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Acesso total
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-medium">
                          <Lock className="w-3 h-3" /> {membro.modulos_permitidos?.length || 6} módulos
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Informações de Tempo de Casa e Aniversário */}
                  {(membro.data_inicio || membro.data_nascimento) && (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                      {membro.data_inicio && (
                        <span className="flex items-center gap-1" title="Tempo de casa">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>Casa: <strong>{calcularTempoDeCasa(membro.data_inicio)}</strong></span>
                        </span>
                      )}
                      {membro.data_nascimento && (
                        <span className="flex items-center gap-1" title="Data de aniversário">
                          <Cake className="w-3 h-3 text-primary" />
                          <span>Niver: <strong>{formatarAniversario(membro.data_nascimento)}</strong></span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/80">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        membro.ativo ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {membro.ativo ? 'Acesso Ativo' : 'Acesso Inativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <IconButton
                      label="Editar membro"
                      onClick={() => abrirModalEditar(membro)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      label={membro.ativo ? 'Desativar acesso' : 'Ativar acesso'}
                      onClick={() => handleAlternarAtivo(membro)}
                      className={membro.ativo ? 'text-muted-foreground' : 'text-success'}
                    >
                      <Power className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      label="Excluir membro permanentemente"
                      tone="destructive"
                      onClick={() => handleExcluirMembro(membro)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Modal / Sheet para Adicionar ou Editar Membro */}
      <Sheet
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        aria-label={membroEditando ? 'Editar Membro' : 'Novo Membro'}
      >
        <form onSubmit={handleSalvar} className="p-6 flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Gestão de Equipe
            </span>
            <h3 className="text-lg font-bold font-display text-foreground mt-0.5">
              {membroEditando ? `Editar: ${membroEditando.nome}` : 'Adicionar Sócio / Membro'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {membroEditando
                ? 'Atualize o cargo, foto de perfil e papel deste membro na agência.'
                : 'Defina os dados de acesso e foto para o novo sócio ou colaborador.'}
            </p>
          </div>

          {senhaGeradaMsg && (
            <div className="p-3.5 rounded-xl bg-success/15 border border-success/30 text-success text-xs leading-relaxed font-semibold">
              {senhaGeradaMsg}
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="text-xs"
                >
                  Concluir
                </Button>
              </div>
            </div>
          )}

          {!senhaGeradaMsg && (
            <>
              {/* Upload de Foto de Perfil */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/30 border border-border">
                <ClienteAvatar
                  nome={formNome || 'Usuário'}
                  fotoUrl={formFotoUrl}
                  cor="#014130"
                  tamanho="md"
                  className="shrink-0 ring-2 ring-primary"
                />
                <div className="flex flex-col gap-1 flex-1">
                  <label htmlFor="membro-foto-input" className="text-xs font-bold text-primary cursor-pointer hover:underline flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    {uploadingFoto ? 'Enviando imagem...' : 'Adicionar / Alterar Foto de Perfil'}
                  </label>
                  <input
                    id="membro-foto-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFotoUpload}
                    className="hidden"
                  />
                  <Input
                    placeholder="URL direta da foto (ex: https://...)"
                    value={formFotoUrl}
                    onChange={(e) => setFormFotoUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Nome Completo</label>
                <Input
                  placeholder="Ex.: Francisco Raphaell"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  required
                />
              </div>

              {!membroEditando && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">E-mail de Login</label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Cargo / Especialidade</label>
                <Input
                  placeholder="Ex.: Sócio / Designer, Copywriter, Social Media"
                  value={formCargo}
                  onChange={(e) => setFormCargo(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Setor / Squad</label>
                <Select
                  value={formSetor}
                  onChange={(e) => setFormSetor(e.target.value)}
                >
                  <option value="">Selecione um setor...</option>
                  {SETORES_SQUADS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Data de Início (Tempo de casa)</label>
                  <Input
                    type="date"
                    value={formDataInicio}
                    onChange={(e) => setFormDataInicio(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Data de Aniversário</label>
                  <Input
                    type="date"
                    value={formDataNascimento}
                    onChange={(e) => setFormDataNascimento(e.target.value)}
                  />
                </div>
              </div>

              {formPapel === 'membro' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Módulos de Acesso Permitidos</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormModulosPermitidos(
                          formModulosPermitidos.length === MODULOS_DISPONIVEIS.length
                            ? ['meu_dia']
                            : MODULOS_DISPONIVEIS.map((m) => m.id)
                        )
                      }
                      className="text-[11px] text-primary hover:underline font-normal cursor-pointer"
                    >
                      {formModulosPermitidos.length === MODULOS_DISPONIVEIS.length
                        ? 'Desmarcar todos'
                        : 'Selecionar todos'}
                    </button>
                  </label>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">
                    Defina quais abas e ferramentas este colaborador pode visualizar na barra de navegação.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border p-3 max-h-56 overflow-y-auto">
                    {MODULOS_DISPONIVEIS.map((mod) => {
                      const ativo = formModulosPermitidos.includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                            ativo
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-card border-border/60 hover:bg-muted/40'
                          }`}
                          onClick={() => {
                            if (mod.id === 'meu_dia') return;
                            setFormModulosPermitidos((prev) =>
                              prev.includes(mod.id)
                                ? prev.filter((id) => id !== mod.id)
                                : [...prev, mod.id]
                            );
                          }}
                        >
                          <Checkbox
                            checked={ativo}
                            disabled={mod.id === 'meu_dia'}
                            onCheckedChange={(marcado) => {
                              if (mod.id === 'meu_dia') return;
                              setFormModulosPermitidos((prev) =>
                                marcado ? [...prev, mod.id] : prev.filter((id) => id !== mod.id)
                              );
                            }}
                          />
                          <div className="text-xs min-w-0">
                            <span className="font-semibold text-foreground block truncate">
                              {mod.rotulo}
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {mod.descricao}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {formPapel === 'membro' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Clientes que pode acessar</label>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">
                    Só os clientes marcados aparecem para este membro, com as demandas deles. Sem nenhum marcado, ele não vê nada.
                  </p>
                  {clientesAgencia.filter((c) => c.ativo).length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nenhum cliente ativo cadastrado.</span>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-xl border border-border p-3 max-h-56 overflow-y-auto">
                      {clientesAgencia.filter((c) => c.ativo).map((cli) => (
                        <Checkbox
                          key={cli.id}
                          checked={formClientesIds.includes(cli.id)}
                          onCheckedChange={(marcado) =>
                            setFormClientesIds((prev) =>
                              marcado ? [...prev, cli.id] : prev.filter((id) => id !== cli.id)
                            )
                          }
                          label={cli.nome}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Papel na Agência</label>
                <Select
                  value={formPapel}
                  onChange={(e) => setFormPapel(e.target.value as 'master' | 'membro')}
                >
                  <option value="master">Sócio Master (Acesso total e aprovação de equipe)</option>
                  <option value="membro">Colaborador (Visualização de clientes e execução de demandas)</option>
                </Select>
              </div>

              {!membroEditando && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Senha Inicial (Opcional - deixe em branco para gerar automática)
                  </label>
                  <Input
                    type="text"
                    placeholder="Senha temporária (mínimo 6 caracteres)"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setModalAberto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={salvando} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                  {membroEditando ? 'Salvar Alterações' : 'Criar e Ativar Sócio'}
                </Button>
              </div>
            </>
          )}
        </form>
      </Sheet>
    </div>
  );
}
