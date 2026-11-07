'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clapperboard,
  Clock,
  Copy,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Info,
  Palette,
  CalendarClock,
  SearchCheck,
  MessageSquare,
  Pencil,
  Smartphone,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedItem } from '@/components/ui/segmented';
import { toast } from '@/components/ui/toast';
import { InstagramCarrosselPreview } from '@/components/aprovacao/instagram-carrossel-preview';
import { InstagramReelsPreview } from '@/components/aprovacao/instagram-reels-preview';
import { InstagramStoryPreview } from '@/components/aprovacao/instagram-story-preview';
import { cn } from '@/lib/utils';
import { ETAPAS_PROCESSO, indiceDaEtapa, itemNoFiltro, type FiltroMes, type ItemDoMes } from '@/lib/link-do-mes';
import { podeSugerirCampo, type CampoSugestao } from '@/lib/sugestoes-texto';
import { blocosDoRoteiro, partesNegrito, roteiroComoTextoPuro, ROTULO_FORMATO, type FormatoPost } from '@/lib/roteiro-cliente';

interface Dados {
  cliente: { nome: string; cor: string | null; nicho: string | null; foto_url: string | null; usuario: string | null };
  mes: string;
  meses: { mes: string; total: number }[];
  itens: ItemDoMes[];
  contagem: { para_voce: number; publicados: number; total: number };
}

const NOME_KEY = 'gens_aprovacao_nome';
const LEITURA_KEY = 'gens_modo_leitura';

function lerLocal(chave: string): string {
  try {
    return typeof window === 'undefined' ? '' : localStorage.getItem(chave) || '';
  } catch {
    return '';
  }
}

function gravarLocal(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

// ---------------- Datas ----------------

function paraData(data: string | null): Date | null {
  if (!data) return null;
  const d = new Date(data.length <= 10 ? `${data}T12:00:00` : data);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nomeMes(mes: string): { mes: string; ano: string } {
  const [a, m] = mes.split('-');
  const nome = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return { mes: `${nome.charAt(0).toUpperCase()}${nome.slice(1)}`, ano: a };
}

function dataPorExtenso(data: string | null): string | null {
  const d = paraData(data);
  if (!d) return null;
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}

function diaEDiaSemana(data: string | null): { dia: string; semana: string } | null {
  const d = paraData(data);
  if (!d) return null;
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' });
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '');
  return { dia, semana };
}

// ---------------- Pequenos componentes ----------------

const ICONE_FORMATO: Record<FormatoPost, React.ElementType> = {
  reels: Clapperboard,
  carrossel: GalleryHorizontalEnd,
  story: Smartphone,
  post: ImageIcon,
};

function SeloFormato({ formato }: { formato: FormatoPost }) {
  const Icone = ICONE_FORMATO[formato];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Icone className="size-3.5" aria-hidden />
      {ROTULO_FORMATO[formato]}
    </span>
  );
}

function SeloEtapa({ item }: { item: ItemDoMes }) {
  switch (item.etapa) {
    case 'texto':
      return item.texto_aprovado_em ? (
        <Badge variant="success" icon={CircleCheck}>Texto aprovado</Badge>
      ) : (
        <Badge variant="info" icon={Pencil}>Revisar texto</Badge>
      );
    case 'producao':
      return <Badge variant="muted" icon={Palette}>Em produção</Badge>;
    case 'revisao':
      return <Badge variant="muted" icon={SearchCheck}>Em revisão</Badge>;
    case 'aprovacao':
      return <Badge variant="warning" icon={Clock}>Para aprovar</Badge>;
    case 'agendado':
      return <Badge variant="info" icon={CalendarClock}>Agendado</Badge>;
    default:
      return <Badge variant="success" icon={CircleCheck}>Publicado</Badge>;
  }
}

/** Barra de 6 segmentos: onde o post está no processo (da ideia ao Instagram). */
function BarraProcesso({ etapa, compacta }: { etapa: ItemDoMes['etapa']; compacta?: boolean }) {
  const atual = indiceDaEtapa(etapa);
  return (
    <div
      role="img"
      aria-label={`Etapa ${atual + 1} de ${ETAPAS_PROCESSO.length}: ${ETAPAS_PROCESSO[atual].rotulo}`}
      className={cn('grid grid-cols-6', compacta ? 'gap-1' : 'gap-1.5')}
    >
      {ETAPAS_PROCESSO.map((e, i) => (
        <span
          key={e.etapa}
          className={cn('rounded-full', compacta ? 'h-1' : 'h-1.5', i < atual ? 'bg-brand-text/60' : i === atual ? 'bg-brand-text' : 'bg-border-strong')}
        />
      ))}
    </div>
  );
}

/** Onde o post está agora: passos alinhados em seis colunas iguais e o que acontece em seguida. */
function EtapasProcesso({ item }: { item: ItemDoMes }) {
  const atual = indiceDaEtapa(item.etapa);
  const info = ETAPAS_PROCESSO[atual];
  const ultimo = ETAPAS_PROCESSO.length - 1;
  return (
    <section aria-label="Andamento do post" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <ol className="grid grid-cols-6" aria-label={`Etapa ${atual + 1} de ${ETAPAS_PROCESSO.length}: ${info.rotulo}`}>
        {ETAPAS_PROCESSO.map((e, i) => {
          const feito = i < atual;
          const agora = i === atual;
          return (
            <li key={e.etapa} className="relative flex flex-col items-center gap-2">
              {i > 0 && <span aria-hidden className={cn('absolute left-0 right-1/2 top-3 h-0.5 -translate-y-1/2', i <= atual ? 'bg-brand-text' : 'bg-border-strong')} />}
              {i < ultimo && <span aria-hidden className={cn('absolute left-1/2 right-0 top-3 h-0.5 -translate-y-1/2', i < atual ? 'bg-brand-text' : 'bg-border-strong')} />}
              <span
                className={cn(
                  'relative z-10 flex size-6 items-center justify-center rounded-full border-2',
                  feito ? 'border-brand-text bg-brand-text text-background' : agora ? 'border-brand-text bg-background' : 'border-border-strong bg-background'
                )}
              >
                {feito ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : agora ? <span className="size-2 rounded-full bg-brand-text" /> : null}
              </span>
              <span className={cn('hidden text-center text-xs leading-4 lg:block', agora ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{e.rotulo}</span>
            </li>
          );
        })}
      </ol>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          Etapa {atual + 1} de {ETAPAS_PROCESSO.length}
        </p>
        <p className="font-display text-title font-semibold">{info.rotulo}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {item.etapa === 'texto' && item.texto_aprovado_em ? 'Você aprovou o texto. A equipe segue para a produção.' : info.descricao}
        </p>
      </div>
    </section>
  );
}

function TextoComNegrito({ texto }: { texto: string }) {
  return (
    <>
      {partesNegrito(texto).map((p, i) =>
        p.negrito ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.texto}
          </strong>
        ) : (
          <React.Fragment key={i}>{p.texto}</React.Fragment>
        )
      )}
    </>
  );
}

/** Roteiro em markdown simples virando seções, cenas, itens e parágrafos. */
function normalizarRotulo(t: string): string {
  return t.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase();
}

function Roteiro({ texto, leitura, rotulo }: { texto: string; leitura: boolean; rotulo: string }) {
  // Seção com o mesmo nome do bloco (ex.: "🖼️ Texto dos slides") só repetiria o rótulo.
  const blocos = blocosDoRoteiro(texto).filter((b) => !(b.tipo === 'secao' && normalizarRotulo(b.texto) === normalizarRotulo(rotulo)));
  const corpo = leitura ? 'text-xl leading-9' : 'text-base leading-7';
  return (
    <div className="flex flex-col">
      {blocos.map((b, i) => {
        if (b.tipo === 'secao') {
          return (
            <h4 key={i} className={cn('font-display text-title font-semibold', i > 0 && 'mt-6 border-t border-border pt-5')}>
              {b.texto}
            </h4>
          );
        }
        if (b.tipo === 'subtitulo') {
          return (
            <p key={i} className="mt-4 text-label font-semibold uppercase tracking-wide text-brand-text">
              {b.texto}
            </p>
          );
        }
        if (b.tipo === 'item') {
          return (
            <div key={i} className={cn('mt-2 flex gap-3', corpo)}>
              <span className="shrink-0 font-semibold tabular-nums text-brand-text">{b.marcador}</span>
              <span className="min-w-0 whitespace-pre-line">
                <TextoComNegrito texto={b.texto} />
              </span>
            </div>
          );
        }
        return (
          <p key={i} className={cn('mt-2 whitespace-pre-line', corpo)}>
            <TextoComNegrito texto={b.texto} />
          </p>
        );
      })}
    </div>
  );
}

async function copiar(texto: string, rotulo: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado.`);
  } catch {
    toast.error('Não foi possível copiar.');
  }
}

interface EditorSugestaoProps {
  campo: CampoSugestao;
  rotulo: string;
  inicial: string;
  nome: string;
  onNome: (v: string) => void;
  onEnviar: (campo: CampoSugestao, texto: string) => Promise<boolean>;
  onCancelar: () => void;
}

function EditorSugestao({ campo, rotulo, inicial, nome, onNome, onEnviar, onCancelar }: EditorSugestaoProps) {
  const [valor, setValor] = useState(inicial);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const ok = await onEnviar(campo, valor);
    setEnviando(false);
    if (ok) onCancelar();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold">Como você quer {rotulo.toLowerCase()}?</span>
        <textarea
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={campo === 'titulo' ? 3 : 10}
          className="w-full rounded-xl border border-input bg-background p-3 text-base leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold">Seu nome</span>
        <input
          value={nome}
          onChange={(e) => onNome(e.target.value)}
          autoComplete="name"
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <p className="text-xs text-muted-foreground">A equipe recebe sua sugestão e aceita ou ajusta. O texto atual só muda depois disso.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={enviar} loading={enviando}>
          <Check className="size-4" aria-hidden /> Enviar
        </Button>
      </div>
    </div>
  );
}

interface BlocoTextoProps {
  rotulo: string;
  campo: CampoSugestao;
  texto: string | null;
  roteiro?: boolean;
  podeSugerir: boolean;
  pendente?: string;
  leitura: boolean;
  nome: string;
  onNome: (v: string) => void;
  onEnviar: (campo: CampoSugestao, texto: string) => Promise<boolean>;
  editando: boolean;
  onEditar: (aberto: boolean) => void;
}

/** Roteiro ou legenda: leitura confortável, copiar e (em planejamento) sugerir mudança. */
function BlocoTexto({ rotulo, campo, texto, roteiro, podeSugerir, pendente, leitura, nome, onNome, onEnviar, editando, onEditar }: BlocoTextoProps) {
  const temTexto = !!texto?.trim();
  const textoPuro = roteiro ? roteiroComoTextoPuro(texto) : (texto ?? '').trim();

  return (
    <section id={`bloco-${campo}`} className="flex scroll-mt-20 flex-col gap-3" aria-label={rotulo}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="eyebrow text-muted-foreground">{rotulo}</h3>
        <div className="flex items-center gap-1">
          {temTexto && (
            <IconButton label={`Copiar ${rotulo.toLowerCase()}`} onClick={() => copiar(textoPuro, rotulo)}>
              <Copy />
            </IconButton>
          )}
          {podeSugerir && !editando && (
            <Button variant="ghost" size="sm" onClick={() => onEditar(true)}>
              <Pencil className="size-3.5" aria-hidden /> {pendente ? 'Alterar sugestão' : 'Sugerir mudança'}
            </Button>
          )}
        </div>
      </div>

      {editando ? (
        <EditorSugestao
          campo={campo}
          rotulo={rotulo}
          inicial={pendente ?? textoPuro}
          nome={nome}
          onNome={onNome}
          onEnviar={onEnviar}
          onCancelar={() => onEditar(false)}
        />
      ) : temTexto ? (
        roteiro ? (
          <Roteiro texto={texto || ''} leitura={leitura} rotulo={rotulo} />
        ) : (
          <p className={cn('whitespace-pre-line', leitura ? 'text-xl leading-9' : 'text-base leading-7')}>{texto}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Ainda não há texto aqui.</p>
      )}

      {pendente && !editando && (
        <div className="rounded-2xl border border-warning-ring bg-warning-soft p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warning">
            <Clock className="size-3.5" aria-hidden /> Sua sugestão, aguardando a equipe
          </p>
          <p className="whitespace-pre-line text-sm leading-6">{pendente}</p>
        </div>
      )}
    </section>
  );
}

/** Prévia no formato do Instagram (só quando a arte já existe). */
function PreviaInstagram({ item, cliente }: { item: ItemDoMes; cliente: Dados['cliente'] }) {
  const [slide, setSlide] = useState(0);
  const [tempo, setTempo] = useState(0);
  const comum = {
    clienteNome: cliente.nome,
    clienteCor: cliente.cor,
    clienteFotoUrl: cliente.foto_url,
    clienteInstagramUsername: cliente.usuario,
  };
  if (item.formato === 'reels') {
    const video = item.arquivos.find((a) => a.tipo === 'video') || item.arquivos[0] || null;
    return <InstagramReelsPreview {...comum} arquivoVideo={video} titulo={item.titulo} legenda={item.legenda} tempoAtual={tempo} onAtualizarTempo={setTempo} />;
  }
  if (item.formato === 'story') {
    return <InstagramStoryPreview {...comum} arquivos={item.arquivos} slideAtual={slide} onMudarSlide={setSlide} />;
  }
  return <InstagramCarrosselPreview {...comum} arquivos={item.arquivos} titulo={item.titulo} legenda={item.legenda} slideAtual={slide} onMudarSlide={setSlide} />;
}

// ---------------- Página ----------------

export default function LinkDoMesPage() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroMes>('todos');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [nome, setNome] = useState(() => lerLocal(NOME_KEY));
  const [leitura, setLeitura] = useState(() => lerLocal(LEITURA_KEY) === '1');
  const [campoEditando, setCampoEditando] = useState<CampoSugestao | null>(null);
  const [aprovandoTexto, setAprovandoTexto] = useState(false);
  const [painel, setPainel] = useState<null | 'aprovar' | 'ajuste'>(null);
  const [textoAjuste, setTextoAjuste] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(
    async (mesPedido: string | null) => {
      try {
        const res = await fetch(`/api/aprovacao/mes/${token}${mesPedido ? `?mes=${mesPedido}` : ''}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar.');
        setDados(json);
        setMes(json.mes);
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
      } finally {
        setCarregando(false);
      }
    },
    [token]
  );

  // Primeira carga: o link pode trazer o mês (?mes=2026-11).
  useEffect(() => {
    if (!token) return;
    const mesDoLink = new URLSearchParams(window.location.search).get('mes');
    fetch(`/api/aprovacao/mes/${token}${mesDoLink ? `?mes=${encodeURIComponent(mesDoLink)}` : ''}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar.');
        setDados(json);
        setMes(json.mes);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setCarregando(false));
  }, [token]);

  // Atualiza sozinha: a cada 30s com a página visível e ao voltar para a aba.
  useEffect(() => {
    if (!token || !mes) return;
    const atualizar = () => {
      if (document.visibilityState === 'visible') carregar(mes);
    };
    const id = window.setInterval(atualizar, 30000);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', atualizar);
    };
  }, [token, mes, carregar]);

  const itensFiltro = useMemo(() => (dados?.itens || []).filter((i) => itemNoFiltro(i, filtro)), [dados, filtro]);
  const aberto = useMemo(() => itensFiltro.find((i) => i.id === abertoId) || null, [itensFiltro, abertoId]);
  // No computador sempre há um post aberto; no celular só depois do toque.
  const selecionado = aberto || itensFiltro[0] || null;
  const indice = selecionado ? itensFiltro.findIndex((i) => i.id === selecionado.id) : -1;
  const itensAba = itensFiltro;

  function abrir(id: string) {
    setAbertoId(id);
    setCampoEditando(null);
    setPainel(null);
    setTextoAjuste('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  function trocarFiltro(novo: FiltroMes) {
    setFiltro(novo);
    setAbertoId(null);
    setPainel(null);
  }

  function guardarNome(v: string) {
    setNome(v);
    gravarLocal(NOME_KEY, v);
  }

  function alternarLeitura() {
    const novo = !leitura;
    setLeitura(novo);
    gravarLocal(LEITURA_KEY, novo ? '1' : '0');
  }

  async function enviarSugestao(item: ItemDoMes, campo: CampoSugestao, texto: string): Promise<boolean> {
    if (!nome.trim()) {
      toast.error('Informe seu nome', { description: 'Assim a equipe sabe quem sugeriu.' });
      return false;
    }
    try {
      const res = await fetch(`/api/aprovacao/mes/${token}/sugestao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, campo, texto, autor: nome.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar.');
      toast.success('Sugestão enviada para a equipe.');
      await carregar(mes);
      return true;
    } catch (e) {
      toast.error('Não foi possível enviar', { description: e instanceof Error ? e.message : 'Tente de novo em instantes.' });
      return false;
    }
  }

  async function aprovarTexto(item: ItemDoMes) {
    if (!nome.trim()) {
      setPainel('aprovar');
      toast.error('Informe seu nome', { description: 'Assim a equipe sabe quem aprovou o texto.' });
      return;
    }
    setAprovandoTexto(true);
    try {
      const res = await fetch(`/api/aprovacao/mes/${token}/aprovar-texto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, autor: nome.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível aprovar.');
      toast.success('Texto aprovado!');
      setPainel(null);
      await carregar(mes);
    } catch (e) {
      toast.error('Não foi possível aprovar', { description: e instanceof Error ? e.message : 'Tente de novo em instantes.' });
    } finally {
      setAprovandoTexto(false);
    }
  }

  async function agir(item: ItemDoMes, acao: 'aprovar' | 'ajuste') {
    if (!item.token_aprovacao) return;
    if (!nome.trim()) {
      toast.error('Informe seu nome', { description: 'Assim a equipe sabe quem aprovou ou pediu o ajuste.' });
      return;
    }
    if (acao === 'ajuste' && !textoAjuste.trim()) {
      toast.error('Descreva o ajuste', { description: 'Escreva o que precisa mudar.' });
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/aprovacao/${item.token_aprovacao}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          acao === 'aprovar' ? { acao, autor: nome.trim() } : { acao, autor: nome.trim(), texto: `[Arte/Mídia] ${textoAjuste.trim()}`, parte: 'arte' }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar.');
      toast.success(acao === 'aprovar' ? 'Post aprovado!' : 'Ajuste enviado para a equipe.');
      setPainel(null);
      setTextoAjuste('');
      setAbertoId(null);
      await carregar(mes);
    } catch (e) {
      toast.error('Não foi possível enviar', { description: e instanceof Error ? e.message : 'Tente de novo em instantes.' });
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <Info className="size-8 text-muted-foreground" aria-hidden />
          <h1 className="font-display text-title font-semibold">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{erro || 'Não foi possível abrir este link.'} Peça um novo à agência.</p>
        </div>
      </div>
    );
  }

  const { mes: nomeDoMes, ano } = nomeMes(dados.mes);
  const usuario = dados.cliente.usuario ? `@${dados.cliente.usuario.replace(/^@/, '')}` : null;
  const nomeExibido = dados.cliente.nome.replace(/^@/, '') === (dados.cliente.usuario || '').replace(/^@/, '') ? null : dados.cliente.nome;

  // ---------- Cabeçalho do mês ----------
  const cabecalho = (
    <header className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {dados.cliente.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dados.cliente.foto_url} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-muted font-display text-base font-semibold">
            {(nomeExibido || usuario || '?').replace('@', '').charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {nomeExibido && <p className="truncate text-sm font-semibold">{nomeExibido}</p>}
          {usuario && <p className={cn('truncate', nomeExibido ? 'text-xs text-muted-foreground' : 'text-sm font-semibold')}>{usuario}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Conteúdo de</p>
          <h1 className="font-display text-display font-semibold leading-none">
            {nomeDoMes} <span className="text-muted-foreground">{ano}</span>
          </h1>
        </div>
        {dados.meses.length > 1 && (
          <select
            value={mes || dados.mes}
            onChange={(e) => {
              setCarregando(true);
              setAbertoId(null);
              carregar(e.target.value);
            }}
            aria-label="Trocar o mês"
            className="h-11 w-full rounded-full border border-input bg-card px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:self-start lg:w-full"
          >
            {dados.meses.map((m) => {
              const n = nomeMes(m.mes);
              return (
                <option key={m.mes} value={m.mes}>
                  {n.mes} {n.ano}
                </option>
              );
            })}
          </select>
        )}
      </div>

      <p className="text-base leading-7 text-muted-foreground">
        {dados.contagem.para_voce > 0
          ? `${dados.contagem.para_voce === 1 ? '1 post espera' : `${dados.contagem.para_voce} posts esperam`} você. Veja em que etapa está cada um do mês.`
          : 'Nada esperando você agora. Acompanhe aqui em que etapa está cada post do mês.'}
      </p>
    </header>
  );

  // ---------- Lista ----------
  const lista = (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-2xl bg-muted p-1" role="group" aria-label="Filtrar posts">
        {([
          { id: 'todos', rotulo: 'Todos', n: dados.contagem.total },
          { id: 'para_voce', rotulo: 'Para você', n: dados.contagem.para_voce },
          { id: 'publicados', rotulo: 'No ar', n: dados.contagem.publicados },
        ] as const).map((f) => (
          <SegmentedItem key={f.id} group="filtro-mes" active={filtro === f.id} onClick={() => trocarFiltro(f.id)} className="h-11 flex-1 gap-1 rounded-xl px-1 text-sm">
            {f.rotulo}
            <span className="tabular-nums text-muted-foreground">{f.n}</span>
          </SegmentedItem>
        ))}
      </div>
      <p className="-mt-1 px-1 text-xs text-muted-foreground">Esta página se atualiza sozinha.</p>

      {itensAba.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
          <p className="text-sm font-semibold">{filtro === 'para_voce' ? 'Nada esperando você' : filtro === 'publicados' ? 'Nada no ar ainda' : 'Nenhum post neste mês'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtro === 'para_voce' ? 'Quando houver algo para revisar ou aprovar, ele aparece aqui.' : filtro === 'publicados' ? 'Os posts aparecem aqui depois de agendados.' : 'Os posts do mês aparecem conforme são planejados.'}
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Posts do mês">
          {itensAba.map((it) => {
            const ativo = selecionado?.id === it.id;
            const d = diaEDiaSemana(it.data_programada || it.publicado_em);
            const sugestoes = it.sugestoes?.length || 0;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => abrir(it.id)}
                  aria-current={ativo ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-stretch gap-3 rounded-2xl border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ativo ? 'border-border lg:border-primary lg:ring-1 lg:ring-primary' : 'border-border hover:border-border-strong'
                  )}
                >
                  <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted py-1.5">
                    <span className="font-display text-title font-semibold tabular-nums leading-none">{d?.dia ?? '—'}</span>
                    <span className="mt-1 text-xs capitalize text-muted-foreground">{d?.semana ?? 's/ data'}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <SeloFormato formato={it.formato} />
                      <SeloEtapa item={it} />
                    </span>
                    <span className="line-clamp-2 text-sm font-semibold leading-5">{it.titulo || 'Sem título'}</span>
                    <BarraProcesso etapa={it.etapa} compacta />
                    {sugestoes > 0 && (
                      <span className="text-xs text-warning">
                        {sugestoes === 1 ? '1 sugestão sua aguardando a equipe' : `${sugestoes} sugestões suas aguardando a equipe`}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground lg:hidden" aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );

  // ---------- Detalhe ----------
  const detalhe = (it: ItemDoMes) => {
    const temArte = it.arquivos.length > 0;
    const pendente = (campo: CampoSugestao) => it.sugestoes?.find((s) => s.campo === campo)?.texto;
    const pode = (campo: CampoSugestao) => podeSugerirCampo(it.etapa, campo);
    const rotuloRoteiro = it.formato === 'reels' ? 'Roteiro do vídeo' : it.formato === 'carrossel' ? 'Texto dos slides' : 'Texto da arte';
    const quando = dataPorExtenso(it.data_programada || it.publicado_em);

    return (
      <article className={cn('flex flex-col gap-6', temArte ? 'mx-auto max-w-xl' : 'max-w-3xl')}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <SeloFormato formato={it.formato} />
            <SeloEtapa item={it} />
          </div>
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 font-display text-headline font-semibold">{it.titulo || 'Sem título'}</h2>
            {pode('titulo') && campoEditando !== 'titulo' && (
              <IconButton label={pendente('titulo') ? 'Alterar sugestão de título' : 'Sugerir mudança no título'} onClick={() => setCampoEditando('titulo')}>
                <Pencil />
              </IconButton>
            )}
          </div>
          {quando && <p className="text-sm text-muted-foreground">{it.etapa === 'publicado' && it.publicado_em ? `Publicado em ${quando.toLowerCase()}` : quando}</p>}
          {campoEditando === 'titulo' && (
            <EditorSugestao
              campo="titulo"
              rotulo="Título"
              inicial={pendente('titulo') ?? it.titulo ?? ''}
              nome={nome}
              onNome={guardarNome}
              onEnviar={(c, t) => enviarSugestao(it, c, t)}
              onCancelar={() => setCampoEditando(null)}
            />
          )}
          {pendente('titulo') && campoEditando !== 'titulo' && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm">
              <span className="font-semibold text-warning">Título sugerido: </span>
              {pendente('titulo')}
            </p>
          )}
        </div>

        <EtapasProcesso item={it} />

        {it.etapa === 'publicado' && !temArte && (
          <p className="flex gap-3 rounded-2xl border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Depois de publicado, só o texto fica guardado aqui
              {it.texto_ate ? `, até ${new Date(it.texto_ate).toLocaleDateString('pt-BR')}` : ''}. O post completo está no seu Instagram.
            </span>
          </p>
        )}

        <div className="flex min-w-0 flex-col gap-8">
          {temArte && (
            <div className="mx-auto w-full max-w-sm">
              <PreviaInstagram key={it.id} item={it} cliente={dados.cliente} />
            </div>
          )}
          {/* Roteiro só até a arte ficar pronta; depois ficam a prévia e a legenda */}
          {it.briefing && (
            <BlocoTexto
              key={`${it.id}-briefing`}
              rotulo={rotuloRoteiro}
              campo="briefing"
              texto={it.briefing}
              roteiro
              podeSugerir={pode('briefing')}
              pendente={pendente('briefing')}
              leitura={leitura}
              nome={nome}
              onNome={guardarNome}
              onEnviar={(c, t) => enviarSugestao(it, c, t)}
              editando={campoEditando === 'briefing'}
              onEditar={(aberto) => setCampoEditando(aberto ? 'briefing' : null)}
            />
          )}
          <BlocoTexto
            key={`${it.id}-legenda`}
            rotulo="Legenda"
            campo="legenda"
            texto={it.legenda}
            podeSugerir={pode('legenda')}
            pendente={pendente('legenda')}
            leitura={leitura}
            nome={nome}
            onNome={guardarNome}
            onEnviar={(c, t) => enviarSugestao(it, c, t)}
            editando={campoEditando === 'legenda'}
            onEditar={(aberto) => setCampoEditando(aberto ? 'legenda' : null)}
          />
        </div>
      </article>
    );
  };

  // ---------- Ações: aprovar o texto (planejamento) ou a arte (aprovação) ----------
  const campoNome = (
    <label className="flex flex-col gap-1.5">
      <span className="text-label font-semibold">Seu nome</span>
      <input
        value={nome}
        onChange={(e) => guardarNome(e.target.value)}
        autoComplete="name"
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );

  const acoes = (it: ItemDoMes) => {
    if (it.pode_aprovar_texto) {
      const aguardandoEquipe = (it.sugestoes?.length || 0) > 0;
      return (
        <div className="flex flex-col gap-3">
          {painel === 'aprovar' && campoNome}
          {aguardandoEquipe && (
            <p className="text-xs leading-5 text-muted-foreground">Sua sugestão está com a equipe. Depois que ela for resolvida, você poderá aprovar o texto.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {painel === 'aprovar' ? (
              <>
                <Button variant="secondary" size="lg" onClick={() => setPainel(null)} disabled={aprovandoTexto}>
                  Voltar
                </Button>
                <Button size="lg" onClick={() => aprovarTexto(it)} loading={aprovandoTexto}>
                  <Check className="size-4" aria-hidden /> Confirmar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  className="whitespace-nowrap px-3 text-sm"
                  onClick={() => {
                    setCampoEditando('briefing');
                    requestAnimationFrame(() => document.getElementById('bloco-briefing')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                  }}
                >
                  <Pencil className="size-4" aria-hidden /> Sugerir mudança
                </Button>
                <Button size="lg" className="whitespace-nowrap px-3 text-sm" onClick={() => aprovarTexto(it)} loading={aprovandoTexto} disabled={aguardandoEquipe}>
                  <Check className="size-4" aria-hidden /> Aprovar texto
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (!it.pode_agir) return null;
    return (
      <div className="flex flex-col gap-3">
        {painel && (
          <div className="flex flex-col gap-3">
            {painel === 'ajuste' && (
              <label className="flex flex-col gap-1.5">
                <span className="text-label font-semibold">O que precisa mudar?</span>
                <textarea
                  value={textoAjuste}
                  onChange={(e) => setTextoAjuste(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            )}
            {campoNome}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {painel ? (
            <>
              <Button variant="secondary" size="lg" onClick={() => setPainel(null)} disabled={enviando}>
                Voltar
              </Button>
              <Button size="lg" onClick={() => agir(it, painel === 'aprovar' ? 'aprovar' : 'ajuste')} loading={enviando}>
                {painel === 'aprovar' ? (
                  <>
                    <Check className="size-4" aria-hidden /> Confirmar
                  </>
                ) : (
                  <>
                    <MessageSquare className="size-4" aria-hidden /> Enviar ajuste
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="lg" className="whitespace-nowrap px-3 text-sm" onClick={() => setPainel('ajuste')}>
                <MessageSquare className="size-4" aria-hidden /> Pedir ajuste
              </Button>
              <Button size="lg" className="whitespace-nowrap px-3 text-sm" onClick={() => (nome.trim() ? agir(it, 'aprovar') : setPainel('aprovar'))} loading={enviando}>
                <Check className="size-4" aria-hidden /> Aprovar post
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ---------- Barra do post aberto ----------
  const barraNavegacao = (
    <div className="flex items-center gap-1">
      <IconButton label="Modo leitura (texto maior)" onClick={alternarLeitura} aria-pressed={leitura} className={cn(leitura && 'bg-accent text-foreground')}>
        <Type />
      </IconButton>
      <IconButton label="Post anterior" onClick={() => indice > 0 && abrir(itensAba[indice - 1].id)} disabled={indice <= 0}>
        <ChevronLeft />
      </IconButton>
      <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-muted-foreground">
        {indice + 1} de {itensAba.length}
      </span>
      <IconButton label="Próximo post" onClick={() => indice < itensAba.length - 1 && abrir(itensAba[indice + 1].id)} disabled={indice >= itensAba.length - 1}>
        <ChevronRight />
      </IconButton>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Celular com post aberto: barra fixa no topo para voltar e navegar */}
      {aberto && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
          <Button variant="ghost" size="sm" onClick={() => setAbertoId(null)}>
            <ArrowLeft className="size-4" aria-hidden /> Posts
          </Button>
          {barraNavegacao}
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 pb-40 pt-6 sm:px-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:pb-16 lg:pt-10">
        {/* Coluna do mês: no celular some quando um post está aberto */}
        <aside className={cn('flex flex-col gap-8 lg:sticky lg:top-10 lg:max-h-[calc(100dvh-5rem)] lg:self-start lg:overflow-y-auto lg:pb-4', aberto && 'max-lg:hidden')}>
          {cabecalho}
          {dados.itens.length > 0 && lista}
          {dados.itens.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-sm text-muted-foreground">
              Ainda não há posts para mostrar em {nomeDoMes.toLowerCase()}.
            </p>
          )}
        </aside>

        {/* Post aberto: sempre visível no computador; no celular só depois do toque */}
        <main className={cn('min-w-0', !aberto && 'max-lg:hidden')}>
          {selecionado ? (
            <div className="flex flex-col gap-6">
              <div className="hidden items-center justify-end lg:flex">{barraNavegacao}</div>
              {detalhe(selecionado)}
              {(selecionado.pode_agir || selecionado.pode_aprovar_texto) && (
                <>
                  <div className="sticky bottom-6 z-10 hidden max-w-md self-end rounded-2xl border border-border-strong bg-card p-4 shadow-lg lg:block">{acoes(selecionado)}</div>
                  <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
                    {acoes(selecionado)}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="hidden rounded-2xl border border-dashed border-border-strong p-10 text-center text-sm text-muted-foreground lg:block">
              Selecione um post para ver os detalhes.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
