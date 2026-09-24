'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Plus, Search, ShieldAlert } from 'lucide-react';
import { Instagram as InstagramGlyph } from '@/components/instagram-icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ClienteAvatar } from '@/components/cliente-avatar';
import ClienteFicha from '@/components/cliente-ficha';
import {
  CORES_CLIENTE,
  corPadraoDoCliente,
  textoSobre,
  type Cliente,
  type ContaInstagramResumo,
  type DestinoConta,
} from '@/lib/clientes';

interface ClientesTabProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  onAbrirConta: (destino: DestinoConta, instagramUserId: string) => void;
}

/** Busca sem acento e sem diferença de caixa: "clinica" acha "Clínica". */
function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type Carga =
  | { tipo: 'ok'; clientes: Cliente[]; contas: ContaInstagramResumo[] }
  | { tipo: 'sem-acesso'; mensagem: string }
  | { tipo: 'erro'; mensagem: string };

// Sempre traz os arquivados: uma conta vinculada a um cliente arquivado continua
// ocupada (a unicidade vale no banco), então precisamos saber quais são.
// Função pura de rede — não mexe em estado, por isso pode rodar dentro de um efeito.
async function buscarClientes(): Promise<Carga> {
  try {
    const res = await fetch('/api/clientes?arquivados=1');
    const data = await res.json();
    if (res.status === 403) {
      return { tipo: 'sem-acesso', mensagem: data.error || 'Seu acesso à agência ainda não foi aprovado.' };
    }
    if (!res.ok) return { tipo: 'erro', mensagem: data.error || 'Falha ao carregar clientes.' };
    return { tipo: 'ok', clientes: data.clientes, contas: data.contas };
  } catch {
    return { tipo: 'erro', mensagem: 'Erro de conexão ao carregar clientes.' };
  }
}

export default function ClientesTab({ showToast, onAbrirConta }: ClientesTabProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contas, setContas] = useState<ContaInstagramResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroAcesso, setErroAcesso] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [chaveNovo, setChaveNovo] = useState(0);
  const [importando, setImportando] = useState(false);

  // O showToast do page.tsx é recriado a cada render. Se entrasse nas dependências
  // do efeito abaixo, a lista seria buscada de novo a cada re-render do pai.
  const toastRef = useRef(showToast);
  useEffect(() => {
    toastRef.current = showToast;
  }, [showToast]);

  const aplicarCarga = useCallback((carga: Carga) => {
    if (carga.tipo === 'ok') {
      setErroAcesso(null);
      setClientes(carga.clientes);
      setContas(carga.contas);
    } else if (carga.tipo === 'sem-acesso') {
      setErroAcesso(carga.mensagem);
    } else {
      toastRef.current(carga.mensagem, 'error');
    }
    setCarregando(false);
  }, []);

  // Recarga disparada por ações do usuário (nunca por efeito).
  const carregar = useCallback(async () => {
    aplicarCarga(await buscarClientes());
  }, [aplicarCarga]);

  useEffect(() => {
    let ativo = true;
    buscarClientes().then((carga) => {
      if (ativo) aplicarCarga(carga);
    });
    return () => {
      ativo = false;
    };
  }, [aplicarCarga]);

  // Rola para o topo quando o usuário abre ou fecha a ficha de um cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.querySelectorAll('main, body, html, [data-scroll-container]').forEach((el) => {
        el.scrollTop = 0;
      });
    }
  }, [selecionadoId]);

  // Cada abertura ganha uma key nova: o formulário nasce zerado, sem efeito de reset.
  function abrirNovo() {
    setChaveNovo((k) => k + 1);
    setNovoAberto(true);
  }

  const contaPorId = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  const contasLivres = useMemo(() => {
    const ocupadas = new Set(clientes.map((c) => c.instagram_account_id).filter(Boolean));
    return contas.filter((c) => !ocupadas.has(c.id));
  }, [clientes, contas]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return clientes.filter((c) => {
      if (!mostrarArquivados && !c.ativo) return false;
      if (!termo) return true;
      const handle = contaPorId.get(c.instagram_account_id ?? '')?.instagram_username ?? '';
      return normalizar(`${c.nome} ${c.nicho ?? ''} ${handle}`).includes(termo);
    });
  }, [clientes, busca, mostrarArquivados, contaPorId]);

  const arquivadosCount = clientes.filter((c) => !c.ativo).length;

  async function criarAPartirDasContas() {
    if (contasLivres.length === 0) return;
    const ok = confirm(
      `Criar ${contasLivres.length} cliente${contasLivres.length > 1 ? 's' : ''} a partir das contas do Instagram ainda sem cliente?\n\n` +
        'Cada um leva o @ da conta como nome — você renomeia depois na ficha.'
    );
    if (!ok) return;

    setImportando(true);
    let criados = 0;
    let falhas = 0;
    for (const conta of contasLivres) {
      const nome = conta.instagram_username ? `@${conta.instagram_username}` : `Conta ${conta.instagram_user_id}`;
      try {
        const res = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, cor: corPadraoDoCliente(nome), instagram_account_id: conta.id }),
        });
        if (res.ok) criados++;
        else falhas++;
      } catch {
        falhas++;
      }
    }
    setImportando(false);
    await carregar();
    if (falhas === 0) showToast(`${criados} cliente${criados > 1 ? 's criados' : ' criado'}.`, 'success');
    else showToast(`${criados} criado(s), ${falhas} com falha. Tente de novo para as restantes.`, 'error');
  }

  // ---------------------------------------------------------- detalhe ---
  if (selecionadoId) {
    const atual = clientes.find((c) => c.id === selecionadoId);
    return (
      <ClienteFicha
        clienteId={selecionadoId}
        nomeInicial={atual?.nome ?? ''}
        contas={contas}
        clientes={clientes}
        showToast={showToast}
        onAbrirConta={onAbrirConta}
        onVoltar={() => {
          setSelecionadoId(null);
          carregar();
        }}
      />
    );
  }

  // ------------------------------------------------------- sem acesso ---
  if (erroAcesso) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto">
        <EmptyState icon={ShieldAlert} title="Acesso pendente" description={erroAcesso} />
      </div>
    );
  }

  // ------------------------------------------------------------ lista ---
  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Buscar cliente"
            placeholder="Buscar por nome, nicho ou @…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        {arquivadosCount > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarArquivados}
              onChange={(e) => setMostrarArquivados(e.target.checked)}
              className="size-4 accent-primary"
            />
            Mostrar arquivados ({arquivadosCount})
          </label>
        )}
        <Button className="sm:ml-auto" onClick={abrirNovo}>
          <Plus className="w-4 h-4" />
          Novo cliente
        </Button>
      </div>

      {!carregando && contasLivres.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="eyebrow text-muted-foreground">Contas conectadas</p>
            <p className="mt-1.5 text-sm text-foreground">
              {contasLivres.length === 1
                ? '1 conta do Instagram do GENSBot ainda não tem cliente.'
                : `${contasLivres.length} contas do Instagram do GENSBot ainda não têm cliente.`}
            </p>
          </div>
          <Button variant="secondary" size="sm" loading={importando} onClick={criarAPartirDasContas}>
            Criar clientes a partir delas
          </Button>
        </div>
      )}

      {carregando ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando clientes">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-36 animate-pulse" />
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        clientes.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Nenhum cliente ainda"
            description="Cada cliente reúne ficha, contrato, contatos e, quando há uma conta do Instagram vinculada, as automações dela."
            action={{ label: 'Criar o primeiro cliente', icon: Plus, onClick: abrirNovo }}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Nada encontrado"
            description="Nenhum cliente combina com a busca. Tente outro termo."
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((c) => {
            const conta = contaPorId.get(c.instagram_account_id ?? '');
            const posts = c.posts_mes ?? 0;
            const reels = c.reels_mes ?? 0;
            return (
              <Card
                key={c.id}
                interactive
                role="button"
                tabIndex={0}
                aria-label={`Abrir ${c.nome}`}
                onClick={() => setSelecionadoId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelecionadoId(c.id);
                  }
                }}
                className={`group flex flex-col justify-between gap-4 p-5 bg-card hover:bg-card/95 border border-border/80 hover:border-foreground/20 rounded-2xl shadow-2xs hover:shadow-sm transition-all duration-200 ${
                  c.ativo ? '' : 'opacity-60 bg-muted/30'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="relative">
                    <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={conta?.profile_picture_url} tamanho="md" className="ring-2 ring-background shadow-2xs" />
                    {c.ativo && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-lime border-2 border-card" title="Cliente Ativo" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold font-display text-foreground group-hover:text-primary transition-colors">{c.nome}</h3>
                    </div>
                    {c.nicho ? (
                      <p className="truncate text-xs text-muted-foreground mt-0.5 font-medium">{c.nicho}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 italic mt-0.5">Sem nicho definido</p>
                    )}
                  </div>
                  {!c.ativo && <Badge variant="muted" className="text-[10px]">Arquivado</Badge>}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    <InstagramGlyph className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {conta ? `@${conta.instagram_username ?? conta.instagram_user_id}` : 'Sem Instagram'}
                    </span>
                  </span>
                  {conta ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrirConta('publish', conta.instagram_user_id);
                      }}
                      className="h-7 text-[11px] font-bold px-2.5 rounded-xl bg-primary/15 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground transition-all shrink-0 cursor-pointer shadow-2xs font-display"
                    >
                      🎯 Operar Painel
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50 font-mono">Sem conta</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NovoClienteSheet
        aberto={novoAberto}
        chave={chaveNovo}
        contasLivres={contasLivres}
        onFechar={() => setNovoAberto(false)}
        onCriado={(cliente) => {
          setNovoAberto(false);
          setClientes((atual) => [...atual, cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
          showToast(`${cliente.nome} criado.`, 'success');
          setSelecionadoId(cliente.id);
        }}
        showToast={showToast}
      />
    </div>
  );
}

// ------------------------------------------------------------- novo cliente ---

interface NovoClienteProps {
  contasLivres: ContaInstagramResumo[];
  onFechar: () => void;
  onCriado: (cliente: Cliente) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

function NovoClienteSheet({ aberto, chave, ...resto }: NovoClienteProps & { aberto: boolean; chave: number }) {
  return (
    <Sheet open={aberto} onClose={resto.onFechar} aria-label="Novo cliente" className="w-full max-w-md">
      <NovoClienteForm key={chave} {...resto} />
    </Sheet>
  );
}

function NovoClienteForm({ contasLivres, onFechar, onCriado, showToast }: NovoClienteProps) {
  const [nome, setNome] = useState('');
  const [nicho, setNicho] = useState('');
  const [contaId, setContaId] = useState('');
  const [cor, setCor] = useState<string>(CORES_CLIENTE[1]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, nicho, cor, instagram_account_id: contaId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Não foi possível criar o cliente.');
        return;
      }
      onCriado(data.cliente);
    } catch {
      showToast('Erro de conexão ao criar o cliente.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <form onSubmit={salvar} className="flex flex-col gap-5 p-6">
        <div>
          <p className="eyebrow text-muted-foreground">Clientes</p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight">Novo cliente</h3>
        </div>

        <Input
          id="novo-cliente-nome"
          label="Nome"
          placeholder="Ex.: Clínica Vitta"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
          maxLength={120}
          required
        />
        <Input
          id="novo-cliente-nicho"
          label="Nicho"
          placeholder="Ex.: Odontologia"
          value={nicho}
          onChange={(e) => setNicho(e.target.value)}
          maxLength={120}
        />

        <Select
          id="novo-cliente-conta"
          label="Conta do Instagram (GENSBot)"
          value={contaId}
          onChange={(e) => setContaId(e.target.value)}
        >
          <option value="">Sem vínculo por enquanto</option>
          {contasLivres.map((c) => (
            <option key={c.id} value={c.id}>
              @{c.instagram_username ?? c.instagram_user_id}
            </option>
          ))}
        </Select>

        <fieldset>
          <legend className="text-xs font-bold text-muted-foreground mb-2">Cor</legend>
          <div className="flex flex-wrap gap-2.5">
            {CORES_CLIENTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                className={`size-8 rounded-full border transition-transform cursor-pointer ${
                  cor === c ? 'border-foreground scale-110 ring-2 ring-foreground/20' : 'border-border hover:scale-105'
                }`}
                style={{ backgroundColor: c, color: textoSobre(c) }}
              />
            ))}
          </div>
        </fieldset>

        {erro && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Button type="button" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" loading={salvando}>
            Criar cliente
          </Button>
        </div>
      </form>
    </>
  );
}
