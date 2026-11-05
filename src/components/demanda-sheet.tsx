'use client';

import { Tip } from '@/components/ui/tooltip';
import React, { useMemo, useRef, useState } from 'react';
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
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { EditorRico } from '@/components/ui/editor-rico';
import { conteudoInicial, LIMITE_BRIEFING } from '@/lib/editor-rico';
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

  // Estado inicial vem das props: o pai troca a `key` a cada abertura.
  const [status, setStatus] = useState<StatusConteudo>(() => item?.status ?? 'planejamento');
  const [tipo, setTipo] = useState<TipoConteudo>(() => item?.tipo ?? 'post');
  const [prioridade, setPrioridade] = useState<PrioridadeConteudo>(() => item?.prioridade || 'media');
  const [titulo, setTitulo] = useState(() => item?.titulo || '');
  const [briefing, setBriefing] = useState(() => item?.briefing || '');
  const [briefingHtml, setBriefingHtml] = useState(() => item?.briefing_html || '');
  const [briefingEditado, setBriefingEditado] = useState(false);
  const [legenda, setLegenda] = useState(() => item?.legenda || '');
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
      urls.trim() !== '' ||
      (capaUrl || null) !== (item.cover_url || null) ||
      arquivos.map((a) => a.url).join('|') !== (item.arquivos || []).map((a) => a.url).join('|') ||
      JSON.stringify(checklist) !== JSON.stringify(item.checklist || [])
    : titulo.trim() !== '' ||
      briefing.trim() !== '' ||
      legenda.trim() !== '' ||
      checklist.length > 0 ||
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

      const corpo = {
        cliente_id: clienteId,
        tipo,
        status,
        prioridade,
        titulo: titulo.trim() || null,
        briefing: briefing.trim() || null,
        // Só manda o HTML se a pessoa mexeu no editor: assim salvar sem editar não depende da coluna nova.
        ...(briefingEditado ? { briefing_html: briefingHtml || null } : {}),
        legenda: legenda.trim() || null,
        responsavel_id: responsavelId || null,
        co_responsaveis_ids: coResponsaveis.filter((id) => id !== responsavelId),
        editor_id: editorId || null,
        // Dia inalterado devolve o valor original: salvar não apaga o horário agendado.
        data_programada: deInputData(dataProgramada, item?.data_programada),
        prazo: deInputData(prazoInterno, item?.prazo),
        arquivos: [...arquivos, ...urlsManuais],
        cover_url: tipo === 'reel' ? capaUrl : null,
        checklist,
      };

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
          <div className="flex items-center justify-between gap-3 max-md:flex-wrap">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {editando ? 'Demanda' : 'Nova demanda'} · {ETAPAS_PIPELINE.find((e) => e.status === status)?.label ?? 'Ajuste pedido'}
            </p>

            <button
              type="button"
              onClick={fechar}
              className="md:hidden inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2 shrink-0 max-md:order-last max-md:w-full">
              {editando && (
                <button
                  type="button"
                  onClick={() => onCopiarLinkAprovacao(item.token_aprovacao)}
                  className="px-2.5 py-1.5 max-md:size-11 max-md:justify-center rounded-xl bg-accent/60 hover:bg-accent border border-border text-foreground font-semibold flex items-center gap-1.5 cursor-pointer transition-colors text-xs shadow-2xs"
                  aria-label="Copiar link de aprovação do cliente"
                >
                  <Share2 className="w-3.5 h-3.5 text-brand-text" />
                  <span className="hidden sm:inline">Link aprovação</span>
                </button>
              )}

              {editando && (status === 'agendamento' || status === 'pronto_publicar') && onLevarParaAgendamento && (
                <button
                  type="button"
                  onClick={() => onLevarParaAgendamento(itemComEdicoes(item))}
                  className="px-2.5 py-1.5 max-md:size-11 max-md:justify-center rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs"
                  aria-label="Agendar postagem"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Agendamento</span>
                </button>
              )}

              {editando && (
                <Menu.Root>
                  <Menu.Trigger
                    aria-label="Mais ações da demanda"
                    className="p-1.5 max-md:size-11 max-md:grid max-md:place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors data-popup-open:bg-accent data-popup-open:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[80]">
                      <Menu.Popup className="min-w-48 rounded-2xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-xl outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0">
                        <Menu.Item
                          onClick={() => copiarTexto(item.id, 'ID da demanda copiado.', 'Não foi possível copiar o ID.')}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Copiar ID</span>
                          <span className="font-mono text-xs text-muted-foreground">#{item.id.slice(0, 8)}</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={handleExcluir}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs cursor-pointer outline-none text-destructive data-highlighted:bg-destructive-soft"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Excluir demanda</span>
                        </Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              )}

              <button
                type="button"
                onClick={fechar}
                className="max-md:hidden p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra de comandos no celular: Excluir / Cancelar / Salvar sempre à vista,
              sem depender do rodapé (que o teclado empurra). */}
          <div className="md:hidden flex items-center gap-2">
            {editando && (
              <Tip label="Excluir demanda">
                <button
                  type="button"
                  onClick={handleExcluir}
                  disabled={excluindo || salvando}
                  aria-label="Excluir demanda"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive hover:bg-destructive/20 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </Tip>
            )}
            <span aria-live="polite" className="min-w-0 flex-1 truncate text-xs">
              {excluindo ? (
                <span className="text-muted-foreground">Excluindo…</span>
              ) : sujo ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-warning">
                  <span aria-hidden className="size-1.5 rounded-full bg-warning shrink-0" />
                  {editando ? 'Alterações não salvas' : 'Ainda não criada'}
                </span>
              ) : null}
            </span>
            <Button type="button" variant="outline" size="md" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={salvando} title={editando ? 'Salvar (Ctrl+S)' : 'Criar demanda (Ctrl+S)'}>
              {editando ? 'Salvar' : 'Criar'}
            </Button>
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

            {/* Só no celular: prazo e responsáveis moram na mesma linha de chips. */}
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
                    const m = membros.find((mb) => mb.id === id);
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
            <section aria-label="Descrição" className="flex flex-col gap-2.5">
              <SecaoTitulo icon={AlignLeft}>Descrição</SecaoTitulo>
              <div className="flex flex-col gap-2">
                <EditorRico
                  valorInicial={conteudoInicial(item?.briefing_html, item?.briefing)}
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
            {editando ? (
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
              </div>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">
                Comentários e histórico ficam disponíveis depois que a demanda é criada.
              </p>
            )}
            </section>
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
              <div className="flex flex-col">
                <LinhaPropriedade icon={Layers} rotulo="Etapa">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusConteudo)}
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
              </div>
            </div>

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
                  membros={membros}
                />
                <MemberChipSelect
                  label="Designer / Editor"
                  value={editorId}
                  onChange={setEditorId}
                  membros={membros}
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

      {/* Lightbox aninhado: Esc fecha só o zoom, não o formulário */}
      <MediaLightbox src={previewLightbox} onClose={() => setPreviewLightbox(null)} alt="Mídia da demanda" />
    </Sheet>
  );
}
