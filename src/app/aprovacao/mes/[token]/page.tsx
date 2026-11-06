'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Image as ImageIcon,
  Images,
  MessageSquare,
  Pencil,
  Sparkles,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedItem } from '@/components/ui/segmented';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { AbaMes, ItemDoMes } from '@/lib/link-do-mes';
import type { CampoSugestao } from '@/lib/sugestoes-texto';

interface Dados {
  cliente: { nome: string; cor: string | null; nicho: string | null; foto_url: string | null; usuario: string | null };
  mes: string;
  meses: { mes: string; total: number }[];
  itens: ItemDoMes[];
  contagem: { para_voce: number; publicados: number; total: number };
}

const NOME_KEY = 'gens_aprovacao_nome';

function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-');
  const nome = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

function rotuloData(data: string | null): string | null {
  if (!data) return null;
  const d = new Date(data.length <= 10 ? `${data}T12:00:00` : data);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function rotuloTipo(tipo: string): string {
  if (tipo === 'reel') return 'Reels';
  if (tipo === 'story') return 'Story';
  return 'Post';
}

const ETAPA_ROTULO: Record<ItemDoMes['etapa'], { texto: string; classe: string }> = {
  texto: { texto: 'Em planejamento', classe: 'bg-muted text-muted-foreground' },
  aprovacao: { texto: 'Aguardando você', classe: 'bg-warning/15 text-warning' },
  publicado: { texto: 'Agendado ou publicado', classe: 'bg-success/15 text-success' },
};

function IconeTipo({ tipo, ehCarrossel, className }: { tipo: string; ehCarrossel: boolean; className?: string }) {
  if (tipo === 'reel') return <Clapperboard className={className} />;
  if (ehCarrossel) return <Images className={className} />;
  return <ImageIcon className={className} />;
}

function Previa({ item }: { item: ItemDoMes }) {
  const [slide, setSlide] = useState(0);

  if (item.etapa === 'texto' || item.arquivos.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border-strong bg-muted/40 px-6 py-6 text-center xl:aspect-[4/5]">
        <Sparkles className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold">
          {item.etapa === 'texto' ? 'A arte ainda está sendo preparada' : item.etapa === 'publicado' ? 'Arquivos já arquivados' : 'Sem arquivo anexado'}
        </p>
        {item.etapa === 'texto' && (
          <p className="text-xs text-muted-foreground">Por enquanto, confira o texto planejado ao lado. A arte aparece aqui quando estiver pronta.</p>
        )}
        {item.etapa === 'publicado' && (
          <p className="text-xs text-muted-foreground">
            Depois de publicado, só o texto fica guardado
            {item.texto_ate ? `, até ${new Date(item.texto_ate).toLocaleDateString('pt-BR')}` : ''}. O post em si está no perfil do Instagram.
          </p>
        )}
      </div>
    );
  }

  const arq = item.arquivos[Math.min(slide, item.arquivos.length - 1)];
  const varios = item.arquivos.length > 1;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-3xl border border-border bg-black">
        {arq.tipo === 'video' ? (
          <video key={arq.id} src={arq.url} poster={item.cover_url || undefined} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={arq.url} alt={item.titulo || 'Arte do post'} className="aspect-[4/5] w-full object-cover" />
        )}
      </div>
      {varios && (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} aria-label="Slide anterior">
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-xs font-semibold text-muted-foreground">
              {slide + 1} de {item.arquivos.length}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setSlide((s) => Math.min(item.arquivos.length - 1, s + 1))} disabled={slide === item.arquivos.length - 1} aria-label="Próximo slide">
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CampoTexto({ rotulo, texto, copiavel, leitura }: { rotulo: string; texto: string | null; copiavel?: boolean; leitura?: boolean }) {
  if (!texto?.trim()) return null;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto || '');
      toast.success(`${rotulo} copiado.`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</h3>
        {copiavel && (
          <Button variant="ghost" size="sm" onClick={copiar} aria-label={`Copiar ${rotulo.toLowerCase()}`}>
            <Copy className="size-3.5" aria-hidden /> Copiar
          </Button>
        )}
      </div>
      <p className={cn('whitespace-pre-line', leitura ? 'text-xl leading-9' : 'text-[15px] leading-relaxed')}>{texto}</p>
    </section>
  );
}


interface CampoEditavelProps {
  rotulo: string;
  campo: CampoSugestao;
  texto: string | null;
  pendente?: string;
  nome: string;
  onNome: (v: string) => void;
  onEnviar: (campo: CampoSugestao, texto: string) => Promise<boolean>;
  grande?: boolean;
  leitura?: boolean;
}

/** Texto de um post em planejamento: a cliente pode sugerir uma mudança (nada é sobrescrito). */
function CampoEditavel({ rotulo, campo, texto, pendente, nome, onNome, onEnviar, grande, leitura }: CampoEditavelProps) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);

  function abrir() {
    setValor(pendente ?? texto ?? '');
    setEditando(true);
  }

  async function enviar() {
    setEnviando(true);
    const ok = await onEnviar(campo, valor);
    setEnviando(false);
    if (ok) setEditando(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{rotulo}</h3>
        {!editando && (
          <Button variant="ghost" size="sm" onClick={abrir} aria-label={`Sugerir mudança em ${rotulo.toLowerCase()}`}>
            <Pencil className="size-3.5" aria-hidden /> {pendente ? 'Alterar sugestão' : 'Sugerir mudança'}
          </Button>
        )}
      </div>

      {editando ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            rows={campo === 'titulo' ? 2 : 8}
            aria-label={`Seu texto para ${rotulo.toLowerCase()}`}
            className="w-full rounded-2xl border border-border-strong bg-background p-3 text-[15px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={nome}
            onChange={(e) => onNome(e.target.value)}
            placeholder="Seu nome"
            aria-label="Seu nome"
            className="h-11 w-full rounded-full border border-border-strong bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Sua sugestão vai para a equipe, que aceita ou não. O texto atual só muda depois disso.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setEditando(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={enviar} loading={enviando}>
              <Check className="size-4" aria-hidden /> Enviar sugestão
            </Button>
          </div>
        </div>
      ) : (
        <>
          {texto?.trim() ? (
            <p className={cn('whitespace-pre-line', !leitura && 'leading-relaxed', grande ? 'text-lg font-semibold' : leitura ? 'text-xl leading-9' : 'text-[15px]')}>{texto}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda não há texto aqui.</p>
          )}
          {pendente && (
            <div className="mt-3 rounded-xl bg-warning/10 p-3">
              <p className="mb-1 text-xs font-bold text-warning">Sua sugestão, aguardando a equipe</p>
              <p className="whitespace-pre-line text-sm">{pendente}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function LinkDoMesPage() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState<string | null>(null);
  const [abaEscolhida, setAba] = useState<AbaMes | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [nome, setNome] = useState(() => {
    try {
      return typeof window === 'undefined' ? '' : localStorage.getItem(NOME_KEY) || '';
    } catch {
      return '';
    }
  });
  // Modo leitura: texto maior, para ler o roteiro no celular na hora de gravar.
  const [leitura, setLeitura] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('gens_modo_leitura') === '1';
    } catch {
      return false;
    }
  });
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
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

  useEffect(() => {
    if (!token) return;
    fetch(`/api/aprovacao/mes/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar.');
        setDados(json);
        setMes(json.mes);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setCarregando(false));
  }, [token]);

  // Sem escolha da cliente, abre a aba que tem algo a fazer.
  const aba: AbaMes = abaEscolhida ?? (dados && dados.contagem.para_voce === 0 && dados.contagem.publicados > 0 ? 'publicados' : 'para_voce');

  const itensAba = useMemo(() => (dados?.itens || []).filter((i) => i.aba === aba), [dados, aba]);

  // No computador sempre há um post aberto; no celular só depois do toque.
  const aberto = useMemo(() => itensAba.find((i) => i.id === abertoId) || null, [itensAba, abertoId]);
  const selecionadoDesktop = aberto || itensAba[0] || null;
  const indice = selecionadoDesktop ? itensAba.findIndex((i) => i.id === selecionadoDesktop.id) : -1;

  function abrir(id: string) {
    setAbertoId(id);
    setPedindoAjuste(false);
    setTextoAjuste('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  function alternarLeitura() {
    const novo = !leitura;
    setLeitura(novo);
    try {
      localStorage.setItem('gens_modo_leitura', novo ? '1' : '0');
    } catch {
      /* ignora */
    }
  }

  function guardarNome(v: string) {
    setNome(v);
    try {
      localStorage.setItem(NOME_KEY, v);
    } catch {
      /* ignora */
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
          acao === 'aprovar'
            ? { acao, autor: nome.trim() }
            : { acao, autor: nome.trim(), texto: textoAjuste.trim(), parte: 'legenda' }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar.');
      toast.success(acao === 'aprovar' ? 'Post aprovado!' : 'Ajuste enviado para a equipe.');
      setPedindoAjuste(false);
      setTextoAjuste('');
      setAbertoId(null);
      await carregar(mes);
    } catch (e) {
      toast.error('Não foi possível enviar', { description: e instanceof Error ? e.message : 'Tente de novo em instantes.' });
    } finally {
      setEnviando(false);
    }
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
        <div className="max-w-sm">
          <h1 className="mb-2 text-lg font-semibold">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{erro || 'Não foi possível abrir este link. Peça um novo à agência.'}</p>
        </div>
      </div>
    );
  }

  const naoHaNada = dados.itens.length === 0;

  const lista = (
    <ul className="flex flex-col gap-2" aria-label="Posts do mês">
      {itensAba.map((it) => {
        const ativo = selecionadoDesktop?.id === it.id;
        const rot = ETAPA_ROTULO[it.etapa];
        const dt = rotuloData(it.data_programada || it.publicado_em);
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => abrir(it.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors min-h-14',
                ativo ? 'border-border-strong bg-card lg:ring-1 lg:ring-ring/30' : 'border-border bg-card/60 hover:bg-card'
              )}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <IconeTipo tipo={it.tipo} ehCarrossel={it.arquivos.length > 1} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold">{it.titulo || 'Sem título'}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{rotuloTipo(it.tipo)}</span>
                  {dt && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" aria-hidden /> {dt}
                    </span>
                  )}
                  <span className={cn('rounded-full px-2 py-0.5 font-semibold', rot.classe)}>{rot.texto}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
      {itensAba.length === 0 && (
        <li className="rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
          {aba === 'para_voce' ? 'Nada aguardando você neste mês. Quando houver post para revisar, ele aparece aqui.' : 'Nenhum post agendado ou publicado neste mês ainda.'}
        </li>
      )}
    </ul>
  );

  const detalhe = (it: ItemDoMes) => (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Previa key={it.id} item={it} />
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold">{rotuloTipo(it.tipo)}</span>
            {rotuloData(it.data_programada || it.publicado_em) && <span>· {rotuloData(it.data_programada || it.publicado_em)}</span>}
            <span className={cn('rounded-full px-2 py-0.5 font-semibold', ETAPA_ROTULO[it.etapa].classe)}>{ETAPA_ROTULO[it.etapa].texto}</span>
          </div>
          {it.etapa !== 'texto' && <h2 className="text-xl font-semibold leading-snug">{it.titulo || 'Sem título'}</h2>}
        </div>
        {it.etapa === 'texto' ? (
          <>
            {(['titulo', 'briefing', 'legenda'] as const).map((campo) => (
              <CampoEditavel
                key={`${it.id}-${campo}`}
                campo={campo}
                rotulo={campo === 'titulo' ? 'Título' : campo === 'briefing' ? (it.tipo === 'reel' ? 'Roteiro do vídeo' : 'Texto da peça') : 'Legenda'}
                texto={it[campo]}
                pendente={it.sugestoes?.find((x) => x.campo === campo)?.texto}
                nome={nome}
                onNome={guardarNome}
                onEnviar={(c, t) => enviarSugestao(it, c, t)}
                grande={campo === 'titulo'}
                leitura={leitura}
              />
            ))}
          </>
        ) : (
          <>
            <CampoTexto rotulo={it.tipo === 'reel' ? 'Roteiro do vídeo' : 'Texto da peça'} texto={it.briefing} copiavel leitura={leitura} />
            <CampoTexto rotulo="Legenda" texto={it.legenda} copiavel leitura={leitura} />
          </>
        )}
        {it.etapa !== 'texto' && !it.briefing?.trim() && !it.legenda?.trim() && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Type className="size-4" aria-hidden /> Ainda não há texto para este post.
          </p>
        )}
        {it.etapa === 'texto' && (
          <p className="rounded-2xl bg-muted/50 p-3 text-xs text-muted-foreground">
            Este post ainda está em planejamento. Toque em &ldquo;Sugerir mudança&rdquo; em qualquer texto para propor uma alteração à equipe.
          </p>
        )}
      </div>
    </div>
  );

  const barraAcoes = (it: ItemDoMes) =>
    it.pode_agir ? (
      <div className="flex flex-col gap-3">
        <input
          value={nome}
          onChange={(e) => guardarNome(e.target.value)}
          placeholder="Seu nome"
          aria-label="Seu nome"
          className="h-11 w-full rounded-full border border-border-strong bg-card px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {pedindoAjuste && (
          <textarea
            value={textoAjuste}
            onChange={(e) => setTextoAjuste(e.target.value)}
            placeholder="O que precisa mudar neste post?"
            aria-label="Descreva o ajuste"
            rows={4}
            className="w-full rounded-2xl border border-border-strong bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          {pedindoAjuste ? (
            <>
              <Button variant="secondary" onClick={() => setPedindoAjuste(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button onClick={() => agir(it, 'ajuste')} loading={enviando}>
                <MessageSquare className="size-4" aria-hidden /> Enviar ajuste
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPedindoAjuste(true)} disabled={enviando}>
                <MessageSquare className="size-4" aria-hidden /> Pedir ajuste
              </Button>
              <Button onClick={() => agir(it, 'aprovar')} loading={enviando}>
                <Check className="size-4" aria-hidden /> Aprovar
              </Button>
            </>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 lg:px-8">
          {dados.cliente.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dados.cliente.foto_url} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold">{dados.cliente.nome.charAt(0)}</span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold leading-tight">{dados.cliente.nome}</h1>
            <p className="text-xs text-muted-foreground">{dados.cliente.usuario ? `@${dados.cliente.usuario} · ` : ''}Conteúdo de {rotuloMes(dados.mes)}</p>
          </div>
          {dados.meses.length > 1 && (
            <select
              value={mes || dados.mes}
              onChange={(e) => {
                setCarregando(true);
                setAbertoId(null);
                carregar(e.target.value);
              }}
              aria-label="Mês"
              className="h-11 w-full rounded-full border border-border-strong bg-card px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            >
              {dados.meses.map((m) => (
                <option key={m.mes} value={m.mes}>
                  {rotuloMes(m.mes)}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-32 pt-5 lg:px-8 lg:pb-10">
        {naoHaNada ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-sm text-muted-foreground">
            Ainda não há posts para mostrar em {rotuloMes(dados.mes)}.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
            {/* Lista: no celular some quando um post está aberto */}
            <aside className={cn('flex flex-col gap-3', aberto && 'max-lg:hidden')}>
              <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Abas">
                <SegmentedItem group="aba-mes" active={aba === 'para_voce'} onClick={() => { setAba('para_voce'); setAbertoId(null); }} className="flex-1 py-2.5">
                  Para você ({dados.contagem.para_voce})
                </SegmentedItem>
                <SegmentedItem group="aba-mes" active={aba === 'publicados'} onClick={() => { setAba('publicados'); setAbertoId(null); }} className="flex-1 py-2.5">
                  Publicados ({dados.contagem.publicados})
                </SegmentedItem>
              </div>
              {aba === 'publicados' && dados.contagem.total > 0 && (
                <p className="px-1 text-xs text-muted-foreground">
                  {dados.contagem.publicados} de {dados.contagem.total} posts do mês já foram agendados ou publicados.
                </p>
              )}
              {lista}
            </aside>

            {/* Detalhe: sempre visível no computador; no celular só com um post aberto */}
            <section className={cn('min-w-0', !aberto && 'max-lg:hidden')}>
              {selecionadoDesktop ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setAbertoId(null)}>
                      <ArrowLeft className="size-4" aria-hidden /> Voltar
                    </Button>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant={leitura ? 'primary' : 'secondary'} size="sm" onClick={alternarLeitura} aria-pressed={leitura} aria-label="Modo leitura (texto maior)">
                        <Type className="size-4" aria-hidden /> Leitura
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => abrir(itensAba[indice - 1].id)} disabled={indice <= 0} aria-label="Post anterior">
                        <ChevronLeft className="size-4" aria-hidden />
                      </Button>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {indice + 1} de {itensAba.length}
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => abrir(itensAba[indice + 1].id)} disabled={indice >= itensAba.length - 1} aria-label="Próximo post">
                        <ChevronRight className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {detalhe(selecionadoDesktop)}
                  {/* Ações: no celular, barra fixa embaixo; no computador, no fluxo da página */}
                  {selecionadoDesktop.pode_agir && (
                    <>
                      <div className="max-lg:hidden max-w-md">{barraAcoes(selecionadoDesktop)}</div>
                      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
                        {barraAcoes(selecionadoDesktop)}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-sm text-muted-foreground">Selecione um post para ver os detalhes.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
