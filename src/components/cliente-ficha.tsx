'use client';

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

  function voltar() {
    if (sujo && !confirm('Há alterações não salvas nesta ficha. Sair mesmo assim?')) return;
    onVoltar();
  }

  async function alternarArquivado() {
    if (!cliente) return;
    const arquivar = cliente.ativo;
    if (
      arquivar &&
      !confirm(`Arquivar ${cliente.nome}? Ele some da lista principal, mas nada é apagado e dá para restaurar.`)
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
    if (!confirm(`Remover o contato ${contato.nome}?`)) return;
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
            <input
              type="checkbox"
              checked={grupo}
              onChange={(e) => setGrupo(e.target.checked)}
              className="size-4 accent-primary"
            />
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
