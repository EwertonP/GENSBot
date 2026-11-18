'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, KeyRound, Loader2, MessageCircle, Power, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { confirmDialog } from '@/components/ui/dialog';
import { AtendimentoSimulador } from '@/components/atendimento-simulador';

type Horario = Partial<Record<string, Array<{ de: string; ate: string }>>>;

interface ConfigPublica {
  ligado: boolean;
  modo: 'simulacao' | 'real';
  sessaoNome: string | null;
  openwaUrl: string | null;
  temChaveOpenwa: boolean;
  webhookOpenwaRegistrado: boolean;
  horario: Horario;
  respostaMinSegundos: number;
  respostaMaxSegundos: number;
  limiteRespostasHora: number;
  pausaHumanoHoras: number;
}
interface AgendaPublica {
  ativo: boolean;
  temChave: boolean;
  webhookRegistrado: boolean;
  urlWebhook: string | null;
}
interface Estado {
  config: ConfigPublica;
  agenda: AgendaPublica | null;
  reservasRecebidas: number;
  falhasCrm: number;
  /** O que ainda impede de ligar (vazio = pode). */
  faltas: string[];
}

const DIAS: Array<[string, string]> = [
  ['seg', 'Segunda'],
  ['ter', 'Terça'],
  ['qua', 'Quarta'],
  ['qui', 'Quinta'],
  ['sex', 'Sexta'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
];

type Busca = { tipo: 'ok'; estado: Estado } | { tipo: 'semAcesso' } | { tipo: 'erro'; mensagem: string };

async function buscarEstado(base: string): Promise<Busca> {
  try {
    const res = await fetch(base);
    // Quem não é gestor recebe 403: a seção simplesmente não aparece.
    if (res.status === 403) return { tipo: 'semAcesso' };
    const corpo = await res.json();
    if (!res.ok) return { tipo: 'erro', mensagem: corpo.error || 'Falha ao carregar.' };
    return { tipo: 'ok', estado: corpo as Estado };
  } catch (e) {
    return { tipo: 'erro', mensagem: e instanceof Error ? e.message : 'Falha ao carregar.' };
  }
}

const rotulo = 'block text-xs font-medium text-muted-foreground mb-1.5';
const cartao = 'rounded-2xl border border-border bg-card p-5 space-y-4';

export function AtendimentoConfig({
  clienteId,
  showToast,
}: {
  clienteId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
}) {
  const base = `/api/atendimento/${encodeURIComponent(clienteId)}`;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);

  // Campos editáveis (a chave do Cal.com e a do OpenWA só entram; nunca voltam do servidor).
  const [chaveCalcom, setChaveCalcom] = useState('');
  const [sessao, setSessao] = useState('');
  const [openwaUrl, setOpenwaUrl] = useState('');
  const [openwaKey, setOpenwaKey] = useState('');
  const [min, setMin] = useState('45');
  const [max, setMax] = useState('180');
  const [limite, setLimite] = useState('12');
  const [pausa, setPausa] = useState('6');
  const [horario, setHorario] = useState<Record<string, { ativo: boolean; de: string; ate: string }>>({});

  const aplicar = useCallback((e: Estado) => {
    setEstado(e);
    const c = e.config;
    setSessao(c.sessaoNome ?? '');
    setOpenwaUrl(c.openwaUrl ?? '');
    setMin(String(c.respostaMinSegundos));
    setMax(String(c.respostaMaxSegundos));
    setLimite(String(c.limiteRespostasHora));
    setPausa(String(c.pausaHumanoHoras));
    setHorario(
      Object.fromEntries(
        DIAS.map(([d]) => {
          const faixa = c.horario[d]?.[0];
          return [d, { ativo: Boolean(faixa), de: faixa?.de ?? '08:00', ate: faixa?.ate ?? '19:00' }];
        })
      )
    );
  }, []);

  const tratar = useCallback(
    (r: Busca) => {
      if (r.tipo === 'semAcesso') setSemAcesso(true);
      else if (r.tipo === 'erro') setErro(r.mensagem);
      else {
        aplicar(r.estado);
        setErro(null);
      }
    },
    [aplicar]
  );

  // Recarrega depois de uma ação.
  const carregar = useCallback(async () => tratar(await buscarEstado(base)), [base, tratar]);

  useEffect(() => {
    let vivo = true;
    void buscarEstado(base).then((r) => {
      if (vivo) tratar(r);
    });
    return () => {
      vivo = false;
    };
  }, [base, tratar]);

  async function chamar(chave: string, url: string, init: RequestInit, sucesso: string) {
    setOcupado(chave);
    try {
      const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.error || 'Algo deu errado.');
      showToast(sucesso, 'success');
      await carregar();
      return corpo;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Algo deu errado.', 'error');
      return null;
    } finally {
      setOcupado(null);
    }
  }

  const conectarAgenda = async () => {
    const r = await chamar('agenda', `${base}/agenda`, { method: 'POST', body: JSON.stringify({ apiKey: chaveCalcom }) }, 'Agenda conectada.');
    if (r) {
      setChaveCalcom('');
      if (r.aviso) showToast(r.aviso, 'error');
    }
  };

  const desconectarAgenda = async () => {
    const ok = await confirmDialog({
      title: 'Desconectar a agenda?',
      description: 'O webhook é apagado no Cal.com e as reservas novas deixam de chegar ao GENSBot. As já recebidas continuam guardadas.',
      confirmLabel: 'Desconectar',
      tone: 'destructive',
    });
    if (ok) await chamar('agenda', `${base}/agenda`, { method: 'DELETE' }, 'Agenda desconectada.');
  };

  const salvar = async () => {
    const faixas: Horario = {};
    for (const [d] of DIAS) if (horario[d]?.ativo) faixas[d] = [{ de: horario[d].de, ate: horario[d].ate }];
    const r = await chamar(
      'config',
      base,
      {
        method: 'PUT',
        body: JSON.stringify({
          sessaoNome: sessao,
          openwaUrl,
          ...(openwaKey.trim() ? { openwaKey } : {}),
          horario: faixas,
          respostaMinSegundos: min,
          respostaMaxSegundos: max,
          limiteRespostasHora: limite,
          pausaHumanoHoras: pausa,
        }),
      },
      'Configuração salva.'
    );
    if (r) setOpenwaKey('');
    if (r?.desligadoSozinho) showToast('O atendimento foi desligado: a mudança deixou de cumprir um requisito. Veja a lista na seção 3.', 'error');
  };

  const trocarModo = async (modo: 'simulacao' | 'real') => {
    if (modo === config.modo) return;
    if (modo === 'real' && config.ligado) {
      const ok = await confirmDialog({
        title: 'Responder de verdade?',
        description: 'A IA passa a enviar as respostas pelo WhatsApp do cliente, com os atrasos e limites configurados.',
        confirmLabel: 'Passar para real',
        tone: 'destructive',
      });
      if (!ok) return;
    }
    const r = await chamar('modo', base, { method: 'PUT', body: JSON.stringify({ modo }) }, modo === 'real' ? 'Modo real.' : 'Modo simulação.');
    if (r?.desligadoSozinho) showToast('O atendimento foi desligado: o modo real exige o OpenWA do cliente e o webhook.', 'error');
  };

  const ligar = async () => {
    if (config.modo === 'real') {
      const ok = await confirmDialog({
        title: 'Ligar em modo real?',
        description: 'A IA vai responder pacientes de verdade pelo WhatsApp do cliente. Se ainda estiver ajustando, deixe em simulação.',
        confirmLabel: 'Ligar',
        tone: 'destructive',
      });
      if (!ok) return;
    }
    await chamar('ligar', base, { method: 'PUT', body: JSON.stringify({ ligado: true }) }, config.modo === 'real' ? 'Atendimento ligado.' : 'Atendimento ligado em simulação.');
  };

  const desligar = () => chamar('ligar', base, { method: 'PUT', body: JSON.stringify({ ligado: false }) }, 'Atendimento desligado.');

  const cadastrarWebhook = () => chamar('webhook', `${base}/openwa-webhook`, { method: 'POST' }, 'Webhook cadastrado no OpenWA.');

  if (semAcesso) return null;
  if (erro) return <div className={cartao}><p className="text-sm text-destructive">{erro}</p></div>;
  if (!estado) {
    return (
      <div className={`${cartao} flex items-center gap-2 text-sm text-muted-foreground`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando atendimento…
      </div>
    );
  }

  const { config, agenda } = estado;
  const agendaOk = Boolean(agenda?.ativo && agenda.webhookRegistrado);

  return (
    <section className="space-y-4" aria-labelledby="atendimento-titulo">
      <div className={cartao}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-border bg-accent/60">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="atendimento-titulo" className="font-semibold text-foreground">Atendimento por WhatsApp</h3>
              <p className="text-xs text-muted-foreground">A IA responde, propõe horários e a equipe confirma.</p>
            </div>
          </div>
          <Badge variant={config.ligado ? 'success' : 'muted'} className="text-xs">
            {config.ligado ? (config.modo === 'real' ? 'Ligado: respondendo de verdade' : 'Ligado: simulação') : 'Desligado'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {config.ligado && config.modo === 'simulacao'
            ? 'Em simulação a IA escreve e registra o que responderia, mas não envia nada.'
            : config.ligado
              ? 'A IA responde os pacientes pelo WhatsApp do cliente, dentro do horário e dos limites.'
              : 'Nada é respondido sozinho. Prepare as seções abaixo, teste a conversa e depois ligue.'}
        </p>
      </div>

      {/* 1. Agenda */}
      <div className={cartao}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium text-sm"><CalendarCheck className="w-4 h-4" /> 1. Agenda (Cal.com)</div>
          <Badge variant={agendaOk ? 'success' : 'muted'} className="text-xs">{agendaOk ? 'Conectada' : 'Não conectada'}</Badge>
        </div>

        {agendaOk ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {estado.reservasRecebidas} reserva(s) recebida(s). O Cal.com avisa o GENSBot a cada reserva, cancelamento ou remarcação.
            </p>
            {estado.falhasCrm > 0 ? (
              <p role="alert" className="text-xs text-destructive border border-destructive/40 rounded-lg px-3 py-2">
                {estado.falhasCrm} reserva(s) dos últimos 7 dias chegaram, mas não foram aplicadas no CRM. Confira esses pacientes na agenda e avise o suporte.
              </p>
            ) : null}
            <Button type="button" variant="outline" className="text-xs" onClick={desconectarAgenda} disabled={ocupado === 'agenda'}>
              {ocupado === 'agenda' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Desconectar agenda
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={rotulo} htmlFor="chave-calcom">Chave de API do Cal.com</label>
              <Input id="chave-calcom" type="password" autoComplete="off" value={chaveCalcom} onChange={(e) => setChaveCalcom(e.target.value)} placeholder="cal_live_…" />
              <p className="text-xs text-muted-foreground mt-1.5">No Cal.com: Settings &gt; Developer &gt; API keys. A chave é conferida e guardada cifrada; ela não volta para esta tela.</p>
            </div>
            <Button type="button" onClick={conectarAgenda} disabled={ocupado === 'agenda' || chaveCalcom.trim().length < 16}>
              {ocupado === 'agenda' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Conectar agenda
            </Button>
          </div>
        )}
      </div>

      {/* 2. WhatsApp e ritmo */}
      <div className={cartao}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium text-sm"><MessageCircle className="w-4 h-4" /> 2. WhatsApp (OpenWA)</div>
          <Badge variant={config.webhookOpenwaRegistrado ? 'success' : 'muted'} className="text-xs">
            {config.webhookOpenwaRegistrado ? 'Webhook cadastrado' : 'Webhook pendente'}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={rotulo} htmlFor="sessao">Nome da sessão</label>
            <Input id="sessao" value={sessao} onChange={(e) => setSessao(e.target.value)} placeholder="cliente-lais" />
          </div>
          <div>
            <label className={rotulo} htmlFor="openwa-url">Endereço do OpenWA (opcional)</label>
            <Input id="openwa-url" value={openwaUrl} onChange={(e) => setOpenwaUrl(e.target.value)} placeholder="wa.clinica.com.br" />
          </div>
          <div className="sm:col-span-2">
            <label className={rotulo} htmlFor="openwa-key">Chave do OpenWA {config.temChaveOpenwa ? '(guardada; preencha só para trocar)' : ''}</label>
            <Input id="openwa-key" type="password" autoComplete="off" value={openwaKey} onChange={(e) => setOpenwaKey(e.target.value)} placeholder={config.temChaveOpenwa ? '••••••••' : 'chave de API'} />
            <p className="text-xs text-muted-foreground mt-1.5">Vazio no endereço usa o OpenWA da agência. Com endereço próprio, as mensagens deste cliente nunca saem pelo OpenWA da agência.</p>
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-4">
          <div className="flex items-center gap-2 font-medium text-sm"><Timer className="w-4 h-4" /> Ritmo e proteção do número</div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <div><label className={rotulo} htmlFor="min">Resposta mínima (s)</label><Input id="min" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></div>
            <div><label className={rotulo} htmlFor="max">Resposta máxima (s)</label><Input id="max" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} /></div>
            <div><label className={rotulo} htmlFor="limite">Respostas por hora</label><Input id="limite" inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value)} /></div>
            <div><label className={rotulo} htmlFor="pausa">Pausa se a equipe responder (h)</label><Input id="pausa" inputMode="numeric" value={pausa} onChange={(e) => setPausa(e.target.value)} /></div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground mb-1.5">Horário de atendimento (a IA só responde dentro dele)</legend>
            {DIAS.map(([d, nome]) => (
              <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-2 w-28">
                  <input
                    type="checkbox"
                    checked={horario[d]?.ativo ?? false}
                    onChange={(e) => setHorario((h) => ({ ...h, [d]: { ...(h[d] ?? { de: '08:00', ate: '19:00' }), ativo: e.target.checked } }))}
                  />
                  {nome}
                </label>
                <Input type="time" className="w-28" aria-label={`${nome}: início`} disabled={!horario[d]?.ativo} value={horario[d]?.de ?? '08:00'} onChange={(e) => setHorario((h) => ({ ...h, [d]: { ...h[d], de: e.target.value } }))} />
                <span className="text-muted-foreground">até</span>
                <Input type="time" className="w-28" aria-label={`${nome}: fim`} disabled={!horario[d]?.ativo} value={horario[d]?.ate ?? '19:00'} onChange={(e) => setHorario((h) => ({ ...h, [d]: { ...h[d], ate: e.target.value } }))} />
              </div>
            ))}
          </fieldset>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={salvar} disabled={ocupado === 'config'}>
            {ocupado === 'config' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvar configuração
          </Button>
          <Button type="button" variant="outline" onClick={cadastrarWebhook} disabled={ocupado === 'webhook' || !config.sessaoNome}>
            {ocupado === 'webhook' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Cadastrar webhook no OpenWA
          </Button>
        </div>
        {!config.sessaoNome ? <p className="text-xs text-muted-foreground">Salve o nome da sessão para poder cadastrar o webhook.</p> : null}
      </div>

      {/* 3. Ligar */}
      <div className={cartao}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium text-sm"><Power className="w-4 h-4" /> 3. Ligar o atendimento</div>
          <Badge variant={config.ligado ? 'success' : 'muted'} className="text-xs">{config.ligado ? 'Ligado' : 'Desligado'}</Badge>
        </div>

        <fieldset className="space-y-2" disabled={ocupado === 'modo'}>
          <legend className="text-xs font-medium text-muted-foreground mb-1.5">Modo</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="modo" className="mt-1" checked={config.modo === 'simulacao'} onChange={() => void trocarModo('simulacao')} />
            <span><strong>Simulação</strong><span className="block text-xs text-muted-foreground">A IA escreve e registra o que responderia. Nada é enviado.</span></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="modo" className="mt-1" checked={config.modo === 'real'} onChange={() => void trocarModo('real')} />
            <span><strong>Real</strong><span className="block text-xs text-muted-foreground">Envia pelo WhatsApp do cliente. Exige o OpenWA do cliente e o webhook cadastrado.</span></span>
          </label>
        </fieldset>

        {estado.faltas.length > 0 ? (
          <div className="rounded-xl border border-border px-3 py-2 text-xs space-y-1">
            <p className="font-medium">Para ligar, falta:</p>
            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">{estado.faltas.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        ) : null}

        {config.ligado ? (
          <Button type="button" variant="outline" onClick={desligar} disabled={ocupado === 'ligar'}>
            {ocupado === 'ligar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />} Desligar atendimento
          </Button>
        ) : (
          <Button type="button" onClick={ligar} disabled={ocupado === 'ligar' || estado.faltas.length > 0}>
            {ocupado === 'ligar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />} Ligar atendimento
          </Button>
        )}
      </div>

      {/* 4. Simulador */}
      <AtendimentoSimulador base={base} showToast={showToast} />
    </section>
  );
}
