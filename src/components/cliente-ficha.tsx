'use client';
import { Checkbox } from '@/components/ui/checkbox';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  TrendingUp,
  Users,
  Zap,
  Layers,
  Target,
  Key,
  Copy,
  Check,
  ShieldCheck,
  UserCheck,
  QrCode,
  Smartphone,
  RefreshCw,
  Bell,
  Clock,
  Sparkles,
  Calendar,
  ExternalLink,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Link2,
  Info,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { Instagram as InstagramGlyph } from '@/components/instagram-icon';
import { conectarContaInstagram } from '@/lib/instagram-oauth';
import {
  CORES_CLIENTE,
  textoSobre,
  type Cliente,
  type ClienteContato,
  type ContaInstagramResumo,
  type DestinoConta,
} from '@/lib/clientes';
import { confirmDialog } from '@/components/ui/dialog';

// Campos editáveis pelo formulário. Todos viram string no input; o servidor
// converte (a validação de verdade mora em parseClienteInput).
const CAMPOS = [
  'nome', 'nicho', 'cor', 'etapa', 'instagram_account_id',
  'cnpj_cpf', 'responsavel_legal', 'cpf_responsavel', 'endereco',
  'valor_mensal', 'dia_vencimento', 'contrato_inicio', 'contrato_duracao_meses',
  'posts_mes', 'reels_mes', 'dia_revisao',
  'briefing', 'concorrentes', 'observacoes',
] as const;
type Campo = (typeof CAMPOS)[number];
type Form = Record<Campo, string>;

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function formDe(c: Cliente): Form {
  const out = {} as Form;
  for (const k of CAMPOS) {
    const v = c[k as keyof Cliente];
    if (k === 'valor_mensal' && typeof v === 'number') out[k] = String(v).replace('.', ',');
    else out[k] = v == null ? '' : String(v);
  }
  return out;
}

const ATALHOS: { destino: DestinoConta; rotulo: string; icone: React.ElementType }[] = [
  { destino: 'crm', rotulo: 'CRM de Vendas', icone: Target },
  { destino: 'esteira', rotulo: 'Demandas & Aprovação', icone: Layers },
  { destino: 'automations', rotulo: 'Automações', icone: Zap },
  { destino: 'contacts', rotulo: 'Leads & Público', icone: Users },
  { destino: 'inbox', rotulo: 'Inbox', icone: MessageCircle },
  { destino: 'metrics', rotulo: 'Métricas', icone: TrendingUp },
  { destino: 'publish', rotulo: 'Agendamentos', icone: Send },
];

type CargaFicha =
  | { tipo: 'ok'; cliente: Cliente; contatos: ClienteContato[] }
  | { tipo: 'nao-encontrado' }
  | { tipo: 'erro'; mensagem: string };

// Função pura de rede — não mexe em estado, por isso pode rodar dentro de um efeito.
async function buscarFicha(clienteId: string): Promise<CargaFicha> {
  try {
    const res = await fetch(`/api/clientes/${clienteId}`);
    if (res.status === 404) return { tipo: 'nao-encontrado' };
    const data = await res.json();
    if (!res.ok) return { tipo: 'erro', mensagem: data.error || 'Falha ao carregar o cliente.' };
    return { tipo: 'ok', cliente: data.cliente, contatos: data.contatos };
  } catch {
    return { tipo: 'erro', mensagem: 'Erro de conexão ao carregar o cliente.' };
  }
}

interface ClienteFichaProps {
  clienteId: string;
  nomeInicial: string;
  contas: ContaInstagramResumo[];
  clientes: Cliente[];
  showToast: (message: string, type: 'success' | 'error') => void;
  onAbrirConta: (destino: DestinoConta, instagramUserId: string) => void;
  onVoltar: () => void;
}

export default function ClienteFicha({
  clienteId,
  nomeInicial,
  contas,
  clientes,
  showToast,
  onAbrirConta,
  onVoltar,
}: ClienteFichaProps) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [contatos, setContatos] = useState<ClienteContato[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // O showToast do page.tsx é recriado a cada render; fora das dependências do
  // efeito, para a ficha não ser buscada de novo (e o formulário zerado) a cada
  // re-render do pai.
  const toastRef = useRef(showToast);
  useEffect(() => {
    toastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    let ativo = true;
    buscarFicha(clienteId).then((carga) => {
      if (!ativo) return;
      if (carga.tipo === 'ok') {
        setCliente(carga.cliente);
        setContatos(carga.contatos);
        setForm(formDe(carga.cliente));
      } else if (carga.tipo === 'nao-encontrado') {
        setNaoEncontrado(true);
      } else {
        toastRef.current(carga.mensagem, 'error');
      }
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const camposAlterados = useMemo(() => {
    if (!cliente || !form) return [] as Campo[];
    const base = formDe(cliente);
    return CAMPOS.filter((k) => form[k] !== base[k]);
  }, [cliente, form]);
  const sujo = camposAlterados.length > 0;

  const contaAtual = contas.find((c) => c.id === cliente?.instagram_account_id) ?? null;

  // Contas que ainda podem ser vinculadas: as livres, mais a que já é deste cliente.
  const contasDisponiveis = useMemo(
    () =>
      contas.filter(
        (c) => !clientes.some((outro) => outro.id !== clienteId && outro.instagram_account_id === c.id)
      ),
    [contas, clientes, clienteId]
  );

  function definir(k: Campo, valor: string) {
    setForm((atual) => (atual ? { ...atual, [k]: valor } : atual));
    setErroForm(null);
  }

  function campo(k: Campo) {
    return {
      id: `ficha-${k}`,
      value: form?.[k] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        definir(k, e.target.value),
    };
  }

  async function salvar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!cliente || !form || !sujo) return;
    if (!form.nome.trim()) {
      setErroForm('O nome do cliente não pode ficar vazio.');
      return;
    }

    // Edição parcial: só o que mudou vai para o servidor.
    const payload: Record<string, string | null> = {};
    for (const k of camposAlterados) {
      payload[k] = k === 'instagram_account_id' && form[k] === '' ? null : form[k];
    }

    setSalvando(true);
    setErroForm(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroForm(data.error || 'Não foi possível salvar.');
        return;
      }
      setCliente(data.cliente);
      setForm(formDe(data.cliente));
      showToast('Ficha salva.', 'success');
    } catch {
      showToast('Erro de conexão ao salvar.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    if (cliente) setForm(formDe(cliente));
    setErroForm(null);
  }

  async function voltar() {
    if (sujo && !(await confirmDialog({title: "Sair sem salvar?",description: "Há alterações nesta ficha que ainda não foram salvas.",confirmLabel: "Sair sem salvar",cancelLabel: "Continuar editando",tone: "destructive"}))) return;
    onVoltar();
  }

  async function alternarArquivado() {
    if (!cliente) return;
    const arquivar = cliente.ativo;
    if (
      arquivar &&
      !(await confirmDialog({ title: `Arquivar ${cliente.nome}?`, description: 'Ele some da lista principal, mas nada é apagado — dá para restaurar depois em "Mostrar arquivados".', confirmLabel: 'Arquivar' }))
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !arquivar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar.');
      setCliente(data.cliente);
      showToast(arquivar ? 'Cliente arquivado.' : 'Cliente restaurado.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao atualizar.', 'error');
    }
  }

  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'integracoes' | 'equipe'>('geral');

  // --------------------------------------------------------------- estados ---
  if (carregando) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando cliente">
        <p className="text-sm font-semibold text-muted-foreground">{nomeInicial}</p>
        <Card className="h-40 animate-pulse rounded-2xl" />
        <Card className="h-64 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (naoEncontrado || !cliente || !form) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto flex flex-col gap-4">
        <EmptyState
          icon={Briefcase}
          title="Cliente não encontrado"
          description="Ele pode ter sido removido, ou pertencer a outra agência."
          action={{ label: 'Voltar para clientes', icon: ArrowLeft, onClick: onVoltar }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6 pb-8">
      <button
        type="button"
        onClick={voltar}
        className="inline-flex items-center gap-1.5 self-start text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Clientes
      </button>

      {/* Cabeçalho */}
      <Card padding="lg" className="flex flex-col gap-6 rounded-2xl shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <ClienteAvatar
            nome={form.nome || cliente.nome}
            cor={form.cor || null}
            fotoUrl={contaAtual?.profile_picture_url}
            tamanho="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold font-display tracking-tight text-foreground truncate">{cliente.nome}</h2>
              {!cliente.ativo && <Badge variant="muted">Arquivado</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {[cliente.nicho, contaAtual ? `@${contaAtual.instagram_username ?? contaAtual.instagram_user_id}` : null]
                .filter(Boolean)
                .join(' · ') || 'Sem nicho ou Instagram definidos'}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={alternarArquivado}>
            {cliente.ativo ? 'Arquivar' : 'Restaurar'}
          </Button>
        </div>

        <div className="border-t border-dashed border-border pt-5">
          <p className="eyebrow text-muted-foreground mb-3">Trabalhar neste cliente</p>
          {contaAtual ? (
            <div className="flex flex-wrap gap-2.5">
              {ATALHOS.map(({ destino, rotulo, icone: Icone }) => (
                <Button
                  key={destino}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onAbrirConta(destino, contaAtual.instagram_user_id)}
                >
                  <Icone className="w-3.5 h-3.5" />
                  {rotulo}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground max-w-prose">
              Vincule uma conta do Instagram na seção abaixo para abrir as automações, os leads, o inbox e as métricas
              deste cliente com um clique.
            </p>
          )}
        </div>
      </Card>

      {/* Navegação por Abas - Padrão de Design do Sistema */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setAbaAtiva('geral')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-ui cursor-pointer shrink-0 ${
            abaAtiva === 'geral'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Geral & Contrato
          {sujo && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Alterações pendentes" />}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('integracoes')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-ui cursor-pointer shrink-0 ${
            abaAtiva === 'integracoes'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Zap className="w-4 h-4" />
          Integrações & Conexões
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('equipe')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-ui cursor-pointer shrink-0 ${
            abaAtiva === 'equipe'
              ? 'bg-primary text-primary-foreground shadow-2xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Users className="w-4 h-4" />
          Contatos & Acessos Portal
        </button>
      </div>

      {/* Aba 1: Geral & Contrato */}
      {abaAtiva === 'geral' && (
        <form onSubmit={salvar} className="flex flex-col gap-6 animate-in fade-in duration-150">
          <Secao titulo="Identificação">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nome" maxLength={120} required {...campo('nome')} />
              <Input label="Nicho" maxLength={120} placeholder="Ex.: Odontologia" {...campo('nicho')} />
              <Input
                label="Etapa do ciclo"
                maxLength={120}
                placeholder="Ex.: Onboarding, Produção dos conteúdos…"
                {...campo('etapa')}
              />
            </div>
            <fieldset>
              <legend className="text-xs font-bold text-muted-foreground mb-2">Cor</legend>
              <div className="flex flex-wrap gap-2.5">
                {CORES_CLIENTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => definir('cor', c)}
                    aria-label={`Cor ${c}`}
                    aria-pressed={form.cor === c}
                    className={`size-8 rounded-full border transition-transform cursor-pointer ${
                      form.cor === c ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border hover:scale-105'
                    }`}
                    style={{ backgroundColor: c, color: textoSobre(c) }}
                  />
                ))}
              </div>
            </fieldset>
          </Secao>

          <Secao
            titulo="Instagram Oficial"
            descricao="A conta do Instagram oficial deste cliente para automações, métricas e publicações automáticas."
          >
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl border border-border bg-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {contaAtual?.profile_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto externa (Instagram)
                    <img
                      src={contaAtual.profile_picture_url}
                      alt=""
                      className="size-12 rounded-full object-cover border border-border shrink-0 shadow-xs"
                    />
                  ) : (
                    <span className="size-12 rounded-full bg-accent border border-border inline-flex items-center justify-center text-muted-foreground shrink-0 shadow-xs">
                      <InstagramGlyph className="w-6 h-6" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground truncate">
                        {contaAtual ? `@${contaAtual.instagram_username ?? contaAtual.instagram_user_id}` : 'Nenhuma conta vinculada'}
                      </span>
                      <Badge variant={contaAtual ? 'success' : 'muted'} className="text-[10px]">
                        {contaAtual ? 'Conectado' : 'Sem vínculo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {contaAtual
                        ? 'Conta conectada via Meta e habilitada para agendamentos e automações.'
                        : 'Conecte o Instagram oficial diretamente via Meta para habilitar automações e métricas.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant={contaAtual ? 'secondary' : 'primary'}
                    onClick={() => conectarContaInstagram(clienteId)}
                    className="gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <InstagramGlyph className="w-3.5 h-3.5" />
                    {contaAtual ? 'Reconectar / Conectar Nova' : 'Conectar Conta do Instagram'}
                  </Button>
                </div>
              </div>

              <div>
                <Select label="Ou selecione uma conta já existente na agência" {...campo('instagram_account_id')}>
                  <option value="">Sem vínculo</option>
                  {contasDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      @{c.instagram_username ?? c.instagram_user_id}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Secao>

          <Secao titulo="Contrato e fiscal">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="CNPJ ou CPF" maxLength={32} {...campo('cnpj_cpf')} />
              <Input label="Responsável legal (para o contrato)" maxLength={160} {...campo('responsavel_legal')} />
              <Input label="CPF do responsável" maxLength={32} {...campo('cpf_responsavel')} />
              <Input label="Endereço" maxLength={300} {...campo('endereco')} />
              <Input
                label="Valor mensal (R$)"
                inputMode="decimal"
                placeholder="0,00"
                {...campo('valor_mensal')}
              />
              <Input
                label="Dia de vencimento"
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                {...campo('dia_vencimento')}
              />
              <Input label="Início do contrato" type="date" {...campo('contrato_inicio')} />
              <Input
                label="Duração (meses)"
                type="number"
                min={1}
                max={120}
                inputMode="numeric"
                {...campo('contrato_duracao_meses')}
              />
            </div>
          </Secao>

          <Secao titulo="Operação" descricao="O combinado mensal com o cliente.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Posts por mês" type="number" min={0} max={500} inputMode="numeric" {...campo('posts_mes')} />
              <Input label="Reels por mês" type="number" min={0} max={500} inputMode="numeric" {...campo('reels_mes')} />
              <Select label="Dia de revisão" {...campo('dia_revisao')}>
                <option value="">Sem dia fixo</option>
                {DIAS_SEMANA.map((dia, i) => (
                  <option key={dia} value={i}>
                    {dia}
                  </option>
                ))}
              </Select>
            </div>
          </Secao>

          <Secao titulo="Briefing e notas">
            <Textarea label="Briefing" rows={5} maxLength={10000} {...campo('briefing')} />
            <Textarea label="Concorrentes" rows={3} maxLength={2000} {...campo('concorrentes')} />
            <Textarea label="Observações" rows={3} maxLength={5000} {...campo('observacoes')} />
          </Secao>

          {erroForm && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erroForm}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {sujo && <span className="mr-auto text-xs font-semibold text-muted-foreground">Alterações não salvas</span>}
            <Button type="button" variant="ghost" disabled={!sujo || salvando} onClick={descartar}>
              Descartar
            </Button>
            <Button type="submit" loading={salvando} disabled={!sujo}>
              Salvar ficha
            </Button>
          </div>
        </form>
      )}

      {/* Aba 2: Integrações & Conexões */}
      {abaAtiva === 'integracoes' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <ConexaoInstagram
            clienteId={clienteId}
            clienteNome={cliente?.nome || nomeInicial}
            cliente={cliente}
            contaAtual={contaAtual}
            contasDisponiveis={contasDisponiveis}
            onAtualizouCliente={(c) => {
              setCliente(c);
              setForm(formDe(c));
            }}
            onAbrirConta={onAbrirConta}
            showToast={showToast}
          />

          <ConexaoWhatsApp
            clienteId={clienteId}
            clienteNome={cliente?.nome || nomeInicial}
            cliente={cliente}
            onAtualizouCliente={(c) => {
              setCliente(c);
              setForm(formDe(c));
            }}
            showToast={showToast}
          />

          <SecaoGoogleCalendar
            clienteId={clienteId}
            clienteNome={cliente?.nome || nomeInicial}
            showToast={showToast}
          />
        </div>
      )}

      {/* Aba 3: Contatos & Acessos Portal */}
      {abaAtiva === 'equipe' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <Contatos
            clienteId={clienteId}
            contatos={contatos}
            onMudou={setContatos}
            showToast={showToast}
          />

          <AcessosPortal
            clienteId={clienteId}
            clienteNome={cliente?.nome || nomeInicial}
            showToast={showToast}
          />
        </div>
      )}
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div>
        <h3 className="eyebrow text-muted-foreground">{titulo}</h3>
        {descricao && <p className="text-xs text-muted-foreground mt-1.5 max-w-prose">{descricao}</p>}
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------- contatos ---

function Contatos({
  clienteId,
  contatos,
  onMudou,
  showToast,
}: {
  clienteId: string;
  contatos: ClienteContato[];
  onMudou: (lista: ClienteContato[]) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [grupo, setGrupo] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    // O botão desabilita durante o envio, mas o Enter não passa por ele: sem esta
    // trava, dois Enters seguidos numa rede lenta criariam o contato duas vezes.
    if (adicionando) return;
    if (!nome.trim()) {
      setErro('Informe o nome do contato.');
      return;
    }
    setAdicionando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/contatos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cargo, telefone, email, e_grupo_whatsapp: grupo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Não foi possível adicionar.');
        return;
      }
      onMudou([...contatos, data.contato]);
      setNome('');
      setCargo('');
      setTelefone('');
      setEmail('');
      setGrupo(false);
    } catch {
      showToast('Erro de conexão ao adicionar o contato.', 'error');
    } finally {
      setAdicionando(false);
    }
  }

  async function remover(contato: ClienteContato) {
    if (!(await confirmDialog({ title: `Remover ${contato.nome}?`, description: 'O contato deixa de receber as mensagens de aprovação deste cliente.', confirmLabel: 'Remover contato', tone: 'destructive' }))) return;
    try {
      const res = await fetch(`/api/clientes/${clienteId}/contatos/${contato.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao remover.');
      }
      onMudou(contatos.filter((c) => c.id !== contato.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao remover.', 'error');
    }
  }

  // Enter num campo do contato adiciona o contato — sem enviar a ficha inteira.
  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionar();
    }
  }

  return (
    <Secao
      titulo="Contatos"
      descricao="Quem fala pelo cliente. Marque o grupo de WhatsApp: as mensagens de atualização vão para ele em vez do contato individual."
    >
      {contatos.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-background">
          {contatos.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{c.nome}</span>
                  {c.cargo && <span className="text-xs text-muted-foreground">{c.cargo}</span>}
                  {c.e_grupo_whatsapp && <Badge variant="success">Grupo de WhatsApp</Badge>}
                </div>
                {(c.telefone || c.email) && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[c.telefone, c.email].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remover(c)}
                aria-label={`Remover ${c.nome}`}
                className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4" onKeyDown={aoTeclar}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="contato-nome" label="Nome" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
          <Input id="contato-cargo" label="Cargo" maxLength={120} value={cargo} onChange={(e) => setCargo(e.target.value)} />
          <Input
            id="contato-telefone"
            label="Telefone / WhatsApp"
            maxLength={40}
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
          <Input
            id="contato-email"
            label="E-mail"
            type="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
            <Checkbox checked={grupo} onCheckedChange={(checked) => setGrupo(checked)} />
            É o grupo de WhatsApp do cliente
          </label>
          <Button type="button" size="sm" variant="secondary" className="ml-auto" loading={adicionando} onClick={adicionar}>
            <Plus className="w-3.5 h-3.5" />
            Adicionar contato
          </Button>
        </div>
        {erro && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {erro}
          </p>
        )}
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------- acessos portal ---

interface AcessoItem {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  ativo: boolean;
  criado_em: string;
}

function AcessosPortal({
  clienteId,
  clienteNome,
  showToast,
}: {
  clienteId: string;
  clienteNome: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [acessos, setAcessos] = useState<AcessoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [credencialGerada, setCredencialGerada] = useState<{ email: string; senha: string; nome: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Form states
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('Secretária / Atendimento');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const carregarAcessos = async () => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/acessos`);
      const data = await res.json();
      if (res.ok && data.acessos) {
        setAcessos(data.acessos);
      }
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarAcessos();
  }, [clienteId]);

  const abrirModalNovo = () => {
    setNome('');
    setEmail('');
    setCargo('Secretária / Atendimento');
    setSenha(`Clinica@${Math.random().toString(36).substring(2, 7).toUpperCase()}!`);
    setErro(null);
    setCredencialGerada(null);
    setCopiado(false);
    setModalAberto(true);
  };

  const handleCriarAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      setErro('Nome e e-mail são obrigatórios.');
      return;
    }
    setSalvando(true);
    setErro(null);

    try {
      const res = await fetch(`/api/clientes/${clienteId}/acessos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          cargo: cargo.trim(),
          password: senha.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Erro ao gerar acesso.');
        return;
      }

      showToast('Acesso criado com sucesso!', 'success');
      setCredencialGerada({
        email: email.trim().toLowerCase(),
        senha: data.senhaGerada || senha.trim(),
        nome: nome.trim(),
      });
      carregarAcessos();
    } catch {
      setErro('Erro de conexão ao criar acesso.');
    } finally {
      setSalvando(false);
    }
  };

  const copiarMensagemWhatsapp = () => {
    if (!credencialGerada) return;
    const texto = `Olá, ${credencialGerada.nome}!\n\nSeu acesso exclusivo ao CRM e gestão da conta *${clienteNome}* no GENSBot foi liberado.\n\n🔗 *Link de Acesso:* ${typeof window !== 'undefined' ? window.location.origin : 'https://allingens.vercel.app'}/login\n📧 *Login:* ${credencialGerada.email}\n🔑 *Senha:* ${credencialGerada.senha}\n\nNo painel você poderá acompanhar todos os contatos, leads de automações e cadastrar novos pacientes/clientes presencialmente ou por telefone.`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    showToast('Instruções copiadas para a área de transferência!', 'success');
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <Secao
      titulo="Acesso ao Portal (Secretária & Atendimento)"
      descricao="Permite que a secretária ou equipe do cliente acesse exclusivamente o CRM de Vendas e Contatos da sua conta, sem ver dados de outras empresas ou da agência."
    >
      {carregando ? (
        <p className="text-xs text-muted-foreground">Carregando acessos...</p>
      ) : acessos.length === 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-dashed border-border bg-accent/10">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" /> Nenhum acesso externo cadastrado
            </p>
            <p className="text-xs text-muted-foreground">
              Crie um login exclusivo para a secretária acompanhar pacientes e mover cards no funil.
            </p>
          </div>
          <Button type="button" size="sm" onClick={abrirModalNovo} className="gap-1.5 flex-shrink-0">
            <Key className="w-3.5 h-3.5" />
            Gerar Acesso de Secretária
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {acessos.map((a) => (
              <li key={a.id} className="flex items-center justify-between p-3.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0 border border-primary/20">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                      {a.nome}
                      <Badge variant="muted" className="text-xs py-0.5 px-2 font-normal">
                        {a.cargo || 'Secretária'}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={a.ativo ? 'success' : 'muted'} className="text-xs">
                    {a.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={abrirModalNovo} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Novo Acesso de Secretária
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Criação / Visualização de Credenciais */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Key className="w-4.5 h-4.5 text-primary" />
                {credencialGerada ? 'Acesso Criado com Sucesso!' : 'Gerar Acesso para o Cliente'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {credencialGerada
                  ? `Envie as instruções abaixo para ${credencialGerada.nome}.`
                  : `A secretária terá acesso restrito exclusivamente à conta de ${clienteNome}.`}
              </p>
            </div>

            {credencialGerada ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="text-xs space-y-0.5">
                    <span className="text-muted-foreground block font-medium">E-mail de Login:</span>
                    <span className="font-semibold text-foreground font-mono text-sm">{credencialGerada.email}</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <span className="text-muted-foreground block font-medium">Senha Provisória:</span>
                    <span className="font-semibold text-foreground font-mono text-sm">{credencialGerada.senha}</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <span className="text-muted-foreground block font-medium">Escopo Permitido:</span>
                    <span className="font-semibold text-primary">CRM de Vendas & Contatos ({clienteNome})</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button type="button" onClick={copiarMensagemWhatsapp} className="w-full gap-2">
                    {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiado ? 'Copiado para o WhatsApp!' : 'Copiar Mensagem Pronta para WhatsApp'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setModalAberto(false);
                      setCredencialGerada(null);
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCriarAcesso} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Nome da Pessoa *</label>
                  <Input
                    placeholder="Ex: Maria (Secretária)"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">E-mail de Acesso *</label>
                  <Input
                    type="email"
                    placeholder="secretaria@clinica.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Cargo / Função</label>
                    <Input
                      placeholder="Ex: Secretária"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Senha Inicial</label>
                    <Input
                      placeholder="Senha segura"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {erro && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {erro}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={salvando}
                    onClick={() => setModalAberto(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" loading={salvando} className="gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Criar Acesso
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------- conexao instagram ---

function ConexaoInstagram({
  clienteId,
  clienteNome,
  cliente,
  contaAtual,
  contasDisponiveis,
  onAtualizouCliente,
  onAbrirConta,
  showToast,
}: {
  clienteId: string;
  clienteNome: string;
  cliente: Cliente | null;
  contaAtual: ContaInstagramResumo | null;
  contasDisponiveis: ContaInstagramResumo[];
  onAtualizouCliente: (cliente: Cliente) => void;
  onAbrirConta: (destino: DestinoConta, instagramUserId: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [contaSelecionada, setContaSelecionada] = useState<string>(cliente?.instagram_account_id ?? '');
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    setContaSelecionada(cliente?.instagram_account_id ?? '');
  }, [cliente?.instagram_account_id]);

  async function handleSalvarVinculo(novaContaId: string | null) {
    setVinculando(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram_account_id: novaContaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erro ao alterar vínculo.', 'error');
        return;
      }
      onAtualizouCliente(data.cliente);
      showToast(novaContaId ? 'Conta do Instagram vinculada.' : 'Conta do Instagram desvinculada.', 'success');
    } catch {
      showToast('Erro de conexão ao alterar vínculo.', 'error');
    } finally {
      setVinculando(false);
    }
  }

  const estaConectado = Boolean(contaAtual);

  return (
    <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <InstagramGlyph className="w-5 h-5 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              Instagram Oficial ({clienteNome})
            </h4>
            <Badge variant={estaConectado ? 'success' : 'muted'} className="text-[10px]">
              {estaConectado ? 'Conectado' : 'Sem vínculo'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Conta oficial da Meta vinculada para postagens de carrossel/Reels, respostas em Direct e automações de comentários.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => conectarContaInstagram(clienteId)}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <InstagramGlyph className="w-3.5 h-3.5" />
            {estaConectado ? 'Reconectar / Trocar via Meta' : 'Conectar Conta do Instagram'}
          </Button>

          {contaAtual && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAbrirConta('publish', contaAtual.instagram_user_id)}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Operar Painel
            </Button>
          )}
        </div>
      </div>

      {/* Card da conta vinculada ou chamada para conexão */}
      {contaAtual ? (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {contaAtual.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto externa (Instagram)
              <img
                src={contaAtual.profile_picture_url}
                alt=""
                className="size-12 rounded-full object-cover border border-emerald-500/30 shrink-0 shadow-xs"
              />
            ) : (
              <span className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
                <InstagramGlyph className="w-6 h-6" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground truncate">
                  @{contaAtual.instagram_username ?? contaAtual.instagram_user_id}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  (ID: {contaAtual.instagram_user_id})
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permissões da Meta ativas para comentários, mensagens diretas e publicação automática.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={vinculando}
              onClick={() => handleSalvarVinculo(null)}
              className="text-xs text-destructive hover:bg-destructive/10"
            >
              Desvincular
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-border bg-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-foreground">
              Nenhuma conta do Instagram vinculada ainda
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique no botão acima para conectar diretamente via login oficial da Meta, ou selecione abaixo uma conta já existente na agência.
            </p>
          </div>
        </div>
      )}

      {/* Seleção de contas existentes na agência */}
      <div className="flex flex-col sm:flex-row items-end gap-3 pt-2 border-t border-border/60">
        <div className="flex-1 w-full">
          <Select
            label="Vincular a uma conta já conectada na agência:"
            value={contaSelecionada}
            onChange={(e) => setContaSelecionada(e.target.value)}
          >
            <option value="">Sem vínculo</option>
            {contasDisponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                @{c.instagram_username ?? c.instagram_user_id}
              </option>
            ))}
          </Select>
        </div>

        {contaSelecionada !== (cliente?.instagram_account_id ?? '') && (
          <Button
            type="button"
            size="sm"
            loading={vinculando}
            onClick={() => handleSalvarVinculo(contaSelecionada || null)}
            className="text-xs shrink-0"
          >
            Salvar Vínculo
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- conexao whatsapp ---

function ConexaoWhatsApp({
  clienteId,
  clienteNome,
  cliente,
  onAtualizouCliente,
  showToast,
}: {
  clienteId: string;
  clienteNome: string;
  cliente: Cliente | null;
  onAtualizouCliente: (cliente: Cliente) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  // Estados locais para grupo e notificação
  const [grupoId, setGrupoId] = useState(cliente?.whatsapp_grupo_id || '');
  const [notificarAgendamento, setNotificarAgendamento] = useState<boolean>(
    cliente?.whatsapp_notificar_agendamento ?? true
  );
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);
  const [testandoGrupo, setTestandoGrupo] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  // Informações do WhatsApp do membro logado (emissor das aprovações)
  const [membroWhatsApp, setMembroWhatsApp] = useState<{
    conectado: boolean;
    nome?: string | null;
    phone?: string | null;
  } | null>(null);

  // Modo manual / link de convite para grupo
  const [modoManualGrupo, setModoManualGrupo] = useState(false);
  const [linkOuJidManual, setLinkOuJidManual] = useState('');
  const [resolvendoLink, setResolvendoLink] = useState(false);

  // Lista dinâmica de grupos do WhatsApp da agência/membro
  const [gruposDisponiveis, setGruposDisponiveis] = useState<Array<{ id: string; name: string; participantsCount?: number }>>([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);

  const carregarGrupos = async (manual = false) => {
    setCarregandoGrupos(true);
    try {
      const res = await fetch(`/api/whatsapp/groups?cliente_id=${encodeURIComponent(clienteId)}`);
      const data = await res.json();
      if (res.ok) {
        setMembroWhatsApp({
          conectado: Boolean(data.membroConectado),
          nome: data.membroNome || null,
          phone: data.membroTelefone || null,
        });
        if (data.grupoConfigurado !== undefined && data.grupoConfigurado !== null) {
          setGrupoId(data.grupoConfigurado || '');
        }
        if (data.notificarAgendamento !== undefined) {
          setNotificarAgendamento(Boolean(data.notificarAgendamento));
        }
        if (Array.isArray(data.grupos)) {
          setGruposDisponiveis(data.grupos);
          if (manual) {
            if (data.grupos.length > 0) {
              showToast(`${data.grupos.length} grupo(s) carregados do seu WhatsApp!`, 'success');
            } else if (data.membroConectado) {
              showToast(
                'Nenhum grupo sincronizado no momento. Você pode colar o Link de Convite ou JID do grupo logo abaixo!',
                'error'
              );
            } else {
              showToast(
                'Seu WhatsApp não está conectado no Perfil. Conecte seu aparelho no Perfil primeiro para carregar seus grupos.',
                'error'
              );
            }
          }
        }
      } else if (manual) {
        showToast(data.error || 'Erro ao consultar grupos do WhatsApp.', 'error');
      }
    } catch {
      if (manual) showToast('Erro de conexão ao buscar grupos.', 'error');
    } finally {
      setCarregandoGrupos(false);
    }
  };

  const handleResolverLinkGrupo = async () => {
    const valor = linkOuJidManual.trim();
    if (!valor) {
      showToast('Cole o link do grupo (https://chat.whatsapp.com/...) ou o JID.', 'error');
      return;
    }

    if (valor.includes('@g.us')) {
      setGrupoId(valor);
      showToast('JID do grupo configurado! Agora clique em "Salvar Grupo".', 'success');
      setModoManualGrupo(false);
      return;
    }

    setResolvendoLink(true);
    try {
      const res = await fetch('/api/whatsapp/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link: valor,
          cliente_id: clienteId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.grupo?.id) {
        setGrupoId(data.grupo.id);
        setGruposDisponiveis((prev) => {
          if (prev.some((g) => g.id === data.grupo.id)) return prev;
          return [{ id: data.grupo.id, name: data.grupo.name, isGroup: true }, ...prev];
        });
        showToast(`Grupo "${data.grupo.name}" identificado e vinculado com sucesso!`, 'success');
        setModoManualGrupo(false);
      } else {
        showToast(data.error || 'Não foi possível identificar o grupo pelo link fornecido.', 'error');
      }
    } catch {
      showToast('Erro de rede ao validar convite do grupo.', 'error');
    } finally {
      setResolvendoLink(false);
    }
  };

  useEffect(() => {
    carregarGrupos();
  }, []);

  const handleDesconectarWhatsApp = async () => {
    if (
      !(await confirmDialog({
        title: `Desconectar WhatsApp de ${clienteNome}?`,
        description: 'A escuta ativa será pausada e o pareamento deste aparelho será desfeito até que um novo QR Code seja lido.',
        confirmLabel: 'Desconectar aparelho',
        tone: 'destructive',
      }))
    )
      return;

    setDesconectando(true);
    try {
      const res = await fetch(`/api/whatsapp/session?cliente_id=${encodeURIComponent(clienteId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSession((prev: any) => (prev ? { ...prev, status: 'desconectado', phone_number: null } : null));
        setQrCodeData(null);
        showToast('WhatsApp desconectado com sucesso.', 'success');
      } else {
        showToast('Erro ao desconectar WhatsApp.', 'error');
      }
    } catch {
      showToast('Erro de rede ao desconectar WhatsApp.', 'error');
    } finally {
      setDesconectando(false);
    }
  };

  useEffect(() => {
    if (cliente) {
      setGrupoId(cliente.whatsapp_grupo_id || '');
      setNotificarAgendamento(cliente.whatsapp_notificar_agendamento ?? true);
    }
  }, [cliente]);

  const carregarStatus = async (manual = false) => {
    if (manual) setSincronizando(true);
    try {
      const res = await fetch(`/api/whatsapp/session?cliente_id=${encodeURIComponent(clienteId)}`);
      const data = await res.json();
      if (res.ok && data.session) {
        setSession(data.session);
        if (data.session.status === 'conectado') {
          setQrCodeData(null);
        }
        if (manual) {
          if (data.session.status === 'conectado') {
            showToast('Conexão ativa e sincronizada com sucesso!', 'success');
          } else {
            showToast('Status sincronizado: ' + (data.session.status || 'desconectado'), 'success');
          }
        }
      }
    } catch {
      if (manual) showToast('Falha ao verificar status com o servidor.', 'error');
    } finally {
      setCarregando(false);
      if (manual) setSincronizando(false);
    }
  };

  useEffect(() => {
    carregarStatus();
    const interval = setInterval(() => {
      carregarStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [clienteId]);

  const handleConectar = async () => {
    setIniciando(true);
    setQrCodeData(null);
    try {
      const res = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        if (data.qrCode) {
          setQrCodeData(data.qrCode);
          showToast('QR Code gerado! Aponte o celular.', 'success');
        } else {
          const detalheTxt = data.detalhes?.erro || data.detalhes?.text || data.detalhes?.statusText || '';
          showToast(detalheTxt ? `OpenWA: ${detalheTxt}` : (data.mensagem || 'QR Code ainda não emitido. Verifique o log do OpenWA.'), 'error');
        }
      } else {
        showToast(data.error || 'Erro ao iniciar conexão com WhatsApp.', 'error');
      }
    } catch {
      showToast('Erro de rede ao conectar WhatsApp.', 'error');
    } finally {
      setIniciando(false);
    }
  };

  const handleSalvarConfigGrupo = async () => {
    if (!membroWhatsApp?.conectado) {
      showToast('Seu WhatsApp não está conectado no Perfil. Conecte primeiro no menu Perfil (barra lateral) para vincular seus grupos.', 'error');
      return;
    }
    setSalvandoGrupo(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_grupo_id: grupoId.trim() || null,
          whatsapp_notificar_agendamento: notificarAgendamento,
        }),
      });
      const data = await res.json();
      if (res.ok && data.cliente) {
        onAtualizouCliente(data.cliente);
        showToast('Configurações de avisos do WhatsApp salvas com sucesso para o seu usuário!', 'success');
      } else {
        showToast(data.error || 'Erro ao salvar grupo do WhatsApp.', 'error');
      }
    } catch {
      showToast('Erro de rede ao salvar configurações de grupo.', 'error');
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const handleTestarEnvioGrupo = async () => {
    if (!membroWhatsApp?.conectado) {
      showToast('Seu WhatsApp pessoal não está conectado no Perfil. Conecte no Perfil antes de testar.', 'error');
      return;
    }
    if (!grupoId.trim()) {
      showToast('Informe o ID ou JID do grupo antes de testar.', 'error');
      return;
    }
    setTestandoGrupo(true);
    try {
      const res = await fetch('/api/whatsapp/test-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          grupo_id: grupoId.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.mensagem || 'Mensagem de teste enviada com sucesso no grupo!', 'success');
      } else {
        showToast(data.error || 'Erro ao enviar mensagem no grupo.', 'error');
      }
    } catch {
      showToast('Erro de conexão ao testar grupo.', 'error');
    } finally {
      setTestandoGrupo(false);
    }
  };

  const statusFormatado = session?.status || 'desconectado';
  const estaConectado = statusFormatado === 'conectado';

  return (
    <Secao
      titulo="WhatsApp & Aprovações de Demandas"
      descricao="Configure o grupo de alinhamento com o cliente para envio de posts para aprovação e, opcionalmente, conecte o número da clínica para atendimento inteligente com IA."
    >
      {/* Bloco 1 (Principal): Grupo de WhatsApp para Notificações & Aprovações de Demandas */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Grupo de Alinhamento & Aprovação de Demandas
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Quando um post ou vídeo for movido de <b>"Revisão"</b> para <b>"Aprovação"</b> na Esteira de Conteúdo, o link interativo de aprovação será enviado automaticamente neste grupo para o cliente avaliar e aprovar.
            </p>
          </div>
          <Badge variant={grupoId ? 'success' : 'muted'} className="text-xs shrink-0">
            {grupoId ? 'Grupo Configurado' : 'Pendente de Configuração'}
          </Badge>
        </div>

        {/* Status do Emissor (WhatsApp pessoal do membro/designer logado) */}
        {membroWhatsApp?.conectado ? (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Seu WhatsApp está Conectado para Disparos
                  </span>
                  <Badge variant="success" className="text-[10px] py-0 px-1.5">
                    Emissor Ativo
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {membroWhatsApp.nome ? `${membroWhatsApp.nome} ` : ''}
                  {membroWhatsApp.phone ? `(+${membroWhatsApp.phone})` : ''} — As mensagens de aprovação das demandas sob sua responsabilidade sairão automaticamente do seu número.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground">
                  Seu WhatsApp pessoal ainda não está conectado no seu Perfil
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cada membro/designer conecta seu próprio aparelho no menu <b>Perfil (canto inferior esquerdo da barra lateral)</b>. Assim, suas demandas serão disparadas exclusivamente do seu número e grupos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Seleção do Grupo de WhatsApp */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              Grupo de WhatsApp com este Cliente:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => carregarGrupos(true)}
                disabled={carregandoGrupos}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${carregandoGrupos ? 'animate-spin' : ''}`} />
                {carregandoGrupos ? 'Buscando...' : 'Atualizar grupos'}
              </button>
              <span className="text-muted-foreground text-xs">•</span>
              <button
                type="button"
                onClick={() => setModoManualGrupo(!modoManualGrupo)}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium cursor-pointer"
              >
                {modoManualGrupo ? 'Escolher da lista' : 'Colar link de convite ou JID'}
              </button>
            </div>
          </div>

          {!modoManualGrupo && gruposDisponiveis.length > 0 ? (
            <div className="space-y-2">
              <Select
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                className="text-xs w-full"
              >
                <option value="">Selecione um grupo do seu WhatsApp...</option>
                {gruposDisponiveis.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.participantsCount ? `(${g.participantsCount} membros)` : ''}
                  </option>
                ))}
              </Select>
              {grupoId && (
                <p className="text-[11px] text-muted-foreground font-mono">
                  JID Selecionado: {grupoId}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Cole o link do grupo (https://chat.whatsapp.com/...) ou o JID (ex: 12036302482394@g.us)"
                    value={linkOuJidManual}
                    onChange={(e) => setLinkOuJidManual(e.target.value)}
                    className="text-xs font-mono pr-8"
                  />
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={resolvendoLink}
                  onClick={handleResolverLinkGrupo}
                  className="text-xs gap-1.5 shrink-0"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Vincular Grupo
                </Button>
              </div>

              {grupoId && (
                <div className="p-2.5 rounded-lg bg-muted/60 border border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Grupo atualmente vinculado:</span>
                  <span className="font-mono font-semibold text-foreground">{grupoId}</span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Dica: Você pode copiar o link do grupo no WhatsApp em <i>Dados do grupo &gt; Convidar via link</i> e colar aqui.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notificarAgendamento}
                onChange={(e) => setNotificarAgendamento(e.target.checked)}
                className="rounded border-input text-primary focus:ring-ring w-4 h-4"
              />
              <span className="text-xs text-foreground font-medium">
                Disparar link de aprovação automaticamente no grupo ao mover card para "Aprovação"
              </span>
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={testandoGrupo}
                onClick={handleTestarEnvioGrupo}
                disabled={!grupoId.trim()}
                className="gap-1.5 text-xs"
              >
                <Send className="w-3.5 h-3.5" />
                Testar Envio no Grupo
              </Button>

              <Button
                type="button"
                size="sm"
                loading={salvandoGrupo}
                onClick={handleSalvarConfigGrupo}
                className="gap-1.5 text-xs"
              >
                Salvar Grupo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 2: WhatsApp Comercial do Cliente (Opcional - Atendimento IA / SDR da Clínica) */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-bold text-foreground">
                WhatsApp Comercial da Empresa ({clienteNome})
              </h4>
              <Badge variant="muted" className="text-[10px]">
                Opcional • Atendimento IA
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Conexão exclusiva caso a clínica deste cliente utilize o <b>Atendente Virtual por IA (SDR)</b>.
              <span className="text-foreground font-medium"> Não é necessário conectar seu celular aqui para as aprovações da agência.</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={sincronizando}
              onClick={() => carregarStatus(true)}
              title="Verificar status agora"
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sincronizar
            </Button>

            <Button
              type="button"
              size="sm"
              variant={estaConectado ? 'secondary' : 'outline'}
              loading={iniciando}
              onClick={handleConectar}
              className="gap-1.5 text-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              {estaConectado ? 'Novo QR Code' : 'Gerar QR Code da Empresa'}
            </Button>

            {estaConectado && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={desconectando}
                onClick={handleDesconectarWhatsApp}
                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                title="Desconectar este aparelho da clínica"
              >
                <LogOut className="w-3.5 h-3.5" />
                Desconectar
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Status do WhatsApp da empresa:</span>
          <Badge variant={estaConectado ? 'success' : 'muted'} className="text-[11px]">
            {estaConectado
              ? `Conectado ${session?.phone_number ? `(+${session.phone_number})` : ''}`
              : 'Desconectado (Sem atendimento IA)'}
          </Badge>
        </div>

        {/* Exibição do QR Code da clínica quando retornado */}
        {qrCodeData && !estaConectado && (
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" /> Aponte a câmera do WhatsApp da empresa/clínica:
            </p>
            <div className="p-4 bg-white rounded-2xl shadow-md border border-border">
              {qrCodeData.startsWith('data:image') ? (
                <img src={qrCodeData} alt="QR Code WhatsApp" className="w-52 h-52 object-contain" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-center p-3 text-xs text-muted-foreground font-mono break-all">
                  {qrCodeData}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Abra o WhatsApp comercial da clínica no celular &gt; Aparelhos conectados &gt; Conectar um aparelho.
            </p>
          </div>
        )}
      </div>

      {/* Bloco 3: Régua Inteligente Anti-Vácuo de Leads */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-foreground">
              Régua Inteligente Anti-Vácuo de Leads (Follow-up Automático)
            </h4>
          </div>
          <Badge variant="success" className="text-xs">
            Proteção Ativa
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Quando a secretária envia uma mensagem e o paciente não responde, o GENSBot assume as tentativas de contato em momentos estratégicos:
        </p>

        <div className="grid gap-3 sm:grid-cols-3 pt-1">
          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              1ª Tentativa (+3 horas)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Lembrete sutil e amigável perguntando se o lead conseguiu ler a mensagem anterior.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              2ª Tentativa (+8 horas)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aviso de organização de agenda oferecendo opções de horário antes que as vagas fechem.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Clock className="w-3.5 h-3.5 text-primary" />
              3ª Tentativa (+48 horas)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Resgate educado deixando a porta aberta sem parecer invasivo ou insistente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1">
          <Check className="w-4 h-4" />
          <span><b>Regra de Ouro:</b> Assim que o paciente enviar qualquer resposta, todas as mensagens pendentes são canceladas imediatamente no banco de dados.</span>
        </div>
      </div>
    </Secao>
  );
}

// ---------------------------------------------------------------- secao google calendar ---

function SecaoGoogleCalendar({
  clienteId,
  clienteNome,
  showToast,
}: {
  clienteId: string;
  clienteNome: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [conectado, setConectado] = useState(false);
  const [integracao, setIntegracao] = useState<any>(null);
  const [configuradoNoServidor, setConfiguradoNoServidor] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [desconectando, setDesconectando] = useState(false);
  const [testandoEvento, setTestandoEvento] = useState(false);
  const [ultimoEventoLink, setUltimoEventoLink] = useState<string | null>(null);

  // Seleção de calendário da conta
  const [calendarios, setCalendarios] = useState<Array<{ id: string; summary: string; primary?: boolean }>>([]);
  const [calendarioSelecionado, setCalendarioSelecionado] = useState('primary');
  const [salvandoCalendario, setSalvandoCalendario] = useState(false);

  const carregarStatus = async () => {
    try {
      const res = await fetch(`/api/integrations/google-calendar/status?cliente_id=${encodeURIComponent(clienteId)}`);
      const data = await res.json();
      if (res.ok) {
        setConectado(Boolean(data.conectado));
        setIntegracao(data.integracao || null);
        setConfiguradoNoServidor(Boolean(data.configuradoNoServidor));
        if (data.conectado) {
          carregarCalendarios();
        }
      }
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  };

  const carregarCalendarios = async () => {
    try {
      const res = await fetch(`/api/integrations/google-calendar/calendars?cliente_id=${encodeURIComponent(clienteId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.calendarios)) {
        setCalendarios(data.calendarios);
        if (data.selecionado) {
          setCalendarioSelecionado(data.selecionado);
        }
      }
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    carregarStatus();

    // Captura feedback de retorno da autenticação do Google
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const statusGoogle = params.get('google_calendar');
      if (statusGoogle === 'conectado') {
        showToast('Google Agenda conectada com sucesso!', 'success');
        window.history.replaceState({}, '', window.location.pathname);
        carregarStatus();
      } else if (statusGoogle === 'erro') {
        const motivo = params.get('motivo') || 'Falha na autorização';
        showToast(`Erro ao conectar Google Agenda: ${motivo}`, 'error');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [clienteId]);

  const handleConectar = () => {
    window.location.href = `/api/integrations/google-calendar/auth?cliente_id=${encodeURIComponent(clienteId)}`;
  };

  const handleTrocarCalendario = async (novoCalendarId: string) => {
    setCalendarioSelecionado(novoCalendarId);
    setSalvandoCalendario(true);
    try {
      const res = await fetch('/api/integrations/google-calendar/calendars', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          calendar_id: novoCalendarId,
        }),
      });
      if (res.ok) {
        showToast('Agenda de destino atualizada!', 'success');
      } else {
        showToast('Erro ao trocar agenda de destino.', 'error');
      }
    } catch {
      showToast('Erro de rede ao trocar agenda.', 'error');
    } finally {
      setSalvandoCalendario(false);
    }
  };

  const handleTestarEvento = async () => {
    setTestandoEvento(true);
    try {
      const res = await fetch('/api/integrations/google-calendar/test-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setUltimoEventoLink(data.htmlLink || null);
        showToast('Consulta de teste inserida com sucesso no Google Calendar!', 'success');
      } else {
        showToast(data.error || 'Falha ao criar evento de teste.', 'error');
      }
    } catch {
      showToast('Erro de rede ao criar evento de teste.', 'error');
    } finally {
      setTestandoEvento(false);
    }
  };

  const handleDesconectar = async () => {
    if (
      !(await confirmDialog({
        title: `Desconectar Google Agenda de ${clienteNome}?`,
        description: 'Os novos agendamentos do CRM deixarão de ser sincronizados com esta conta do Google até que uma nova conexão seja realizada.',
        confirmLabel: 'Desconectar Agenda',
        tone: 'destructive',
      }))
    )
      return;

    setDesconectando(true);
    try {
      const res = await fetch(`/api/integrations/google-calendar/status?cliente_id=${encodeURIComponent(clienteId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConectado(false);
        setIntegracao(null);
        setCalendarios([]);
        setUltimoEventoLink(null);
        showToast('Google Agenda desconectada com sucesso.', 'success');
      } else {
        showToast('Erro ao desconectar Google Agenda.', 'error');
      }
    } catch {
      showToast('Erro de rede ao desconectar.', 'error');
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <Secao
      titulo="Google Agenda (Sincronização de Consultas & Horários)"
      descricao="Conecta o Google Calendar da clínica para sincronizar consultas automaticamente, consultar horários ocupados e evitar choque de agenda."
    >
      {/* Bloco de Status e Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors ${
              conectado
                ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                {conectado
                  ? `Google Agenda Conectada (${integracao?.email || clienteNome})`
                  : 'Google Agenda Desconectada'}
              </span>
              <Badge variant={conectado ? 'success' : 'muted'} className="text-xs">
                {conectado ? 'Sincronização Ativa' : 'Não Vinculado'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {conectado
                ? `Consultas agendadas pelo CRM ou pela IA são criadas automaticamente na agenda de ${integracao?.email || 'destino'}.`
                : 'Conecte a conta do Google da clínica para que a IA e o CRM criem e consultem os eventos na agenda.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {conectado ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={testandoEvento}
                onClick={handleTestarEvento}
                className="gap-1.5 text-xs"
                title="Criar evento de teste de 30 minutos na agenda"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Criar Evento Teste
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleConectar}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Conectar com outro e-mail do Google"
              >
                Trocar Conta
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={desconectando}
                onClick={handleDesconectar}
                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Desconectar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleConectar}
              className="gap-1.5 text-xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              Conectar Google Agenda
            </Button>
          )}
        </div>
      </div>

      {/* Se estiver conectado: Opções de Multi-Calendário e Link do Evento Criado */}
      {conectado && (
        <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Agenda de Destino das Consultas
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Se a médica possui agendas separadas (ex: consultas, cirurgias ou pessoal), selecione qual agenda receberá as marcações:
              </p>
            </div>

            {calendarios.length > 1 ? (
              <div className="w-full sm:w-64">
                <Select
                  value={calendarioSelecionado}
                  onChange={(e) => handleTrocarCalendario(e.target.value)}
                  disabled={salvandoCalendario}
                  className="text-xs"
                >
                  {calendarios.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary} {cal.primary ? '(Principal)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <Badge variant="muted" className="text-xs">
                Agenda Principal Ativa
              </Badge>
            )}
          </div>

          {ultimoEventoLink && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs animate-in fade-in duration-150">
              <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                Evento de teste inserido com sucesso na agenda!
              </span>
              <a
                href={ultimoEventoLink}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-semibold flex items-center gap-1"
              >
                Abrir no Google Calendar
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {!configuradoNoServidor && (
        <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 text-xs text-muted-foreground">
          ⚠️ <b>Configuração no Google Cloud necessária:</b> Para que o botão abra a tela de login do Google, adicione as variáveis <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> nas variáveis de ambiente da Vercel.
        </div>
      )}
    </Secao>
  );
}




