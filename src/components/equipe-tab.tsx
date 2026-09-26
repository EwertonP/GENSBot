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
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { uploadMediaFile } from '@/lib/storage-upload';


export interface MembroEquipe {
  id: string;
  agencia_id: string;
  nome: string;
  email: string;
  papel: 'master' | 'membro';
  ativo: boolean;
  cargo: string | null;
  foto_url: string | null;
  criado_em: string;
  total_demandas?: number;
}

interface EquipeTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function EquipeTab({ showToast }: EquipeTabProps) {
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
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [formPapel, setFormPapel] = useState<'master' | 'membro'>('master');
  const [formPassword, setFormPassword] = useState('');
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
  }, []);

  function abrirModalCriar() {
    setMembroEditando(null);
    setFormNome('');
    setFormEmail('');
    setFormCargo('Sócio / Designer');
    setFormFotoUrl('');
    setFormPapel('master');
    setFormPassword('');
    setSenhaGeradaMsg(null);
    setModalAberto(true);
  }

  function abrirModalEditar(m: MembroEquipe) {
    setMembroEditando(m);
    setFormNome(m.nome);
    setFormEmail(m.email);
    setFormCargo(m.cargo || '');
    setFormFotoUrl(m.foto_url || '');
    setFormPapel(m.papel);
    setFormPassword('');
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
            papel: formPapel,
            foto_url: formFotoUrl.trim() || null,
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
            papel: formPapel,
            password: formPassword.trim() || undefined,
            foto_url: formFotoUrl.trim() || null,
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
    if (!confirm(`Deseja realmente excluir permanentemente o membro ${m.nome}? Esta ação não pode ser desfeita.`)) return;
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
    showToast('Link de cadastro da equipe copiado para a área de transferência! 🔗', 'success');
  }

  const pendentes = membros.filter((m) => !m.ativo);
  const ativos = membros.filter((m) => m.ativo);

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header com Ação de Criar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
            Administração · Multi-membros
          </span>
          <h2 className="text-xl sm:text-2xl font-black font-display text-foreground tracking-tight flex items-center gap-2.5 mt-0.5">
            <span>Equipe & Sócios da Agência</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-mono font-bold">
              {ativos.length} ativos
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cadastre membros da equipe, altere fotos de perfil e gerencie níveis de acesso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleCopiarLinkCadastro}
            variant="outline"
            className="rounded-xl shadow-xs text-xs"
            title="Copiar link para enviar a novos membros se cadastrarem"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Copiar Link de Convite
          </Button>

          <Button
            onClick={abrirModalCriar}
            variant="primary"
            className="rounded-xl shadow-xs text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/30"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Cadastrar Membro
          </Button>
        </div>
      </div>

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
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border/80 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
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
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 bg-card shadow-2xs hover:shadow-xs ${
                  !membro.ativo
                    ? 'opacity-70 border-dashed border-border'
                    : isMaster
                    ? 'border-[#d8ff3c] bg-card'
                    : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClienteAvatar
                      nome={membro.nome}
                      fotoUrl={membro.foto_url}
                      cor="#192313"
                      tamanho="md"
                      className="shrink-0 ring-2 ring-[#d8ff3c]"
                    />

                    <div className="min-w-0 leading-tight">
                      <h4 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                        <span>{membro.nome}</span>
                        {isMaster && <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </h4>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{membro.email}</p>
                    </div>
                  </div>

                  <Badge
                    variant={isMaster ? 'info' : 'muted'}
                    className={`text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${
                      isMaster ? 'bg-primary/15 text-primary border-primary/30' : ''
                    }`}
                  >
                    {isMaster ? 'Sócio Master' : 'Colaborador'}
                  </Badge>
                </div>

                <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span>{membro.cargo || (isMaster ? 'Sócio / Diretor' : 'Especialista')}</span>
                    </span>

                    <span className="text-muted-foreground font-mono text-[11px] flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>{membro.total_demandas || 0} demandas</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        membro.ativo ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {membro.ativo ? 'Acesso Ativo' : 'Acesso Inativo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => abrirModalEditar(membro)}
                      className="h-7 px-2 text-xs font-semibold rounded-lg"
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAlternarAtivo(membro)}
                      className={`h-7 px-2 text-xs rounded-lg ${
                        membro.ativo
                          ? 'text-muted-foreground hover:text-foreground'
                          : 'text-success border-success/30'
                      }`}
                    >
                      {membro.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleExcluirMembro(membro)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer shrink-0"
                      title="Excluir membro permanentemente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal / Sheet para Adicionar ou Editar Membro */}
      <Sheet
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        aria-label={membroEditando ? 'Editar Membro' : 'Novo Membro'}
      >
        <form onSubmit={handleSalvar} className="p-6 flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
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
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/30 border border-border/60">
                <ClienteAvatar
                  nome={formNome || 'Usuário'}
                  fotoUrl={formFotoUrl}
                  cor="#192313"
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
                    className="h-8 text-[11px]"
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
