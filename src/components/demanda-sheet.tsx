'use client';

import { Tip } from '@/components/ui/tooltip';
import React, { useMemo, useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Image as ImageIcon,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { SegmentedItem } from '@/components/ui/segmented';
import { MemberChipSelect } from '@/components/ui/member-chip-select';
import { ResponsaveisSelect } from '@/components/ui/responsaveis-select';
import { confirmDialog, MediaLightbox } from '@/components/ui/dialog';
import { ClienteAvatar } from '@/components/cliente-avatar';
import { RoteiroView } from '@/components/roteiro-view';
import { CapaReelsField } from '@/components/capa-reels-field';
import { uploadMediaFile } from '@/lib/storage-upload';
import {
  PRIORIDADE_CONFIG,
  deInputData,
  distanciaEmDias,
  paraInputData,
  type ArquivoConteudo,
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

type Aba = 'legenda' | 'briefing' | 'capa' | 'anexos';

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
  const [legenda, setLegenda] = useState(() => item?.legenda || '');
  const [clienteId, setClienteId] = useState(() => item?.cliente_id || clienteInicialId || '');
  const [responsavelId, setResponsavelId] = useState(() => (item ? item.responsavel_id || '' : responsavelInicialId || ''));
  const [coResponsaveis, setCoResponsaveis] = useState<string[]>(() => item?.co_responsaveis_ids ?? []);
  const [editorId, setEditorId] = useState(() => item?.editor_id || '');
  const [dataProgramada, setDataProgramada] = useState(() => paraInputData(item?.data_programada));
  const [prazoInterno, setPrazoInterno] = useState(() => paraInputData(item?.prazo));
  const [urls, setUrls] = useState('');
  const [arquivos, setArquivos] = useState<ArquivoConteudo[]>(() => item?.arquivos || []);
  const [capaUrl, setCapaUrl] = useState<string | null>(() => item?.cover_url || null);

  const [aba, setAba] = useState<Aba>('legenda');
  const [modoVisualizacao, setModoVisualizacao] = useState<'abas' | 'split'>('abas');
  // Roteiro abre em modo leitura (formatado); "Editar" troca pelo campo de texto.
  const [roteiroEditando, setRoteiroEditando] = useState(() => !(item?.briefing || '').trim());
  const [mostrarUrlsManuais, setMostrarUrlsManuais] = useState(false);
  const [trocarClienteAberto, setTrocarClienteAberto] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);

  const [enviandoArquivos, setEnviandoArquivos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Campo da legenda (abas ou dividido): os botões da barra inserem onde está o cursor.
  const legendaRef = useRef<HTMLTextAreaElement>(null);

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
      arquivos.map((a) => a.url).join('|') !== (item.arquivos || []).map((a) => a.url).join('|')
    : titulo.trim() !== '' ||
      briefing.trim() !== '' ||
      legenda.trim() !== '' ||
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

      const res = await fetch(editando ? `/api/conteudo/${item.id}` : '/api/conteudo', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSalvo(data.item, !editando);
      showToast(editando ? 'Demanda atualizada com sucesso!' : 'Nova demanda cadastrada com sucesso na esteira!', 'success');
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

  const classeAba =
    'flex-1 shrink-0 whitespace-nowrap py-1.5 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-semibold';

  return (
    <Sheet
      open={aberto}
      onClose={onFechar}
      dirty={sujo}
      aria-label={editando ? 'Editar demanda' : 'Nova demanda'}
      className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl p-0 overflow-hidden"
    >
      <form
        onSubmit={handleSalvar}
        onKeyDown={(e) => {
          // Ctrl+S / ⌘+S salva sem tirar a mão do teclado (e não abre o "salvar página" do navegador).
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (!salvando) e.currentTarget.requestSubmit();
          }
        }}
        className="flex flex-col max-h-[92vh] w-full bg-card"
      >
        {/* 1. Cabeçalho: contexto + etapa + ações; título em linha própria */}
        <div className="px-4 pt-2.5 pb-3 border-b border-border flex flex-col gap-2 bg-card shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0 text-xs text-muted-foreground">
              {!editando && <Badge variant="brand">Nova demanda</Badge>}
              {clienteObj && (
                <span className="flex items-center gap-1.5 min-w-0">
                  <ClienteAvatar nome={clienteObj.nome} cor={clienteObj.cor} fotoUrl={clienteObj.foto_url} tamanho="xs" />
                  <span className="hidden sm:inline truncate font-medium text-foreground max-w-[180px]">{clienteObj.nome}</span>
                </span>
              )}
              <span aria-hidden className="hidden sm:inline text-border-strong">·</span>
              <span className="shrink-0">{FORMATOS.find((f) => f.id === tipo)?.label}</span>
              {status === 'travado' && (
                <Badge variant="destructive" dot className="shrink-0">
                  Ajuste pedido
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label={editando ? 'Etapa da demanda' : 'Etapa inicial'}
                className="hidden md:flex items-center bg-accent/30 rounded-lg p-0.5 border border-border"
              >
                {ETAPAS_PIPELINE.map((etapa) => {
                  const atual = getEtapaIndex(status);
                  const ehAtual = etapa.step === atual;
                  const feita = etapa.step < atual;
                  return (
                    <Tip key={etapa.status} label={etapa.label}><button
                      type="button"
                      onClick={() => setStatus(etapa.status)}
                      aria-pressed={ehAtual}
                      aria-label={etapa.label}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-ui cursor-pointer ${
                        ehAtual
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : feita
                          ? 'text-brand-text hover:bg-accent/60'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-xs shrink-0 font-mono ${
                          ehAtual ? 'bg-primary-foreground text-primary' : feita ? 'bg-brand-soft text-brand-text' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {feita ? <Check className="w-2.5 h-2.5" /> : etapa.step}
                      </span>
                      <span className="hidden xl:inline">{etapa.short}</span>
                    </button></Tip>
                  );
                })}
              </div>

              <div className="md:hidden">
                <Select
                  value={status === 'travado' ? 'travado' : ETAPAS_PIPELINE[getEtapaIndex(status) - 1]?.status ?? status}
                  onChange={(e) => setStatus(e.target.value as StatusConteudo)}
                  aria-label={editando ? 'Etapa da demanda' : 'Etapa inicial'}
                  className="h-8 text-xs font-semibold"
                >
                  {status === 'travado' && <option value="travado">Ajuste pedido</option>}
                  {ETAPAS_PIPELINE.map((etapa) => (
                    <option key={etapa.status} value={etapa.status}>
                      {etapa.step}. {etapa.label}
                    </option>
                  ))}
                </Select>
              </div>

              {editando && (
                <button
                  type="button"
                  onClick={() => onCopiarLinkAprovacao(item.token_aprovacao)}
                  className="px-2.5 py-1.5 rounded-lg bg-accent/60 hover:bg-accent border border-border text-foreground font-semibold flex items-center gap-1.5 cursor-pointer transition-colors text-xs"
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
                  className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/85 text-primary-foreground font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs"
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
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors data-popup-open:bg-accent data-popup-open:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[80]">
                      <Menu.Popup className="min-w-48 rounded-xl border border-border-strong bg-popover p-1 text-popover-foreground shadow-lg outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0">
                        <Menu.Item
                          onClick={() => copiarTexto(item.id, 'ID da demanda copiado.', 'Não foi possível copiar o ID.')}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer outline-none data-highlighted:bg-accent"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span className="flex-1">Copiar ID</span>
                          <span className="font-mono text-xs text-muted-foreground">#{item.id.slice(0, 8)}</span>
                        </Menu.Item>
                        <Menu.Item
                          onClick={handleExcluir}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm cursor-pointer outline-none text-destructive data-highlighted:bg-destructive-soft"
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
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 cursor-pointer transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Título em linha própria: quebra linha em vez de cortar */}
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
            className="w-full bg-transparent text-lg sm:text-xl font-bold font-display leading-snug text-foreground placeholder:text-muted-foreground rounded-lg px-1 -mx-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>

        {/* 2. Corpo rolável em 2 colunas */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Coluna da esquerda: conteúdo (legenda, roteiro, capa, mídias) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="hidden sm:flex items-center justify-end shrink-0">
              <div className="flex items-center bg-accent/30 rounded-lg p-0.5 border border-border text-xs">
                <SegmentedItem
                  type="button"
                  onClick={() => setModoVisualizacao('abas')}
                  group="demanda-modo"
                  active={modoVisualizacao === 'abas'}
                  className="px-2 py-0.5 rounded-md font-semibold text-xs"
                  title="Uma aba por vez, com espaço máximo para escrever"
                >
                  Abas
                </SegmentedItem>
                <SegmentedItem
                  type="button"
                  onClick={() => setModoVisualizacao('split')}
                  group="demanda-modo"
                  active={modoVisualizacao === 'split'}
                  className="px-2 py-0.5 rounded-md font-semibold text-xs"
                  title="Roteiro e legenda visíveis juntos"
                >
                  Dividido
                </SegmentedItem>
              </div>
            </div>

            {modoVisualizacao === 'abas' && (
              <div className="flex flex-col gap-2.5 flex-1 min-h-0">
                <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-accent/30 rounded-xl border border-border shrink-0 overflow-x-auto scrollbar-none">
                  <SegmentedItem type="button" onClick={() => setAba('legenda')} group="demanda-aba" active={aba === 'legenda'} className={classeAba}>
                    <FileText className="w-3.5 h-3.5 text-brand-text" />
                    <span>Legenda</span>
                    <span className={`hidden sm:inline text-xs font-mono tabular-nums ${classeContadorLegenda(legenda.length)}`}>
                      {legenda.length.toLocaleString('pt-BR')}/2.200
                    </span>
                  </SegmentedItem>

                  <SegmentedItem type="button" onClick={() => setAba('briefing')} group="demanda-aba" active={aba === 'briefing'} className={classeAba}>
                    <Sparkles className="w-3.5 h-3.5 text-brand-text" />
                    <span className="sm:hidden">Roteiro</span>
                    <span className="hidden sm:inline">Briefing & Roteiro</span>
                    {briefing.trim() && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </SegmentedItem>

                  {tipo === 'reel' && (
                    <SegmentedItem type="button" onClick={() => setAba('capa')} group="demanda-aba" active={aba === 'capa'} className={classeAba}>
                      <ImageIcon className="w-3.5 h-3.5 text-brand-text" />
                      <span>Capa</span>
                      {capaUrl && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </SegmentedItem>
                  )}

                  <SegmentedItem type="button" onClick={() => setAba('anexos')} group="demanda-aba" active={aba === 'anexos'} className={classeAba}>
                    <Paperclip className="w-3.5 h-3.5 text-brand-text" />
                    {tipo === 'reel' ? (
                      <span>Vídeo</span>
                    ) : (
                      <>
                        <span className="sm:hidden">Mídias</span>
                        <span className="hidden sm:inline">Mídias & Anexos</span>
                      </>
                    )}
                    <span className="hidden sm:inline text-xs font-mono tabular-nums text-muted-foreground">{arquivos.length}</span>
                  </SegmentedItem>
                </div>

                {aba === 'legenda' && (
                  <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                    {barraLegenda(false)}
                    <AutoTextarea
                      ref={legendaRef}
                      value={legenda}
                      onChange={(e) => setLegenda(e.target.value)}
                      placeholder="Escreva a legenda oficial da postagem com hashtags, quebras de linha e chamada para ação (CTA)..."
                      aria-label="Legenda da postagem"
                      aria-invalid={legenda.length > LIMITE_LEGENDA || undefined}
                      className="rounded-t-none rounded-b-xl text-sm font-sans leading-relaxed bg-card min-h-[260px]"
                    />
                    {avisoLimiteLegenda}
                  </div>
                )}

                {aba === 'briefing' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Roteiro cena a cena e instruções para quem grava, edita ou cria a arte.</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums">{briefing.length} caracteres</span>
                        {briefing.trim() && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRoteiroEditando((v) => !v)}
                            className="h-7 rounded-lg text-xs"
                          >
                            {roteiroEditando ? (
                              <>
                                <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                              </>
                            ) : (
                              <>
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    {roteiroEditando || !briefing.trim() ? (
                      <AutoTextarea
                        value={briefing}
                        onChange={(e) => setBriefing(e.target.value)}
                        placeholder="Exemplo de Roteiro / Briefing:&#10;&#10;Cena 1 (Gancho): Mostrar o antes e depois do procedimento com zoom...&#10;Cena 2: Explicar por que acontece em 3 tópicos...&#10;Cena 3 (CTA): Direcionar pro link na bio ou direct..."
                        aria-label="Briefing e roteiro"
                        className="rounded-xl text-sm font-sans leading-relaxed bg-card min-h-[280px]"
                      />
                    ) : (
                      <RoteiroView texto={briefing} />
                    )}
                  </div>
                )}

                {aba === 'capa' && tipo === 'reel' && (
                  <CapaReelsField url={capaUrl} onChange={setCapaUrl} onPreview={setPreviewLightbox} onErro={(msg) => showToast(msg, 'error')} />
                )}

                {aba === 'anexos' && (
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
                )}
              </div>
            )}

            {modoVisualizacao === 'split' && (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="demanda-briefing-split" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-text" />
                      <span>Briefing & Roteiro</span>
                    </label>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">{briefing.length} caracteres</span>
                  </div>
                  <AutoTextarea
                    id="demanda-briefing-split"
                    value={briefing}
                    onChange={(e) => setBriefing(e.target.value)}
                    placeholder="Instruções para a equipe, ganchos, cenas ou tópicos do post..."
                    className="rounded-xl text-sm bg-card min-h-[120px]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="demanda-legenda-split" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-brand-text" />
                      <span>Legenda da postagem</span>
                    </label>
                    <span className={`text-xs font-mono tabular-nums ${classeContadorLegenda(legenda.length)}`}>
                      {legenda.length.toLocaleString('pt-BR')}/2.200
                    </span>
                  </div>
                  {barraLegenda(true)}
                  <AutoTextarea
                    id="demanda-legenda-split"
                    ref={legendaRef}
                    value={legenda}
                    onChange={(e) => setLegenda(e.target.value)}
                    placeholder="Escreva a legenda..."
                    aria-invalid={legenda.length > LIMITE_LEGENDA || undefined}
                    className="rounded-t-none rounded-b-xl text-sm font-sans leading-relaxed bg-card min-h-[160px]"
                  />
                  {avisoLimiteLegenda}
                </div>
              </div>
            )}
          </div>

          {/* Coluna da direita: propriedades + comentários */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2.5 shrink-0">
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

              {/* Formato */}
              <div className="flex flex-col gap-1 pb-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground">Formato</span>
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-accent/40 rounded-lg border border-border">
                  {FORMATOS.map((fmt) => (
                    <Tip key={fmt.id} label={fmt.descricao}><button
                      type="button"
                      aria-label={fmt.descricao}
                      aria-pressed={tipo === fmt.id}
                      onClick={() => setTipo(fmt.id)}
                      className={`h-7 px-2 rounded-md flex items-center justify-center gap-1.5 text-xs font-semibold transition-ui cursor-pointer ${
                        tipo === fmt.id
                          ? 'bg-primary text-primary-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <fmt.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{fmt.label}</span>
                    </button></Tip>
                  ))}
                </div>
              </div>

              {/* Prioridade */}
              <div className="flex flex-col gap-1 pb-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground">Prioridade</span>
                <div className="grid grid-cols-4 gap-1">
                  {(['urgente', 'alta', 'media', 'baixa'] as const).map((id) => {
                    const selecionado = prioridade === id;
                    const conf = PRIORIDADE_CONFIG[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={selecionado}
                        onClick={() => setPrioridade(id)}
                        className={`h-7 px-1.5 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-ui text-xs font-semibold ${
                          selecionado
                            ? `${conf.bg} ${conf.border} ${conf.text}`
                            : 'bg-card hover:bg-accent/50 border-border text-foreground hover:border-border-strong'
                        }`}
                      >
                        <span aria-hidden className={`size-1.5 rounded-full shrink-0 ${conf.dot}`} />
                        <span>{conf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

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

              {/* Prazos, com a distância até a data */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'demanda-prazo-interno',
                    rotulo: 'Prazo interno',
                    icon: Clock,
                    valor: prazoInterno,
                    set: setPrazoInterno,
                    // Prazo vencido só é problema enquanto a demanda não foi publicada.
                    atrasoConta: status !== 'publicado',
                  },
                  {
                    id: 'demanda-data-programada',
                    rotulo: 'Data programada',
                    icon: Calendar,
                    valor: dataProgramada,
                    set: setDataProgramada,
                    atrasoConta: false,
                  },
                ].map((campo) => {
                  const distancia = distanciaEmDias(campo.valor);
                  const atrasado = !!distancia && distancia.dias < 0 && campo.atrasoConta;
                  return (
                    <div key={campo.id} className="flex flex-col gap-0.5">
                      <label htmlFor={campo.id} className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <campo.icon className="w-3 h-3 text-muted-foreground" />
                        <span>{campo.rotulo}</span>
                      </label>
                      <Input
                        id={campo.id}
                        type="date"
                        value={campo.valor}
                        onChange={(e) => campo.set(e.target.value)}
                        className="h-7.5 text-xs tabular-nums"
                      />
                      {distancia && (
                        <span className={`text-xs ${atrasado ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {atrasado ? `Atrasado, venceu ${distancia.texto}` : distancia.texto}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {editando ? (
              <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2 flex-1 min-h-[160px]">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-display">
                    <MessageSquare className="w-3.5 h-3.5 text-brand-text" />
                    Comentários & Atividades
                  </span>
                </div>

                {(item.comentarios_revisao || []).length > 0 && (
                  <div className="p-2.5 rounded-xl bg-warning-soft border border-warning-ring space-y-1">
                    <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Ajustes do cliente ({item.comentarios_revisao.length})
                    </p>
                    {item.comentarios_revisao.map((c) => (
                      <div key={c.id} className="text-xs p-2 rounded-lg bg-card border border-border">
                        <span className="text-muted-foreground block text-xs">{c.autor || 'Cliente'}</span>
                        <p className="text-foreground mt-0.5 whitespace-pre-wrap">{c.texto}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 max-h-44 sm:max-h-56 overflow-y-auto pr-1 flex-1">
                  {!item.historico_atividades || item.historico_atividades.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1.5">Nenhuma atividade registrada ainda.</p>
                  ) : (
                    item.historico_atividades.map((ev) => (
                      <div key={ev.id} className="p-2 rounded-xl bg-accent/20 border border-border text-xs flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{ev.autor_nome || 'Equipe'}</span>
                          <time dateTime={ev.criado_em} className="tabular-nums">
                            {new Date(ev.criado_em).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p className="text-foreground text-xs whitespace-pre-wrap">{ev.texto}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2 pt-1.5 border-t border-border shrink-0">
                  <Textarea
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                    placeholder="Comentário interno (Ctrl+Enter para enviar)..."
                    aria-label="Novo comentário interno"
                    rows={2}
                    className="text-xs flex-1 bg-accent/20 resize-none h-14"
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
                    className="h-14 px-3 text-xs shrink-0 cursor-pointer"
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
          </div>
        </div>

        {/* 3. Rodapé fixo: estado do formulário + ações */}
        <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex items-center justify-between gap-2 z-20">
          <span aria-live="polite" className="text-xs min-w-0">
            {excluindo ? (
              <span className="text-muted-foreground">Excluindo…</span>
            ) : sujo ? (
              <span className="flex items-center gap-1.5 text-warning font-medium">
                <span aria-hidden className="size-1.5 rounded-full bg-warning shrink-0" />
                {editando ? 'Alterações não salvas' : 'Ainda não criada'}
              </span>
            ) : (
              <span className="hidden sm:inline text-muted-foreground">
                {editando ? 'Nenhuma alteração pendente' : 'Preencha o título e escolha o cliente'}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={fechar} className="rounded-xl text-xs font-semibold">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={salvando}
              className="rounded-xl text-xs font-semibold shadow-2xs px-4"
              title={editando ? 'Salvar (Ctrl+S)' : 'Criar demanda (Ctrl+S)'}
            >
              {editando ? 'Salvar alterações' : 'Criar demanda'}
              <kbd className="hidden sm:inline ml-2 rounded border border-primary-foreground/30 px-1 font-mono text-xs font-medium opacity-70">
                Ctrl S
              </kbd>
            </Button>
          </div>
        </div>
      </form>

      {/* Lightbox aninhado: Esc fecha só o zoom, não o formulário */}
      <MediaLightbox src={previewLightbox} onClose={() => setPreviewLightbox(null)} alt="Mídia da demanda" />
    </Sheet>
  );
}
