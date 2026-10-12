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

  // --------------------------------------------------------------- estados ---
  if (carregando) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando cliente">
        <p className="text-sm font-semibold text-muted-foreground">{nomeInicial}</p>
        <Card className="h-40 animate-pulse" />
        <Card className="h-64 animate-pulse" />
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
      <Card padding="lg" className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <ClienteAvatar
            nome={form.nome || cliente.nome}
            cor={form.cor || null}
            fotoUrl={contaAtual?.profile_picture_url}
            tamanho="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-semibold tracking-tight truncate">{cliente.nome}</h2>
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

      <form onSubmit={salvar} className="flex flex-col gap-6">
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
          titulo="Instagram"
          descricao="A conta conectada ao GENSBot que pertence a este cliente. Cada conta vale para um cliente só."
        >
          <div className="flex items-center gap-4">
            {contaAtual?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto externa (Instagram)
              <img src={contaAtual.profile_picture_url} alt="" className="size-12 rounded-full object-cover border border-border" />
            ) : (
              <span className="size-12 rounded-full bg-accent border border-border inline-flex items-center justify-center text-muted-foreground">
                <InstagramGlyph className="w-5 h-5" />
              </span>
            )}
            <div className="flex-1">
              <Select label="Conta vinculada" {...campo('instagram_account_id')}>
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

        <div className="flex items-center justify-end gap-3">
          {sujo && <span className="mr-auto text-xs font-semibold text-muted-foreground">Alterações não salvas</span>}
          <Button type="button" variant="ghost" disabled={!sujo || salvando} onClick={descartar}>
            Descartar
          </Button>
          <Button type="submit" loading={salvando} disabled={!sujo}>
            Salvar ficha
          </Button>
        </div>
      </form>

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

      <ConexaoWhatsApp
        clienteId={clienteId}
        clienteNome={cliente?.nome || nomeInicial}
        showToast={showToast}
      />
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
                      <Badge variant="muted" className="text-[10px] py-0 px-1.5 font-normal">
                        {a.cargo || 'Secretária'}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={a.ativo ? 'success' : 'muted'} className="text-[10px]">
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
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                  <div className="text-xs">
                    <span className="text-muted-foreground block text-[11px]">E-mail de Login:</span>
                    <span className="font-semibold text-foreground font-mono">{credencialGerada.email}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground block text-[11px]">Senha Provisória:</span>
                    <span className="font-semibold text-foreground font-mono">{credencialGerada.senha}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground block text-[11px]">Escopo Permitido:</span>
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

// ---------------------------------------------------------------- conexao whatsapp ---

function ConexaoWhatsApp({
  clienteId,
  clienteNome,
  showToast,
}: {
  clienteId: string;
  clienteNome: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [gatewayConfigurado, setGatewayConfigurado] = useState(false);

  const carregarStatus = async () => {
    try {
      const res = await fetch(`/api/whatsapp/session?cliente_id=${encodeURIComponent(clienteId)}`);
      const data = await res.json();
      if (res.ok && data.session) {
        setSession(data.session);
      }
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarStatus();
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
        setGatewayConfigurado(Boolean(data.gatewayConfigurado));
        if (data.qrCode) {
          setQrCodeData(data.qrCode);
          showToast('QR Code gerado! Aponte o celular.', 'success');
        } else {
          showToast(data.mensagem || 'Aguardando inicialização da sessão. Tente novamente em alguns segundos.', 'warning');
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

  const statusFormatado = session?.status || 'desconectado';
  const estaConectado = statusFormatado === 'conectado';

  return (
    <Secao
      titulo="WhatsApp Copiloto (Escuta Ativa do WhatsApp Web)"
      descricao="Conecta o WhatsApp da clínica via QR Code para permitir que a IA leia as mensagens em segundo plano, crie cards e atualize o CRM automaticamente sem risco de bloqueio."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
              estaConectado
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
          >
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                {estaConectado ? `WhatsApp Conectado (${session?.phone_number || clienteNome})` : 'WhatsApp Desconectado'}
              </span>
              <Badge variant={estaConectado ? 'success' : 'muted'} className="text-[10px]">
                {estaConectado ? 'Escuta Ativa Ligada' : 'Aguardando Leitura'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {estaConectado
                ? 'A secretária pode atender normalmente. A IA está lendo os agendamentos e atualizando o CRM.'
                : 'Clique no botão ao lado para gerar o QR Code de pareamento do celular da clínica.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant={estaConectado ? 'secondary' : 'primary'}
          loading={iniciando}
          onClick={handleConectar}
          className="gap-1.5 flex-shrink-0"
        >
          <QrCode className="w-3.5 h-3.5" />
          {estaConectado ? 'Reconectar / Atualizar' : 'Gerar QR Code'}
        </Button>
      </div>

      {/* Exibição do QR Code quando retornado */}
      {qrCodeData && (
        <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-primary/30 bg-primary/5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-primary" /> Aponte a câmera do WhatsApp da clínica:
          </p>
          <div className="p-3 bg-white rounded-xl shadow-md border border-border">
            {qrCodeData.startsWith('data:image') ? (
              <img src={qrCodeData} alt="QR Code WhatsApp" className="w-48 h-48 object-contain" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-center p-2 text-xs text-muted-foreground font-mono break-all">
                {qrCodeData}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground text-center max-w-sm">
            Abra o WhatsApp no celular da clínica &gt; Menu (três pontinhos ou Ajustes) &gt; Aparelhos conectados &gt; Conectar um aparelho.
          </p>
        </div>
      )}
    </Secao>
  );
}


