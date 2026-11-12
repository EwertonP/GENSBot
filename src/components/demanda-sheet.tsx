'use client';

import { Tip } from '@/components/ui/tooltip';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Menu } from '@base-ui/react/menu';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  AlignLeft,
  Copy,
  Flag,
  Layers,
  Hash,
  Image as ImageIcon,
  ListTodo,
  Archive,
  ArrowRightLeft,
  BookmarkPlus,
  BookOpen,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  Timer,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { EditorRico } from '@/components/ui/editor-rico';
import { EtiquetasSeletor } from '@/components/etiquetas-seletor';
import { SugestoesTextoCard } from '@/components/sugestoes-texto-card';
import type { CampoSugestao } from '@/lib/sugestoes-texto';
import type { CorEtiqueta, Etiqueta } from '@/lib/etiquetas';
import { conteudoInicial, LIMITE_BRIEFING, textoParaHtml } from '@/lib/editor-rico';
import {
  contarHashtags,
  paraCapitalizado,
  paraItalico,
  paraMaiusculas,
  paraMinusculas,
  paraNegrito,
} from '@/lib/legenda-texto';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { MemberChipSelect } from '@/components/ui/member-chip-select';
import { ResponsaveisSelect } from '@/components/ui/responsaveis-select';
import { confirmDialog, MediaLightbox } from '@/components/ui/dialog';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { CapaReelsField } from '@/components/capa-reels-field';
import { uploadMediaFile } from '@/lib/storage-upload';
import {
  PRIORIDADE_CONFIG,
  deInputData,
  distanciaEmDias,
  paraInputData,
  type ArquivoConteudo,
  type ChecklistItem,
  type ConteudoItem,
  type PrioridadeConteudo,
  type StatusConteudo,
  type TipoConteudo,
} from '@/lib/conteudo';
import type { Cliente } from '@/lib/clientes';
import type { MembroEquipe } from '@/components/equipe-tab';

/*
 * Modal único da demanda: o mesmo formulário cria ("novo") e edita
 * ("editar"). Antes eram dois blocos de ~700 linhas quase iguais dentro do
 * esteira-tab.tsx, e toda melhoria precisava ser feita duas vezes.
 * O pai monta com uma `key` nova a cada abertura, então o estado inicial
 * vem das props no primeiro render.
 */

export const ETAPAS_PIPELINE: { status: StatusConteudo; label: string; short: string; step: number }[] = [
  // Um só vocabulário: "short" = STATUS_LABELS (badges e colunas); "label" = versão por extenso do stepper.
  { status: 'planejamento', label: 'Planejamento', short: 'Planejamento', step: 1 },
  { status: 'criacao_arte', label: 'Criação', short: 'Criação', step: 2 },
  { status: 'revisao_interna', label: 'Revisão interna', short: 'Revisão', step: 3 },
  { status: 'revisao_cliente', label: 'Aprovação do cliente', short: 'Aprovação', step: 4 },
  { status: 'agendamento', label: 'Agendamento', short: 'Agendamento', step: 5 },
  { status: 'publicado', label: 'Publicado', short: 'Publicado', step: 6 },
];

export function getEtapaIndex(status: StatusConteudo): number {
  switch (status) {
    case 'planejamento':
      return 1;
    case 'copy':
    case 'criacao_arte':
    case 'em_gravacao':
    case 'em_edicao':
      return 2;
    case 'revisao_arte':
    case 'revisao_interna':
    case 'travado':
      return 3;
    case 'revisao_cliente':
      return 4;
    case 'agendamento':
    case 'revisao_agendamento':
    case 'pronto_publicar':
      return 5;
    case 'publicado':
      return 6;
    default:
      return 1;
  }
}

const FORMATOS: { id: TipoConteudo; label: string; descricao: string; icon: typeof ImageIcon }[] = [
  { id: 'post', label: 'Feed', descricao: 'Post único ou carrossel (4:5)', icon: ImageIcon },
  { id: 'reel', label: 'Reels', descricao: 'Reels (9:16)', icon: Video },
  { id: 'story', label: 'Story', descricao: 'Story', icon: Smartphone },
  { id: 'avulso', label: 'Avulso', descricao: 'Avulso', icon: Sparkles },
];

/** Limite de caracteres da legenda no Instagram. */
const LIMITE_LEGENDA = 2200;

/** Contador da legenda: amarelo perto do limite, vermelho quando passa. */
function classeContadorLegenda(tamanho: number): string {
  if (tamanho > LIMITE_LEGENDA) return 'text-destructive font-semibold';
  if (tamanho > LIMITE_LEGENDA - 200) return 'text-warning';
  return 'text-muted-foreground';
}

const EMOJIS_LEGENDA = ['🚀', '👉', '💡', '🔥', '✅', '💪', '🎯', '📲', '📸', '📅'];

function renderComentarioTexto(texto: string) {
  const parts = texto.split(/(@[\w\u00C0-\u017F.-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded-md">
          {part}
        </span>
      );
    }
    return part;
  });
}


export interface DemandaSheetProps {
  aberto: boolean;
  modo: 'novo' | 'editar';
  /** Demanda sendo editada (modo "editar"). */
  item: ConteudoItem | null;
  /** Pré-seleção no modo "novo". */
  clienteInicialId?: string;
  /** Etapa em que a demanda nova começa (ex.: a coluna onde o botão foi clicado). */
  statusInicial?: StatusConteudo;
  responsavelInicialId?: string;
  clientes: Cliente[];
  membros: MembroEquipe[];
  showToast: (message: string, type: 'success' | 'error') => void;
  onFechar: () => void;
  /** Demanda criada ou salva (já com a resposta do servidor). */
  onSalvo: (item: ConteudoItem, criado: boolean) => void;
  onExcluido: (id: string) => void;
  /** Comentário registrado: a demanda volta com o histórico novo. */
  onItemAtualizado: (item: ConteudoItem) => void;
  onCopiarLinkAprovacao: (token: string) => void;
  /** Só existe quando a aba de agendamento está disponível. */
  onLevarParaAgendamento?: (item: ConteudoItem) => void;
}

const CAMPO_PAINEL =
  'max-w-full cursor-pointer rounded-md bg-transparent py-0.5 text-right text-sm font-semibold text-panel-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-card [&>option]:text-foreground';

function SecaoTitulo({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 font-display text-sm font-semibold text-foreground">
      <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      {children}
    </h3>
  );
}

function LinhaPropriedade({
  icon: Icon,
  rotulo,
  detalhe,
  children,
}: {
  icon: React.ElementType;
  rotulo: string;
  detalhe?: { texto: string; atrasado: boolean } | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col px-2 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-sm text-panel-muted">
          <Icon aria-hidden className="size-4 shrink-0" />
          {rotulo}
        </span>
        {children}
      </div>
      {detalhe && (
        <span className={`mt-0.5 text-right text-xs ${detalhe.atrasado ? 'font-medium text-destructive' : 'text-panel-muted'}`}>{detalhe.texto}</span>
      )}
    </div>
  );
}

/** "em 3 dias" / "venceu há 2 dias" para uma data AAAA-MM-DD; nulo sem data. */
function detalhePrazo(valor: string, atrasoConta: boolean): { texto: string; atrasado: boolean } | null {
  const d = distanciaEmDias(valor);
  if (!d) return null;
  const atrasado = d.dias < 0 && atrasoConta;
  return { texto: atrasado ? `Atrasado, venceu ${d.texto}` : d.texto, atrasado };
}

export function DemandaSheet({
  aberto,
  modo,
  item,
  clienteInicialId,
  statusInicial,
  responsavelInicialId,
  clientes,
  membros,
  showToast,
  onFechar,
  onSalvo,
  onExcluido,
  onItemAtualizado,
  onCopiarLinkAprovacao,
  onLevarParaAgendamento,
}: DemandaSheetProps) {
  const editando = modo === 'editar' && !!item;

  // Garante lista de equipe sempre carregada, mesmo se o pai demorar para responder
  const [membrosLocais, setMembrosLocais] = useState<MembroEquipe[]>(membros);
  useEffect(() => {
    if (membros && membros.length > 0) {
      setMembrosLocais(membros);
    } else {
      fetch('/api/equipe')
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.membros) && d.membros.length > 0) {
            setMembrosLocais(d.membros);
          }
        })
        .catch(() => {});
    }
  }, [membros]);

  // Estado inicial vem das props: o pai troca a `key` a cada abertura.
  const [status, setStatus] = useState<StatusConteudo>(() => item?.status ?? statusInicial ?? 'planejamento');
  const [tipo, setTipo] = useState<TipoConteudo>(() => item?.tipo ?? 'post');
  const [prioridade, setPrioridade] = useState<PrioridadeConteudo>(() => item?.prioridade || 'media');
  const [titulo, setTitulo] = useState(() => item?.titulo || '');
  const [briefing, setBriefing] = useState(() => item?.briefing || '');
  const [abaComent, setAbaComent] = useState<'comentarios' | 'historico' | 'aprovacao'>('comentarios');
  const [etiquetasIds, setEtiquetasIds] = useState<string[]>(() => item?.etiquetas_ids ?? []);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [briefingHtml, setBriefingHtml] = useState(() => item?.briefing_html || '');
  const [briefingEditado, setBriefingEditado] = useState(false);
  const [legenda, setLegenda] = useState(() => item?.legenda || '');
  // Sobe quando um texto sugerido pela cliente é aceito: o editor (não controlado) recomeça com o texto novo.
  const [chaveEditor, setChaveEditor] = useState(0);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => item?.checklist || []);
  const [novoItemTexto, setNovoItemTexto] = useState('');
  const [clienteId, setClienteId] = useState(() => item?.cliente_id || clienteInicialId || '');
  const [responsavelId, setResponsavelId] = useState(() => (item ? item.responsavel_id || '' : responsavelInicialId || ''));
  const [coResponsaveis, setCoResponsaveis] = useState<string[]>(() => item?.co_responsaveis_ids ?? []);
  const [editorId, setEditorId] = useState(() => item?.editor_id || '');
  const [dataProgramada, setDataProgramada] = useState(() => paraInputData(item?.data_programada));
  const [prazoInterno, setPrazoInterno] = useState(() => paraInputData(item?.prazo));
  const [urls, setUrls] = useState('');
  const [arquivos, setArquivos] = useState<ArquivoConteudo[]>(() => item?.arquivos || []);
  const [capaUrl, setCapaUrl] = useState<string | null>(() => item?.cover_url || null);

  // Roteiro abre em modo leitura (formatado); "Editar" troca pelo campo de texto.
  const [mostrarUrlsManuais, setMostrarUrlsManuais] = useState(false);
  const [trocarClienteAberto, setTrocarClienteAberto] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);

  const [enviandoArquivos, setEnviandoArquivos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Propriedades avançadas da demanda e controle de tempo
  const [tempoEstimadoMinutos, setTempoEstimadoMinutos] = useState<number | null>(() => item?.tempo_estimado_minutos ?? null);
  const [visivelCliente, setVisivelCliente] = useState<boolean>(() => item?.visivel_cliente ?? true);
  const [pedidoInformacao, setPedidoInformacao] = useState<string | null>(() => item?.pedido_informacao ?? null);
  const [respostaInformacao, setRespostaInformacao] = useState<string | null>(() => item?.resposta_informacao ?? null);
  const [concluida, setConcluida] = useState<boolean>(() => item?.concluida ?? false);

  const [totalSegundos, setTotalSegundos] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState<{ id: string; inicio: string } | null>(null);
  const [modalManualAberto, setModalManualAberto] = useState(false);
  const [minutosManual, setMinutosManual] = useState('');
  const [descManual, setDescManual] = useState('');
  const [modalEstimadoAberto, setModalEstimadoAberto] = useState(false);
  const [inputEstimado, setInputEstimado] = useState(() => (item?.tempo_estimado_minutos ? String(item.tempo_estimado_minutos) : ''));
  const [modalPedidoInfoAberto, setModalPedidoInfoAberto] = useState(false);
  const [textoPedidoInfo, setTextoPedidoInfo] = useState('');

  // Modelos de legenda por cliente
  const [modelosLegenda, setModelosLegenda] = useState<{ id: string; nome: string; texto: string }[]>([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);

  const carregarModelosLegenda = useCallback(async () => {
    if (!clienteId) {
      setModelosLegenda([]);
      return;
    }
    setCarregandoModelos(true);
    try {
      const res = await fetch(`/api/legendas-padrao?cliente_id=${encodeURIComponent(clienteId)}`);
      if (res.ok) {
        const data = await res.json();
        setModelosLegenda(data.legendas || []);
      }
    } catch (err) {
      console.error('Erro ao carregar modelos de legenda:', err);
    } finally {
      setCarregandoModelos(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregarModelosLegenda();
  }, [carregarModelosLegenda]);

  async function handleSalvarLegendaComoPadrao() {
    if (!legenda.trim()) {
      showToast('Escreva algo na legenda antes de salvar como padrão.', 'error');
      return;
    }
    if (!clienteId) {
      showToast('Selecione um cliente para vincular este modelo.', 'error');
      return;
    }
    const nomeModelo = window.prompt('Nome do modelo de legenda (ex: Assinatura Padrão, Hashtags Fixas):');
    if (!nomeModelo?.trim()) return;

    try {
      const res = await fetch('/api/legendas-padrao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          nome: nomeModelo.trim(),
          texto: legenda.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar modelo');
      setModelosLegenda((prev) => [data.legenda, ...prev]);
      showToast('Modelo de legenda salvo para este cliente!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar modelo.', 'error');
    }
  }

  function handleInserirModeloLegenda(textoModelo: string) {
    if (!textoModelo) return;
    if (legenda.trim()) {
      setLegenda((prev) => `${prev.trim()}\n\n${textoModelo}`);
    } else {
      setLegenda(textoModelo);
    }
    showToast('Modelo inserido na legenda!', 'success');
  }

  async function handleDuplicar() {
    if (!item) return;
    try {
      const res = await fetch('/api/conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: item.cliente_id,
          tipo: item.tipo,
          status: 'planejamento',
          prioridade: item.prioridade,
          titulo: `(Cópia) ${item.titulo || ''}`.trim(),
          briefing: item.briefing,
          briefing_html: item.briefing_html,
          legenda: item.legenda,
          responsavel_id: item.responsavel_id,
          co_responsaveis_ids: item.co_responsaveis_ids,
          editor_id: item.editor_id,
          etiquetas_ids: item.etiquetas_ids,
          arquivos: item.arquivos,
          cover_url: item.cover_url,
          checklist: (item.checklist || []).map((c) => ({ ...c, id: crypto.randomUUID(), concluido: false })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao duplicar demanda');
      onSalvo(data.item, true);
      showToast('Demanda duplicada com sucesso!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao duplicar.', 'error');
    }
  }

  async function handleArquivar() {
    if (!item) return;
    const ok = await confirmDialog({
      title: 'Arquivar esta demanda?',
      description: 'A demanda sairá da esteira ativa, mas o histórico e arquivos serão mantidos.',
      confirmLabel: 'Arquivar demanda',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/conteudo/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivada_em: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Erro ao arquivar demanda');
      onExcluido(item.id);
      showToast('Demanda arquivada da esteira.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao arquivar.', 'error');
    }
  }

  function handleCopiarLinkPainelInterno() {
    if (!item) return;
    const url = `${window.location.origin}/?tab=esteira&item=${item.id}`;
    copiarTexto(url, 'Link interno do painel copiado!', 'Não foi possível copiar o link.');
  }

  const carregarTempos = useCallback(async () => {
    if (!editando || !item?.id) return;
    try {
      const res = await fetch(`/api/conteudo/${item.id}/tempo`);
      if (res.ok) {
        const data = await res.json();
        setTotalSegundos(data.totalSegundos || 0);
        setCronometroAtivo(data.ativo || null);
      }
    } catch (err) {
      console.error('Erro ao carregar tempos:', err);
    }
  }, [editando, item?.id]);

  useEffect(() => {
    carregarTempos();
  }, [carregarTempos]);

  useEffect(() => {
    if (!cronometroAtivo) return;
    const interval = setInterval(() => {
      setTotalSegundos((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cronometroAtivo]);

  function formatarTempoExtenso(seg: number) {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function handleToggleCronometro() {
    if (!item?.id) return;
    const acao = cronometroAtivo ? 'pausar' : 'iniciar';
    try {
      const res = await fetch(`/api/conteudo/${item.id}/tempo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      if (res.ok) {
        const data = await res.json();
        if (acao === 'iniciar') {
          setCronometroAtivo(data.ativo || { id: 'temp', inicio: new Date().toISOString() });
          showToast('Cronômetro iniciado!', 'success');
        } else {
          setCronometroAtivo(null);
          showToast('Cronômetro pausado.', 'success');
          carregarTempos();
        }
      }
    } catch {
      showToast('Erro ao atualizar cronômetro.', 'error');
    }
  }

  async function handleSalvarManual() {
    const min = parseInt(minutosManual, 10);
    if (!item?.id || isNaN(min) || min <= 0) {
      showToast('Informe um número de minutos válido.', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/conteudo/${item.id}/tempo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'manual', minutos: min, descricao: descManual }),
      });
      if (res.ok) {
        showToast(`${min} min adicionados ao apontamento!`, 'success');
        setModalManualAberto(false);
        setMinutosManual('');
        setDescManual('');
        carregarTempos();
      }
    } catch {
      showToast('Erro ao registrar tempo.', 'error');
    }
  }

  async function handleSalvarTempoEstimado(min: number | null) {
    setTempoEstimadoMinutos(min);
    if (editando && item?.id) {
      try {
        await fetch(`/api/conteudo/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempo_estimado_minutos: min }),
        });
        showToast(min ? `Tempo estimado: ${min} min.` : 'Tempo estimado removido.', 'success');
      } catch (err) {
        console.error(err);
      }
    }
    setModalEstimadoAberto(false);
  }

  async function handleToggleVisivelCliente() {
    const novoValor = !visivelCliente;
    setVisivelCliente(novoValor);
    if (editando && item?.id) {
      try {
        await fetch(`/api/conteudo/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visivel_cliente: novoValor }),
        });
        showToast(novoValor ? 'Demanda visível para o cliente no portal.' : 'Demanda oculta para o cliente.', 'success');
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function handleToggleConcluida() {
    const novo = !concluida;
    setConcluida(novo);
    if (editando && item?.id) {
      try {
        await fetch(`/api/conteudo/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concluida: novo }),
        });
        showToast(novo ? 'Demanda marcada como concluída! 🎉' : 'Demanda reaberta.', 'success');
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function handleSalvarPedidoInformacao() {
    if (!textoPedidoInfo.trim() || !item?.id) return;
    try {
      const res = await fetch(`/api/conteudo/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_informacao: textoPedidoInfo.trim(), resposta_informacao: null }),
      });
      if (res.ok) {
        setPedidoInformacao(textoPedidoInfo.trim());
        setRespostaInformacao(null);
        setModalPedidoInfoAberto(false);
        setTextoPedidoInfo('');
        showToast('Pedido de informação registrado para o cliente!', 'success');
      }
    } catch {
      showToast('Erro ao registrar pedido.', 'error');
    }
  }

  async function handleLimparPedidoInformacao() {
    if (!item?.id) return;
    try {
      await fetch(`/api/conteudo/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_informacao: null, resposta_informacao: null }),
      });
      setPedidoInformacao(null);
      setRespostaInformacao(null);
      showToast('Pedido de informação concluído/removido.', 'success');
    } catch {
      showToast('Erro ao remover pedido.', 'error');
    }
  }

  // Sincronização do checklist
  async function sincronizarChecklist(novos: ChecklistItem[]) {
    setChecklist(novos);
    if (editando && item?.id) {
      try {
        const res = await fetch(`/api/conteudo/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklist: novos }),
        });
        const data = await res.json();
        if (res.ok && data.item) {
          onItemAtualizado(data.item);
        }
      } catch (err) {
        console.error('Erro ao salvar checklist:', err);
      }
    }
  }

  function handleToggleChecklist(id: string) {
    const atualizados = checklist.map((c) => (c.id === id ? { ...c, concluido: !c.concluido } : c));
    sincronizarChecklist(atualizados);
  }

  function handleAdicionarItemChecklist(e?: React.FormEvent) {
    e?.preventDefault();
    if (!novoItemTexto.trim()) return;
    const novoItem: ChecklistItem = {
      id: crypto.randomUUID(),
      texto: novoItemTexto.trim(),
      concluido: false,
    };
    const atualizados = [...checklist, novoItem];
    setNovoItemTexto('');
    sincronizarChecklist(atualizados);
  }

  function handleRemoverItemChecklist(id: string) {
    const atualizados = checklist.filter((c) => c.id !== id);
    sincronizarChecklist(atualizados);
  }

  // Campo da legenda (abas ou dividido): os botões da barra inserem onde está o cursor.
  const legendaRef = useRef<HTMLTextAreaElement>(null);
  // Trecho selecionado na legenda: habilita as ferramentas de caixa e de negrito/itálico.
  const [selecaoLegenda, setSelecaoLegenda] = useState({ ini: 0, fim: 0 });
  const formRef = useRef<HTMLFormElement>(null);

  const clienteObj =
    clientes.find((c) => c.id === clienteId) || (item?.cliente_id === clienteId ? item?.cliente : undefined);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) => c.nome.toLowerCase().includes(termo) || (c.nicho && c.nicho.toLowerCase().includes(termo))
    );
  }, [clientes, buscaCliente]);

  // Alterações não salvas: o Sheet pergunta antes de descartar (Esc, clique fora, X, Cancelar).
  const sujo = editando
    ? titulo !== (item.titulo || '') ||
      briefing !== (item.briefing || '') ||
      legenda !== (item.legenda || '') ||
      status !== item.status ||
      tipo !== item.tipo ||
      prioridade !== (item.prioridade || 'media') ||
      responsavelId !== (item.responsavel_id || '') ||
      [...coResponsaveis].sort().join() !== [...(item.co_responsaveis_ids ?? [])].sort().join() ||
      editorId !== (item.editor_id || '') ||
      dataProgramada !== paraInputData(item.data_programada) ||
      prazoInterno !== paraInputData(item.prazo) ||
      clienteId !== item.cliente_id ||
      [...etiquetasIds].sort().join() !== [...(item.etiquetas_ids ?? [])].sort().join() ||
      urls.trim() !== '' ||
      (capaUrl || null) !== (item.cover_url || null) ||
      arquivos.map((a) => a.url).join('|') !== (item.arquivos || []).map((a) => a.url).join('|') ||
      JSON.stringify(checklist) !== JSON.stringify(item.checklist || [])
    : titulo.trim() !== '' ||
      briefing.trim() !== '' ||
      legenda.trim() !== '' ||
      checklist.length > 0 ||
      etiquetasIds.length > 0 ||
      urls.trim() !== '' ||
      arquivos.length > 0 ||
      !!capaUrl ||
      dataProgramada !== '' ||
      prazoInterno !== '';

  async function fechar() {
    if (
      sujo &&
      !(await confirmDialog({
        title: 'Descartar alterações?',
        description: editando
          ? 'Você tem alterações nesta demanda que ainda não foram salvas.'
          : 'A demanda ainda não foi criada. Se fechar agora, o que você preencheu será perdido.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'destructive',
      }))
    ) {
      return;
    }
    onFechar();
  }

  /** Demanda com o que está no formulário (salvo ou não), para o agendamento. */
  function itemComEdicoes(base: ConteudoItem): ConteudoItem {
    return {
      ...base,
      titulo,
      legenda,
      tipo,
      arquivos,
      checklist,
      data_programada: deInputData(dataProgramada, base.data_programada) ?? base.data_programada,
    };
  }

  function inserirNaLegenda(trecho: string) {
    const el = legendaRef.current;
    if (!el) {
      setLegenda((prev) => prev + trecho);
      return;
    }
    const inicio = el.selectionStart ?? legenda.length;
    const fim = el.selectionEnd ?? inicio;
    setLegenda(legenda.slice(0, inicio) + trecho + legenda.slice(fim));
    const posicao = inicio + trecho.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(posicao, posicao);
    });
  }

  function transformarSelecao(fn: (trecho: string) => string) {
    const { ini, fim } = selecaoLegenda;
    if (fim <= ini) return;
    const novo = fn(legenda.slice(ini, fim));
    setLegenda(legenda.slice(0, ini) + novo + legenda.slice(fim));
    const el = legendaRef.current;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini, ini + novo.length);
      setSelecaoLegenda({ ini, fim: ini + novo.length });
    });
  }

  useEffect(() => {
    let vivo = true;
    fetch('/api/etiquetas')
      .then((r) => (r.ok ? r.json() : { etiquetas: [] }))
      .then((c) => vivo && setEtiquetas(c.etiquetas ?? []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function criarEtiqueta(nome: string, cor: CorEtiqueta): Promise<Etiqueta | null> {
    const res = await fetch('/api/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, cor }) });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(corpo.error || 'Não foi possível criar a etiqueta.', 'error');
      return null;
    }
    setEtiquetas((prev) => [...prev, corpo.etiqueta].sort((a, b) => a.nome.localeCompare(b.nome)));
    return corpo.etiqueta as Etiqueta;
  }

  async function apagarEtiqueta(id: string) {
    const res = await fetch(`/api/etiquetas/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast('Não foi possível apagar a etiqueta.', 'error');
    setEtiquetas((prev) => prev.filter((e) => e.id !== id));
    setEtiquetasIds((prev) => prev.filter((x) => x !== id));
  }

  async function copiarTexto(texto: string, sucesso: string, falha: string) {
    try {
      await navigator.clipboard.writeText(texto);
      showToast(sucesso, 'success');
    } catch {
      showToast(falha, 'error');
    }
  }

  async function handleArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const lista = e.target.files;
    if (!lista?.length) return;
    setEnviandoArquivos(true);
    try {
      const novos: ArquivoConteudo[] = [];
      for (const [i, arquivo] of Array.from(lista).entries()) {
        const res = await uploadMediaFile(arquivo, 'conteudo');
        novos.push({ id: crypto.randomUUID(), url: res.url, tipo: res.tipo, ordem: i + 1, nome: res.nome });
      }
      setArquivos((prev) => [...prev, ...novos]);
      showToast(`${novos.length} arquivo(s) carregado(s)!`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar arquivos.', 'error');
    } finally {
      setEnviandoArquivos(false);
      e.target.value = '';
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) {
      showToast('Selecione um cliente para a demanda.', 'error');
      return;
    }
    setSalvando(true);
    try {
      const urlsManuais = urls
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url, idx) => ({
          id: crypto.randomUUID(),
          url,
          tipo: tipo === 'reel' ? ('video' as const) : ('imagem' as const),
          ordem: arquivos.length + idx + 1,
        }));

      const corpo: Record<string, any> = {
        cliente_id: clienteId || item?.cliente_id,
        tipo,
        status,
        prioridade,
        titulo: titulo.trim() || null,
        briefing: briefing.trim() || null,
        legenda: legenda.trim() || null,
        responsavel_id: responsavelId || null,
        co_responsaveis_ids: coResponsaveis.filter((id) => id !== responsavelId),
        editor_id: editorId || null,
        // Dia inalterado devolve o valor original: salvar não apaga o horário agendado.
        data_programada: deInputData(dataProgramada, item?.data_programada),
        prazo: deInputData(prazoInterno, item?.prazo),
        arquivos: [...arquivos, ...urlsManuais],
        cover_url: tipo === 'reel' ? capaUrl : null,
      };

      if (briefingEditado && briefingHtml) {
        corpo.briefing_html = briefingHtml;
      }
      if (etiquetasIds && etiquetasIds.length > 0) {
        corpo.etiquetas_ids = etiquetasIds;
      }
      if (checklist && checklist.length > 0) {
        corpo.checklist = checklist;
      }
      if (tempoEstimadoMinutos !== null) {
        corpo.tempo_estimado_minutos = tempoEstimadoMinutos;
      }
      if (visivelCliente !== undefined) {
        corpo.visivel_cliente = visivelCliente;
      }
      if (pedidoInformacao) {
        corpo.pedido_informacao = pedidoInformacao;
      }
      if (respostaInformacao) {
        corpo.resposta_informacao = respostaInformacao;
      }
      if (concluida !== undefined) {
        corpo.concluida = concluida;
      }

      const res = await fetch(editando ? `/api/conteudo/${item.id}` : '/api/conteudo', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSalvo(data.item, !editando);
      if (status === 'revisao_cliente' && data?.whatsapp?.enviado) {
        showToast('Demanda salva e link disparado automaticamente no WhatsApp do cliente!', 'success');
      } else {
        showToast(editando ? 'Demanda atualizada com sucesso!' : 'Nova demanda cadastrada com sucesso na esteira!', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Erro ao salvar a demanda.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!item) return;
    const ok = await confirmDialog({
      title: 'Excluir esta demanda?',
      description: 'Ela sai da esteira junto com comentários e arquivos anexados.',
      confirmLabel: 'Excluir demanda',
      tone: 'destructive',
    });
    if (!ok) return;
    setExcluindo(true);
    try {
      const res = await fetch(`/api/conteudo/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir demanda.');
      onExcluido(item.id);
      showToast('Demanda excluída da esteira.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
    } finally {
      setExcluindo(false);
    }
  }

  async function handleEnviarComentario() {
    if (!item || !novoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      // O autor é quem está logado; o servidor resolve pelo login.
      const res = await fetch(`/api/conteudo/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novo_comentario_equipe: novoComentario.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comentário');
      onItemAtualizado(data.item);
      setNovoComentario('');
      showToast('Comentário registrado na demanda!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao registrar comentário.', 'error');
    } finally {
      setEnviandoComentario(false);
    }
  }

  const barraLegenda = (compacta: boolean) => (
    <div
      className={`flex items-center gap-1 ${compacta ? 'p-1' : 'p-1.5'} bg-accent/40 rounded-t-xl border border-border border-b-0 text-xs text-muted-foreground flex-wrap shrink-0`}
    >
      <button
        type="button"
        onClick={() => inserirNaLegenda('\n• ')}
        className="px-2 py-0.5 rounded hover:bg-card text-foreground cursor-pointer text-xs"
        aria-label="Inserir item de lista"
      >
        • Lista
      </button>
      <button
        type="button"
        onClick={() => inserirNaLegenda(' #')}
        className="grid size-7 place-items-center rounded hover:bg-card text-foreground cursor-pointer"
        aria-label="Inserir hashtag"
        title="Inserir hashtag"
      >
        <Hash className="size-3.5" />
      </button>
      <span aria-hidden className="w-px h-3 bg-border mx-1" />
      {([
        ['A', 'MAIÚSCULAS', paraMaiusculas, 'font-semibold'],
        ['a', 'minúsculas', paraMinusculas, ''],
        ['Aa', 'Primeira Letra Maiúscula', paraCapitalizado, ''],
        ['B', 'Negrito', paraNegrito, 'font-black'],
        ['I', 'Itálico', paraItalico, 'italic'],
      ] as const).map(([rotulo, titulo, fn, estilo]) => (
        <button
          key={titulo}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => transformarSelecao(fn)}
          disabled={selecaoLegenda.fim <= selecaoLegenda.ini}
          className={`grid size-7 place-items-center rounded hover:bg-card text-foreground cursor-pointer text-xs disabled:opacity-35 disabled:pointer-events-none ${estilo}`}
          aria-label={titulo}
          title={`${titulo} (selecione um trecho)`}
        >
          {rotulo}
        </button>
      ))}
      <span aria-hidden className="w-px h-3 bg-border mx-1" />
      {(compacta ? EMOJIS_LEGENDA.slice(0, 5) : EMOJIS_LEGENDA).map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => inserirNaLegenda(emoji)}
          className="p-1 rounded hover:bg-card cursor-pointer text-xs"
          aria-label={`Inserir ${emoji}`}
        >
          {emoji}
        </button>
      ))}
      {/* Modelos de legenda do cliente */}
      {modelosLegenda.length > 0 && (
        <Menu.Root>
          <Menu.Trigger
            type="button"
            className="px-2 py-0.5 rounded hover:bg-card text-foreground cursor-pointer text-xs font-semibold flex items-center gap-1 transition-colors border border-border/60"
            aria-label="Modelos de Legenda"
          >
            <BookOpen className="w-3 h-3 text-brand-text" />
            <span>Modelos ({modelosLegenda.length})</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-[85]">
              <Menu.Popup className="min-w-64 max-w-xs rounded-2xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-xl outline-none">
                <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Modelos do Cliente</p>
                {modelosLegenda.map((mod) => (
                  <Menu.Item
                    key={mod.id}
                    onClick={() => handleInserirModeloLegenda(mod.texto)}
                    className="flex flex-col gap-0.5 rounded-xl px-2.5 py-1.5 text-xs cursor-pointer outline-none data-highlighted:bg-accent text-left"
                  >
                    <span className="font-semibold text-foreground">{mod.nome}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{mod.texto}</span>
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}

      {/* Salvar como modelo padrão */}
      <button
        type="button"
        onClick={handleSalvarLegendaComoPadrao}
        disabled={!legenda.trim() || !clienteId}
        className="px-2 py-0.5 rounded hover:bg-card text-foreground cursor-pointer text-xs font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Salvar esta legenda como modelo para este cliente"
      >
        <BookmarkPlus className="w-3 h-3 text-brand-text" />
        <span className="hidden sm:inline">Salvar como padrão</span>
      </button>

      <button
        type="button"
        onClick={() => copiarTexto(legenda, 'Legenda copiada.', 'Não foi possível copiar a legenda.')}
        disabled={!legenda.trim()}
        className="ml-auto px-2 py-0.5 rounded hover:bg-card text-foreground cursor-pointer text-xs font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Copy className="w-3 h-3" /> {compacta ? 'Copiar' : 'Copiar legenda'}
      </button>
    </div>
  );

  const avisoLimiteLegenda = legenda.length > LIMITE_LEGENDA && (
    <p className="text-xs text-destructive">
      O Instagram não aceita legenda com mais de 2.200 caracteres. Corte{' '}
      {(legenda.length - LIMITE_LEGENDA).toLocaleString('pt-BR')} antes de publicar.
    </p>
  );


  return (
    <Sheet
      open={aberto}
      onClose={onFechar}
      dirty={sujo}
      aria-label={editando ? 'Editar demanda' : 'Nova demanda'}
      className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl p-0 overflow-hidden rounded-[32px] border border-border/80 shadow-2xl"
    >
      <form
        ref={formRef}
        onSubmit={handleSalvar}
        onKeyDown={(e) => {
          // Ctrl+S / ⌘+S salva sem tirar a mão do teclado (e não abre o "salvar página" do navegador).
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (!salvando) e.currentTarget.requestSubmit();
          }
        }}
        className="flex flex-col max-h-[92dvh] w-full bg-card rounded-[32px] max-sm:rounded-b-none overflow-hidden"
      >
        {/* 1. Cabeçalho: contexto + etapa + ações; título em linha própria */}
        <div className="px-4 sm:px-6 pt-4 pb-4 border-b border-border flex flex-col gap-3 bg-card shrink-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {editando ? 'Demanda' : 'Nova demanda'} · {ETAPAS_PIPELINE.find((e) => e.status === status)?.label ?? 'Ajuste pedido'}
            </p>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {editando && (
                <Tip label="Copiar link de aprovação com prévia para o WhatsApp">
                  <button
                    type="button"
                    onClick={() => {
                      if (item?.token_aprovacao) {
                        onCopiarLinkAprovacao(item.token_aprovacao);
                      } else {
                        showToast('Esta demanda ainda não possui link de aprovação.', 'error');
                      }
                    }}
                    className="size-8 sm:size-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-accent/60 hover:bg-accent border border-border text-foreground font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-xs shadow-2xs shrink-0 !min-w-0"
                    aria-label="Copiar link de aprovação do cliente para WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5 text-brand-text" />
                    <span className="hidden sm:inline">Link aprovação</span>
                  </button>
                </Tip>
              )}

              {editando && (status === 'agendamento' || status === 'pronto_publicar') && onLevarParaAgendamento && (
                <Tip label="Agendamento">
                  <button
                    type="button"
                    onClick={() => onLevarParaAgendamento(itemComEdicoes(item))}
                    className="size-8 sm:size-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-semibold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-xs shrink-0 !min-w-0"
                    aria-label="Agendar postagem"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Agendamento</span>
                  </button>
                </Tip>
              )}

              {editando && (
                <Menu.Root>
                  <Menu.Trigger
                    aria-label="Mais ações da demanda"
                    className="size-8 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors data-popup-open:bg-accent data-popup-open:text-foreground !min-w-0"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[80]">
                      <Menu.Popup className="min-w-64 rounded-2xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-xl outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0">
                        <Menu.Item
                          onClick={() => {
                            if (item?.token_aprovacao) {
                              onCopiarLinkAprovacao(item.token_aprovacao);
                            } else {
                              showToast('Esta demanda ainda não possui link de aprovação.', 'error');
                            }
                          }}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent font-medium text-brand-text"
                        >
                          <Share2 className="size-3.5 text-brand-text" />
                          <span className="flex-1">Copiar link de aprovação (WhatsApp)</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={handleCopiarLinkPainelInterno}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Copiar link interno da esteira</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => copiarTexto(item.id, 'ID da demanda copiado.', 'Não foi possível copiar o ID.')}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Copiar ID</span>
                          <span className="font-mono text-xs text-muted-foreground">#{item.id.slice(0, 8)}</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={handleDuplicar}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <Copy className="size-3.5 text-brand-text" />
                          <span className="flex-1">Duplicar demanda</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => setTrocarClienteAberto(true)}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Mover para outro cliente</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            setInputEstimado(tempoEstimadoMinutos ? String(tempoEstimadoMinutos) : '');
                            setModalEstimadoAberto(true);
                          }}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <Clock className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Tempo estimado</span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {tempoEstimadoMinutos ? `${tempoEstimadoMinutos} min` : 'Não definido'}
                          </span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            setTextoPedidoInfo(pedidoInformacao || '');
                            setModalPedidoInfoAberto(true);
                          }}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <HelpCircle className="size-3.5 text-warning" />
                          <span className="flex-1">Pedir informação ao cliente</span>
                          {pedidoInformacao && <span className="size-1.5 rounded-full bg-warning" />}
                        </Menu.Item>
                        <Menu.Item
                          onClick={handleArquivar}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <Archive className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Arquivar demanda</span>
                        </Menu.Item>
                        <Menu.Separator className="my-1 h-px bg-border" />
                        <Menu.Item
                          onClick={handleExcluir}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs cursor-pointer outline-none text-destructive data-highlighted:bg-destructive-soft"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Excluir demanda</span>
                        </Menu.Item>
                        {item.criado_em && (
                          <div className="px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground border-t border-border mt-1">
                            Criada em {new Date(item.criado_em).toLocaleDateString('pt-BR')} às {new Date(item.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              )}

              <button
                type="button"
                onClick={fechar}
                className="size-8 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors !min-w-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de comandos no celular: Excluir / Cancelar / Salvar sempre à vista */}
          <div className="md:hidden flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              {editando && (
                <Tip label="Excluir demanda">
                  <button
                    type="button"
                    onClick={handleExcluir}
                    disabled={excluindo || salvando}
                    aria-label="Excluir demanda"
                    className="size-8 shrink-0 grid place-items-center rounded-xl bg-destructive-soft text-destructive hover:bg-destructive/20 cursor-pointer disabled:opacity-50 !min-w-0"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </Tip>
              )}
              <span aria-live="polite" className="min-w-0 truncate text-[11px]">
                {excluindo ? (
                  <span className="text-muted-foreground">Excluindo…</span>
                ) : sujo ? (
                  <span className="inline-flex items-center gap-1 font-medium text-warning">
                    <span aria-hidden className="size-1.5 rounded-full bg-warning shrink-0" />
                    {editando ? 'Não salvo' : 'Novo'}
                  </span>
                ) : null}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={fechar} className="h-8 px-2.5 text-xs">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={salvando} className="h-8 px-3 text-xs font-bold" title={editando ? 'Salvar (Ctrl+S)' : 'Criar demanda (Ctrl+S)'}>
                {editando ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>

          {/* Título editorial em Sora */}
          <AutoTextarea
            bare
            value={titulo}
            onChange={(e) => setTitulo(e.target.value.replace(/\n+/g, ' '))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder={editando ? 'Título da demanda' : 'Dê um título à demanda'}
            aria-label="Título da demanda"
            required
            autoFocus={!editando}
            className="w-full bg-transparent text-xl sm:text-2xl font-bold font-display tracking-tight text-foreground placeholder:text-muted-foreground rounded-lg px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 leading-snug"
          />

          {/* Tags Cápsula (Formato, Nicho/Categoria, Prioridade, Ajuste) */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent text-foreground border border-border">
              {React.createElement(FORMATOS.find((f) => f.id === tipo)?.icon || ImageIcon, { className: 'w-3 h-3 text-brand-text shrink-0' })}
              <span>{FORMATOS.find((f) => f.id === tipo)?.label || 'Post'}</span>
            </span>

            {clienteObj?.nicho && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/80 text-muted-foreground border border-border/80">
                {clienteObj.nicho}
              </span>
            )}

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${PRIORIDADE_CONFIG[prioridade].bg} ${PRIORIDADE_CONFIG[prioridade].text} border ${PRIORIDADE_CONFIG[prioridade].border}`}>
              <span className={`size-1.5 rounded-full shrink-0 ${PRIORIDADE_CONFIG[prioridade].dot}`} />
              {PRIORIDADE_CONFIG[prioridade].label}
            </span>

            <EtiquetasSeletor etiquetas={etiquetas} selecionadas={etiquetasIds} onChange={setEtiquetasIds} onCriar={criarEtiqueta} onApagar={apagarEtiqueta} />

            {/* Prazo e responsáveis moram na mesma linha de chips. */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/60 text-foreground border border-border">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              {prazoInterno
                ? new Date(`${prazoInterno}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                : 'Sem prazo'}
            </span>
            <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/60 text-foreground border border-border">
              <span className="flex items-center -space-x-1.5">
                {[responsavelId, ...coResponsaveis]
                  .filter((id, i, arr) => !!id && arr.indexOf(id) === i)
                  .slice(0, 3)
                  .map((id) => {
                    const m = membrosLocais.find((mb) => mb.id === id);
                    return (
                      <ClienteAvatar
                        key={id}
                        nome={m?.nome || 'Membro'}
                        fotoUrl={m && 'foto_url' in m ? (m.foto_url as string) : undefined}
                        tamanho="xs"
                        className="ring-2 ring-card"
                      />
                    );
                  })}
              </span>
              {[responsavelId, ...coResponsaveis].some(Boolean) ? null : <span className="pl-1.5 italic text-muted-foreground">Sem responsável</span>}
            </span>

            {status === 'travado' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive-soft text-destructive border border-destructive-ring">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Ajuste pedido
              </span>
            )}
          </div>
        </div>

        {/* 2. Corpo rolável: conteúdo à esquerda, cartão de ação e propriedades à direita (como no Orkestrya) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-7 min-w-0">
            {editando && item?.id && (
              <SugestoesTextoCard
                itemId={item.id}
                showToast={showToast}
                onAceita={(campo: CampoSugestao, texto: string) => {
                  if (campo === 'titulo') setTitulo(texto);
                  else if (campo === 'legenda') setLegenda(texto);
                  else {
                    setBriefing(texto);
                    setBriefingHtml(textoParaHtml(texto));
                    setChaveEditor((k) => k + 1);
                  }
                }}
              />
            )}

            <section aria-label="Descrição" className="flex flex-col gap-2.5">
              <SecaoTitulo icon={AlignLeft}>Descrição</SecaoTitulo>
              <div className="flex flex-col gap-2">
                <EditorRico
                  key={chaveEditor}
                  valorInicial={chaveEditor === 0 ? conteudoInicial(item?.briefing_html, item?.briefing) : conteudoInicial(briefingHtml, briefing)}
                  placeholder="Escreva o briefing da demanda. Dica: -- cria uma linha divisória."
                  aria-label="Briefing e roteiro"
                  minHeight="140px"
                  onChange={(html, texto) => {
                    setBriefingHtml(html);
                    setBriefing(texto);
                    setBriefingEditado(true);
                  }}
                />
                <p className={`text-right text-xs font-mono tabular-nums ${briefing.length > LIMITE_BRIEFING ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {briefing.length.toLocaleString('pt-BR')}/{LIMITE_BRIEFING.toLocaleString('pt-BR')}
                </p>
              </div>
            </section>

            <section aria-label="Legenda" className="flex flex-col gap-2.5">
              <SecaoTitulo icon={MessageSquare}>Legenda</SecaoTitulo>
              <div className="flex flex-col gap-1.5">
                {barraLegenda(false)}
                <AutoTextarea
                  ref={legendaRef}
                  value={legenda}
                  onChange={(e) => setLegenda(e.target.value)}
                  onSelect={(e) => setSelecaoLegenda({ ini: e.currentTarget.selectionStart, fim: e.currentTarget.selectionEnd })}
                  placeholder="Escreva a legenda do post, com as hashtags."
                  aria-label="Legenda da postagem"
                  aria-invalid={legenda.length > LIMITE_LEGENDA || undefined}
                  className="rounded-t-none rounded-b-2xl text-sm font-sans leading-relaxed bg-card min-h-[160px]"
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ImageIcon className="size-3.5 shrink-0" aria-hidden />
                  Foto e vídeo enviados por aqui entram nos Anexos do post, não no texto da legenda.
                </p>
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
                  <span className={contarHashtags(legenda) > 30 ? 'text-destructive' : ''}>{contarHashtags(legenda)}/30 hashtags</span>
                  <span className={classeContadorLegenda(legenda.length)}>
                    Instagram {legenda.length.toLocaleString('pt-BR')}/{LIMITE_LEGENDA.toLocaleString('pt-BR')}
                  </span>
                </div>
                {avisoLimiteLegenda}
              </div>
            </section>

                {tipo === 'reel' && (
                  <CapaReelsField url={capaUrl} onChange={setCapaUrl} onPreview={setPreviewLightbox} onErro={(msg) => showToast(msg, 'error')} />
                )}

            <section aria-label="Anexos" className="flex flex-col gap-2.5">
              <SecaoTitulo icon={Paperclip}>
                {tipo === 'reel' ? 'Vídeo' : 'Anexos'}
                <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{arquivos.length}</span>
              </SecaoTitulo>
                  <div className="flex flex-col gap-3 flex-1 min-h-0">
                    <div className="relative border-2 border-dashed border-border hover:border-border-strong rounded-2xl p-4 text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors">
                      <input
                        type="file"
                        multiple={tipo !== 'reel'}
                        accept={tipo === 'reel' ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime'}
                        onChange={handleArquivos}
                        disabled={enviandoArquivos}
                        aria-label={tipo === 'reel' ? 'Anexar vídeo' : 'Anexar imagens ou vídeos'}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                      />
                      <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-foreground shadow-2xs">
                        <UploadCloud className="w-4 h-4 text-brand-text" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        {enviandoArquivos ? 'Enviando arquivos…' : 'Clique ou arraste novos arquivos para anexar'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tipo === 'reel' ? 'Vídeo MP4 em 9:16' : 'Fotos para post único ou carrossel em 4:5'}
                      </p>
                    </div>

                    {arquivos.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                        {arquivos.map((arq, idx) => (
                          <div
                            key={arq.id || idx}
                            className="p-2.5 rounded-xl bg-accent/30 border border-border flex items-center justify-between gap-2.5 hover:border-border-strong transition-ui"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-black overflow-hidden shrink-0 border border-border relative">
                                {arq.tipo === 'video' ? (
                                  <video src={arq.url} className="w-full h-full object-cover" muted />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={arq.url} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground truncate">{arq.nome || `Arquivo ${idx + 1}`}</span>
                                  {idx === 0 && <Badge variant="brand">Capa</Badge>}
                                </div>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  #{idx + 1} · {arq.tipo === 'video' ? 'Vídeo' : 'Imagem'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewLightbox(arq.url)}
                                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                                aria-label={`Ver ${arq.nome || `arquivo ${idx + 1}`} em tamanho real`}
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setArquivos((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1 rounded hover:bg-destructive-soft text-muted-foreground hover:text-destructive cursor-pointer"
                                aria-label={`Remover ${arq.nome || `arquivo ${idx + 1}`}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum arquivo anexado a esta demanda.</p>
                    )}

                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setMostrarUrlsManuais((v) => !v)}
                        aria-expanded={mostrarUrlsManuais}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
                      >
                        {mostrarUrlsManuais ? '− Ocultar links manuais' : '+ Inserir links externos manualmente (Google Drive / CDN)'}
                      </button>
                      {mostrarUrlsManuais && (
                        <Textarea
                          placeholder="https://.../slide-01.png&#10;https://.../slide-02.png"
                          value={urls}
                          onChange={(e) => setUrls(e.target.value)}
                          aria-label="Links externos, um por linha"
                          rows={2}
                          className="mt-1.5 text-xs font-mono"
                        />
                      )}
                    </div>
                  </div>
            </section>

            {editando && (
              <>
                <section aria-label="Checklist" className="flex flex-col gap-2.5">
                {/* Bloco de Checklist com barra de progresso (Imagem 3) */}
                <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-display">
                    <ListTodo className="w-3.5 h-3.5 text-primary" />
                    Checklist
                  </span>
                  {checklist.length > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-mono tabular-nums">
                      {checklist.filter((c) => c.concluido).length}/{checklist.length}
                    </span>
                  )}
                </div>
                {checklist.length > 0 && (
                  <span className="text-xs font-bold text-muted-foreground font-mono tabular-nums">
                    {Math.round((checklist.filter((c) => c.concluido).length / checklist.length) * 100)}%
                  </span>
                )}
              </div>

              {/* Barra de progresso visual */}
              {checklist.length > 0 && (
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${(checklist.filter((c) => c.concluido).length / checklist.length) * 100}%`,
                    }}
                  />
                </div>
              )}

              {/* Lista de itens interativos */}
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
                {checklist.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">Nenhum item no checklist ainda.</p>
                ) : (
                  checklist.map((cItem) => (
                    <div
                      key={cItem.id}
                      className="group flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-muted/50 transition-colors text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(cItem.id)}
                        className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className={`size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            cItem.concluido
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 hover:border-primary'
                          }`}
                        >
                          {cItem.concluido && <Check className="size-2.5 stroke-[3]" />}
                        </div>
                        <span
                          className={`truncate text-xs ${
                            cItem.concluido
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground font-medium'
                          }`}
                        >
                          {cItem.texto}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoverItemChecklist(cItem.id)}
                        aria-label="Remover item"
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-opacity cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Input rápido para adicionar novo item */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
                <Input
                  value={novoItemTexto}
                  onChange={(e) => setNovoItemTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdicionarItemChecklist();
                    }
                  }}
                  placeholder="+ Adicionar item ao checklist..."
                  className="h-8 text-xs bg-accent/20 rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAdicionarItemChecklist}
                  disabled={!novoItemTexto.trim()}
                  className="h-8 px-2.5 rounded-xl text-xs shrink-0 cursor-pointer"
                >
                  <Plus className="size-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            </section>

            <section aria-label="Comentários" className="flex flex-col gap-2.5">
            {/* Comentários & Alinhamento em balões acolhedores */}
              <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2.5 flex-1 min-h-[180px]">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-display">
                    <MessageSquare className="w-3.5 h-3.5 text-brand-text" />
                    Comentários & Alinhamento
                  </span>
                  {(item.historico_atividades?.length || 0) + (item.comentarios_revisao?.length || 0) > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-mono tabular-nums">
                      {(item.historico_atividades?.length || 0) + (item.comentarios_revisao?.length || 0)}
                    </span>
                  )}
                </div>

                <div role="tablist" aria-label="Comentários, histórico e aprovação" className="flex items-center gap-1 rounded-full bg-muted/60 p-1 self-start">
                  {([['comentarios', 'Comentários'], ['historico', 'Histórico'], ['aprovacao', 'Aprovação']] as const).map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={abaComent === id}
                      onClick={() => setAbaComent(id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                        abaComent === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>

                {abaComent === 'aprovacao' && (
                  <div className="flex flex-col gap-2">
                {/* Ajustes do cliente ou Confirmação de Aprovação */}
                {(() => {
                  const ajustesPendentes = (item.comentarios_revisao || []).filter(
                    (c) => !c.resolvido && c.texto && !c.texto.toLowerCase().includes('aprovad')
                  );
                  const foiAprovado =
                    item.status === 'agendamento' ||
                    item.status === 'pronto_publicar' ||
                    item.status === 'publicado' ||
                    (item.historico_atividades || []).some((h) => h.texto?.toLowerCase().includes('aprovad'));

                  if (ajustesPendentes.length > 0) {
                    return (
                      <div className="p-3 rounded-2xl bg-warning-soft border border-warning-ring space-y-2">
                        <p className="text-xs font-bold text-warning flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Ajustes pedidos pelo cliente ({ajustesPendentes.length})
                        </p>
                        {ajustesPendentes.map((c) => {
                          const slideImg = (c.slide_index && item.arquivos && item.arquivos[c.slide_index - 1]?.url) || null;
                          return (
                            <div key={c.id} className="text-xs p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground text-xs font-semibold">{c.autor || 'Cliente'}</span>
                                {c.slide_index ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning-soft text-warning border border-warning-ring font-mono font-bold text-[10px]">
                                    Slide #{c.slide_index}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground font-medium">Geral / Post</span>
                                )}
                              </div>
                              <div className="flex gap-2.5 items-start">
                                {slideImg && (
                                  <a
                                    href={slideImg}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="relative shrink-0 w-11 h-14 rounded-lg overflow-hidden border border-border bg-muted group/thumb block shadow-2xs"
                                    title={`Ver Slide ${c.slide_index}`}
                                  >
                                    <img
                                      src={slideImg}
                                      alt={`Slide ${c.slide_index}`}
                                      className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                                    />
                                    <span className="absolute bottom-0 inset-x-0 bg-black/75 text-white font-mono text-[8px] text-center font-bold py-0.5">
                                      #{c.slide_index}
                                    </span>
                                  </a>
                                )}
                                <p className="text-foreground flex-1 whitespace-pre-wrap">{c.texto}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (foiAprovado) {
                    return (
                      <div className="p-3 rounded-2xl bg-success-soft border border-success-ring flex items-center gap-2 text-xs font-semibold text-success">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Publicação aprovada pelo cliente. Pronta para agendamento e postagem.</span>
                      </div>
                    );
                  }

                  return null;
                })()}
                    <p className="text-xs text-muted-foreground">Aqui aparecem os ajustes pedidos pelo cliente e a confirmação de aprovação.</p>
                  </div>
                )}

                {abaComent === 'historico' && (
                  <ol className="flex flex-col gap-2.5" aria-label="Histórico da demanda">
                    {[
                      ...(item.historico_atividades ?? []).map((ev) => ({ id: ev.id, autor: ev.autor_nome || 'Equipe', texto: ev.texto, quando: ev.criado_em })),
                      ...(item.comentarios_revisao ?? []).map((c) => ({ id: c.id, autor: c.autor || 'Cliente', texto: c.texto, quando: (c as { criado_em?: string }).criado_em ?? '' })),
                    ]
                      .sort((x, y) => (x.quando < y.quando ? 1 : -1))
                      .map((ev) => (
                        <li key={ev.id} className="flex items-start gap-2.5 text-xs">
                          <ClienteAvatar nome={ev.autor} tamanho="xs" className="mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground">
                              <span className="font-semibold text-foreground">{ev.autor}</span>
                              {ev.quando && ` · ${new Date(ev.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                            </p>
                            <p className="whitespace-pre-wrap text-foreground">{ev.texto}</p>
                          </div>
                        </li>
                      ))}
                    {(item.historico_atividades?.length ?? 0) + (item.comentarios_revisao?.length ?? 0) === 0 && (
                      <p className="py-2 text-center text-xs text-muted-foreground">Nada registrado ainda.</p>
                    )}
                  </ol>
                )}

                {abaComent === 'comentarios' && (
                  <>
                {/* Thread de balões com avatar e destaque de menções */}
                <div className="space-y-2.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1 flex-1">
                  {!item.historico_atividades || item.historico_atividades.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhum comentário registrado ainda.</p>
                  ) : (
                    item.historico_atividades.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-2.5">
                        <ClienteAvatar nome={ev.autor_nome || 'Equipe'} tamanho="xs" className="mt-0.5 shrink-0" />
                        <div className="flex-1 rounded-2xl bg-muted/60 dark:bg-muted/30 border border-border/40 p-3 text-xs flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">{ev.autor_nome || 'Equipe'}</span>
                            <time dateTime={ev.criado_em} className="tabular-nums text-muted-foreground">
                              {new Date(ev.criado_em).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>
                          <p className="text-foreground text-xs whitespace-pre-wrap leading-relaxed">
                            {renderComentarioTexto(ev.texto)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input de novo comentário */}
                <div className="flex gap-2 pt-2 border-t border-border shrink-0">
                  <Textarea
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                    placeholder="Escreva um comentário (use @nome para mencionar, Ctrl+Enter para enviar)..."
                    aria-label="Novo comentário interno"
                    rows={2}
                    className="text-xs flex-1 bg-accent/20 resize-none h-14 rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleEnviarComentario();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={!novoComentario.trim() || enviandoComentario}
                    loading={enviandoComentario}
                    onClick={handleEnviarComentario}
                    aria-label="Enviar comentário"
                    className="h-14 px-3.5 rounded-xl text-xs shrink-0 cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>

          <aside className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
            {/* Cartão escuro de ação e propriedades */}
            <div className="flex flex-col gap-2 rounded-3xl bg-panel p-3 text-panel-foreground">
              {editando && getEtapaIndex(status) < 4 && status !== 'travado' && (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  block
                  loading={salvando}
                  onClick={() => {
                    // Salvar já em "Aprovação do cliente" é o que dispara o envio ao cliente.
                    flushSync(() => setStatus('revisao_cliente'));
                    formRef.current?.requestSubmit();
                  }}
                >
                  <Send className="size-4" />
                  Enviar post para aprovação
                </Button>
              )}

              {/* Botão de Concluir demanda */}
              {editando && (
                <button
                  type="button"
                  onClick={handleToggleConcluida}
                  className={`w-full h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors border ${
                    concluida
                      ? 'bg-success text-success-foreground border-success hover:bg-success/90'
                      : 'bg-white/10 hover:bg-white/15 text-panel-foreground border-white/20'
                  }`}
                >
                  <CheckCircle2 className="size-4" />
                  <span>{concluida ? 'Demanda Concluída ✓' : 'Marcar como concluída'}</span>
                </button>
              )}

              {/* Cronômetro e Tempo na demanda */}
              {editando && (
                <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-white/5 border border-white/10 mt-1">
                  <div className="flex items-center justify-between text-xs text-panel-muted font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Timer className="size-3.5 text-panel-foreground" />
                      Tempo na demanda
                    </span>
                    <span className="font-mono text-panel-foreground font-bold tabular-nums">
                      {formatarTempoExtenso(totalSegundos)}
                    </span>
                  </div>

                  {tempoEstimadoMinutos && tempoEstimadoMinutos > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            totalSegundos / 60 > tempoEstimadoMinutos ? 'bg-destructive' : 'bg-primary'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.round((totalSegundos / (tempoEstimadoMinutos * 60)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-panel-muted font-mono">
                        <span>Gasto: {Math.round(totalSegundos / 60)}m</span>
                        <span>Estimado: {tempoEstimadoMinutos}m</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleToggleCronometro}
                      className={`flex-1 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        cronometroAtivo
                          ? 'bg-warning-soft text-warning border-warning-ring hover:bg-warning-soft/80'
                          : 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                      }`}
                    >
                      {cronometroAtivo ? (
                        <>
                          <Pause className="size-3.5 mr-1" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="size-3.5 mr-1" /> Iniciar
                        </>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setModalManualAberto(true)}
                      className="h-8 px-2.5 rounded-lg text-xs font-semibold text-white/80 hover:text-white bg-white/5 border border-white/10 hover:bg-white/15 cursor-pointer"
                      title="Adicionar tempo manualmente"
                    >
                      + Minutos
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                <LinhaPropriedade icon={Layers} rotulo="Etapa">
                  <select
                    value={status}
                    onChange={(e) => {
                      const novoStatus = e.target.value as StatusConteudo;
                      setStatus(novoStatus);
                      if (
                        novoStatus === 'agendamento' ||
                        novoStatus === 'pronto_publicar' ||
                        novoStatus === 'publicado'
                      ) {
                        setConcluida(true);
                      }
                    }}
                    aria-label={editando ? 'Etapa da demanda' : 'Etapa inicial'}
                    className={CAMPO_PAINEL}
                  >
                    {status === 'travado' && <option value="travado">Ajuste pedido</option>}
                    {ETAPAS_PIPELINE.map((etapa) => (
                      <option key={etapa.status} value={etapa.status}>
                        {etapa.step}. {etapa.label}
                      </option>
                    ))}
                  </select>
                </LinhaPropriedade>
                <LinhaPropriedade icon={Flag} rotulo="Prioridade">
                  <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeConteudo)} aria-label="Prioridade" className={CAMPO_PAINEL}>
                    {(['urgente', 'alta', 'media', 'baixa'] as const).map((id) => (
                      <option key={id} value={id}>
                        {PRIORIDADE_CONFIG[id].label}
                      </option>
                    ))}
                  </select>
                </LinhaPropriedade>
                <LinhaPropriedade icon={ImageIcon} rotulo="Formato">
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoConteudo)} aria-label="Formato" className={CAMPO_PAINEL}>
                    {FORMATOS.map((fmt) => (
                      <option key={fmt.id} value={fmt.id}>
                        {fmt.label}
                      </option>
                    ))}
                  </select>
                </LinhaPropriedade>
                <LinhaPropriedade icon={Clock} rotulo="Prazo interno" detalhe={detalhePrazo(prazoInterno, status !== 'publicado')}>
                  <input type="date" value={prazoInterno} onChange={(e) => setPrazoInterno(e.target.value)} aria-label="Prazo interno" className={`${CAMPO_PAINEL} [color-scheme:dark]`} />
                </LinhaPropriedade>
                <LinhaPropriedade icon={Calendar} rotulo="Postagem" detalhe={detalhePrazo(dataProgramada, false)}>
                  <input type="date" value={dataProgramada} onChange={(e) => setDataProgramada(e.target.value)} aria-label="Data programada" className={`${CAMPO_PAINEL} [color-scheme:dark]`} />
                </LinhaPropriedade>
                <LinhaPropriedade icon={visivelCliente ? Eye : EyeOff} rotulo="Portal do cliente">
                  <button
                    type="button"
                    onClick={handleToggleVisivelCliente}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                      visivelCliente
                        ? 'bg-success-soft text-success border-success-ring'
                        : 'bg-white/10 text-panel-muted border-white/15'
                    }`}
                  >
                    {visivelCliente ? 'Visível' : 'Oculto'}
                  </button>
                </LinhaPropriedade>
              </div>
            </div>

            {/* Alerta de Pedido de Informação ao Cliente */}
            {pedidoInformacao && (
              <div className="p-3 rounded-2xl bg-warning-soft border border-warning-ring flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between text-warning font-bold">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="size-3.5" />
                    Aguardando cliente
                  </span>
                  <button
                    type="button"
                    onClick={handleLimparPedidoInformacao}
                    className="text-[11px] underline hover:no-underline font-normal text-muted-foreground cursor-pointer"
                  >
                    Concluir pedido
                  </button>
                </div>
                <p className="text-warning font-medium">{pedidoInformacao}</p>
                {respostaInformacao && (
                  <div className="mt-1 p-2 rounded-xl bg-card border border-border text-foreground">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Resposta recebida:</span>
                    <p className="text-xs">{respostaInformacao}</p>
                  </div>
                )}
              </div>
            )}

            {/* Cliente e equipe */}
            <div className="flex flex-col gap-2.5 rounded-3xl border border-border bg-card p-4 shadow-2xs">
              {/* Cliente */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Users className="w-3.5 h-3.5 text-brand-text" />
                  Cliente
                  {!editando && <span aria-hidden className="text-destructive">*</span>}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  {clienteObj && !trocarClienteAberto ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <ClienteAvatar nome={clienteObj.nome} cor={clienteObj.cor} fotoUrl={clienteObj.foto_url} tamanho="sm" />
                      <span className="text-xs font-semibold text-foreground truncate max-w-[130px]">{clienteObj.nome}</span>
                      <button
                        type="button"
                        onClick={() => setTrocarClienteAberto(true)}
                        className="text-xs font-semibold text-brand-text hover:underline cursor-pointer ml-0.5"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTrocarClienteAberto((v) => !v)}
                      aria-expanded={trocarClienteAberto}
                      className="text-xs font-semibold text-brand-text hover:underline cursor-pointer"
                    >
                      {trocarClienteAberto ? 'Fechar' : 'Selecionar'}
                    </button>
                  )}
                </div>
              </div>

              {trocarClienteAberto && (
                <div className="flex flex-col gap-1.5 pb-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      aria-label="Buscar cliente"
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      className="pl-8 h-8 text-xs bg-card"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 p-1 border border-border rounded-xl bg-card">
                    {clientesFiltrados.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-1 text-center">Nenhum cliente encontrado.</p>
                    ) : (
                      clientesFiltrados.map((c) => {
                        const selecionado = clienteId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={selecionado}
                            onClick={() => {
                              setClienteId(c.id);
                              setTrocarClienteAberto(false);
                            }}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-left transition-ui cursor-pointer ${
                              selecionado ? 'bg-accent font-semibold text-foreground' : 'hover:bg-accent/40 text-muted-foreground'
                            }`}
                          >
                            <ClienteAvatar nome={c.nome} cor={c.cor} fotoUrl={c.foto_url} tamanho="sm" />
                            <span className="text-xs truncate flex-1">{c.nome}</span>
                            {selecionado && <CheckCircle2 className="w-3.5 h-3.5 text-brand-text shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Equipe */}
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-border">
                <ResponsaveisSelect
                  label="Responsáveis"
                  value={[responsavelId, ...coResponsaveis].filter((id, i, ids) => !!id && ids.indexOf(id) === i)}
                  onChange={(ids) => {
                    setResponsavelId(ids[0] || '');
                    setCoResponsaveis(ids.slice(1));
                  }}
                  membros={membrosLocais}
                />
                <MemberChipSelect
                  label="Designer / Editor"
                  value={editorId}
                  onChange={setEditorId}
                  membros={membrosLocais}
                  placeholder="Atribuir..."
                />
              </div>

            </div>
          </aside>
        </div>

        {/* 3. Rodapé fixo (desktop): Excluir à esquerda, Cancelar e Salvar à direita */}
        <div className="max-md:hidden flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {editando && (
              <Button type="button" variant="outline" onClick={handleExcluir} disabled={excluindo || salvando} className="border-destructive/50 text-destructive hover:bg-destructive-soft">
                Excluir
              </Button>
            )}
            <span aria-live="polite" className="truncate text-xs">
              {excluindo ? (
                <span className="text-muted-foreground">Excluindo…</span>
              ) : sujo ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-warning">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
                  {editando ? 'Alterações não salvas' : 'Ainda não criada'}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={salvando} title={editando ? 'Salvar (Ctrl+S)' : 'Criar demanda (Ctrl+S)'}>
              {editando ? 'Salvar' : 'Criar demanda'}
            </Button>
          </div>
        </div>
      </form>

      {/* Modal Apontamento Manual de Tempo */}
      {modalManualAberto && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-4 shadow-xl flex flex-col gap-3 text-foreground">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-sm font-bold flex items-center gap-2">
                <Timer className="size-4 text-primary" />
                Apontar tempo gasto
              </span>
              <button
                type="button"
                onClick={() => setModalManualAberto(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Minutos trabalhados</label>
              <Input
                type="number"
                placeholder="Ex: 45"
                value={minutosManual}
                onChange={(e) => setMinutosManual(e.target.value)}
                className="h-10 text-sm font-mono"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Descrição (opcional)</label>
              <Input
                placeholder="Ex: Criação da arte no Canva"
                value={descManual}
                onChange={(e) => setDescManual(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalManualAberto(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleSalvarManual}>
                Adicionar tempo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tempo Estimado */}
      {modalEstimadoAberto && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-4 shadow-xl flex flex-col gap-3 text-foreground">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-sm font-bold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Definir tempo estimado
              </span>
              <button
                type="button"
                onClick={() => setModalEstimadoAberto(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tempo previsto (em minutos)</label>
              <Input
                type="number"
                placeholder="Ex: 60"
                value={inputEstimado}
                onChange={(e) => setInputEstimado(e.target.value)}
                className="h-10 text-sm font-mono"
                autoFocus
              />
              <span className="text-[11px] text-muted-foreground">Ex: 60 = 1 hora, 120 = 2 horas</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              {tempoEstimadoMinutos ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSalvarTempoEstimado(null)}
                  className="text-destructive hover:bg-destructive-soft"
                >
                  Remover
                </Button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalEstimadoAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const n = parseInt(inputEstimado, 10);
                    handleSalvarTempoEstimado(!isNaN(n) && n > 0 ? n : null);
                  }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pedir Informação ao Cliente */}
      {modalPedidoInfoAberto && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-4 shadow-xl flex flex-col gap-3 text-foreground">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-sm font-bold flex items-center gap-2">
                <HelpCircle className="size-4 text-warning" />
                Pedir informação ao cliente
              </span>
              <button
                type="button"
                onClick={() => setModalPedidoInfoAberto(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta solicitação aparecerá no portal do cliente para que ele responda antes ou durante a revisão.
            </p>
            <Textarea
              rows={3}
              placeholder="Ex: Por favor confirme se o preço da promoção deste post é R$ 49,90 ou R$ 59,90..."
              value={textoPedidoInfo}
              onChange={(e) => setTextoPedidoInfo(e.target.value)}
              className="text-xs"
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 pt-2">
              {pedidoInformacao ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLimparPedidoInformacao}
                  className="text-destructive hover:bg-destructive-soft"
                >
                  Apagar pedido
                </Button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalPedidoInfoAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!textoPedidoInfo.trim()}
                  onClick={handleSalvarPedidoInformacao}
                >
                  Enviar pedido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox aninhado: Esc fecha só o zoom, não o formulário */}
      <MediaLightbox src={previewLightbox} onClose={() => setPreviewLightbox(null)} alt="Mídia da demanda" />
    </Sheet>
  );
}
