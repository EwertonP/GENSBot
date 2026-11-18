/**
 * Fila de respostas do atendimento. Quem quer responder chama `enfileirarResposta` (nunca
 * envia direto); o cron chama `processarFila`, que reavalia tudo no momento do envio
 * (regras.ts) e só então simula ou manda de verdade. Toda consulta filtra por agencia_id
 * (a service role ignora o RLS). Nada dorme em `after()`: o atraso humano é o `enviar_em`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { descriptografarSegredo } from '@/lib/cripto';
import { enviarMensagemOpenWA, marcarComoLidoOpenWA, montarConfigOpenWA } from '@/lib/openwa-client';
import type { Horario } from './config';
import { decidirEnvio, sortearAtrasoSegundos } from './regras';

interface ConfigFila {
  ligado: boolean;
  modo: 'simulacao' | 'real';
  sessao_nome: string | null;
  openwa_url: string | null;
  openwa_key_cifrada: string | null;
  horario_atendimento: Horario | null;
  resposta_min_segundos: number;
  resposta_max_segundos: number;
  limite_respostas_hora: number;
  pausa_humano_horas: number;
}

const CAMPOS_CONFIG = 'ligado, modo, sessao_nome, openwa_url, openwa_key_cifrada, horario_atendimento, resposta_min_segundos, resposta_max_segundos, limite_respostas_hora, pausa_humano_horas';
const ADIAR_MS = 5 * 60_000;
const dormirReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function carregarConfig(db: SupabaseClient, agenciaId: string, clienteId: string): Promise<ConfigFila | null> {
  const { data } = await db.from('atendimento_config').select(CAMPOS_CONFIG).eq('agencia_id', agenciaId).eq('cliente_id', clienteId).maybeSingle();
  return (data as ConfigFila | null) ?? null;
}

export type ResultadoEnfileirar = { ok: true; id: string; enviarEm: string } | { ok: false; erro: 'grupo' | 'sem_config' | 'falhou' };

/** Substitui a resposta pendente do mesmo contato: a última ganha, nunca saem duas. */
export async function enfileirarResposta({
  db,
  agenciaId,
  clienteId,
  remetente,
  texto,
  agora = new Date(),
  aleatorio = Math.random(),
}: {
  db: SupabaseClient;
  agenciaId: string;
  clienteId: string;
  remetente: string;
  texto: string;
  agora?: Date;
  aleatorio?: number;
}): Promise<ResultadoEnfileirar> {
  if (remetente.includes('@g.us')) return { ok: false, erro: 'grupo' };
  const cfg = await carregarConfig(db, agenciaId, clienteId);
  if (!cfg) return { ok: false, erro: 'sem_config' };

  await db
    .from('atendimento_fila')
    .update({ status: 'descartada', motivo: 'substituida', processado_em: agora.toISOString() })
    .eq('agencia_id', agenciaId)
    .eq('cliente_id', clienteId)
    .eq('remetente', remetente)
    .eq('status', 'pendente');

  const enviarEm = new Date(agora.getTime() + sortearAtrasoSegundos(cfg.resposta_min_segundos, cfg.resposta_max_segundos, aleatorio) * 1000).toISOString();
  const { data, error } = await db
    .from('atendimento_fila')
    .insert({ agencia_id: agenciaId, cliente_id: clienteId, remetente, texto, enviar_em: enviarEm, criado_em: agora.toISOString() })
    .select('id')
    .single();
  if (error || !data) return { ok: false, erro: 'falhou' };
  return { ok: true, id: (data as { id: string }).id, enviarEm };
}

interface ItemFila {
  id: string;
  agencia_id: string;
  cliente_id: string;
  remetente: string;
  texto: string;
  criado_em: string;
}

/** Mensagem de pessoa no contato (não eco do robô): o robô reconhece as dele pelo message_id da fila. */
async function ultimaDoHumano(db: SupabaseClient, item: ItemFila, desde: Date): Promise<Date | null> {
  const { data } = await db
    .from('whatsapp_mensagens')
    .select('message_id, timestamp_msg')
    .eq('agencia_id', item.agencia_id)
    .eq('cliente_id', item.cliente_id)
    .eq('remetente', item.remetente)
    .eq('de_mim', true)
    .gte('timestamp_msg', desde.toISOString())
    .order('timestamp_msg', { ascending: false })
    .limit(20);
  const msgs = (data as Array<{ message_id: string; timestamp_msg: string }> | null) ?? [];
  if (!msgs.length) return null;
  const { data: doRobo } = await db.from('atendimento_fila').select('message_id').eq('agencia_id', item.agencia_id).in('message_id', msgs.map((m) => m.message_id));
  const ids = new Set(((doRobo as Array<{ message_id: string }> | null) ?? []).map((r) => r.message_id));
  const humana = msgs.find((m) => !ids.has(m.message_id));
  return humana ? new Date(humana.timestamp_msg) : null;
}

export async function processarFila({
  db,
  agora = new Date(),
  limite = 5,
  dormir = dormirReal,
  aleatorio = Math.random,
}: {
  db: SupabaseClient;
  agora?: Date;
  limite?: number;
  dormir?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
}): Promise<{ vistas: number; enviadas: number; simuladas: number; descartadas: number; adiadas: number; falhas: number }> {
  const r = { vistas: 0, enviadas: 0, simuladas: 0, descartadas: 0, adiadas: 0, falhas: 0 };
  const iso = agora.toISOString();
  const { data: devidas } = await db
    .from('atendimento_fila')
    .select('id, agencia_id, cliente_id, remetente, texto, criado_em')
    .eq('status', 'pendente')
    .lte('enviar_em', iso)
    .order('enviar_em', { ascending: true })
    .limit(limite);

  for (const item of (devidas as ItemFila[] | null) ?? []) {
    // Reivindica a linha: dois crons ao mesmo tempo nunca mandam a mesma resposta duas vezes.
    // shortcut: uma linha 'processando' que o processo largou fica visível, não é reenviada; reavaliar se acontecer.
    const { data: ganhou } = await db.from('atendimento_fila').update({ status: 'processando', processado_em: iso }).eq('id', item.id).eq('status', 'pendente').select('id');
    if (!ganhou || ganhou.length === 0) continue;
    r.vistas++;

    const finalizar = (campos: Record<string, unknown>) => db.from('atendimento_fila').update({ processado_em: iso, ...campos }).eq('id', item.id).eq('agencia_id', item.agencia_id);

    try {
      const cfg = await carregarConfig(db, item.agencia_id, item.cliente_id);
      if (!cfg) {
        await finalizar({ status: 'descartada', motivo: 'sem_config' });
        r.descartadas++;
        continue;
      }

      const { data: ultPac } = await db
        .from('whatsapp_mensagens')
        .select('timestamp_msg')
        .eq('agencia_id', item.agencia_id)
        .eq('cliente_id', item.cliente_id)
        .eq('remetente', item.remetente)
        .eq('de_mim', false)
        .order('timestamp_msg', { ascending: false })
        .limit(1);
      const { count } = await db
        .from('atendimento_fila')
        .select('id', { count: 'exact', head: true })
        .eq('agencia_id', item.agencia_id)
        .eq('cliente_id', item.cliente_id)
        .in('status', ['enviada', 'simulada'])
        .gte('processado_em', new Date(agora.getTime() - 3600_000).toISOString());

      const decisao = decidirEnvio({
        agora,
        criadoEm: new Date(item.criado_em),
        ligado: cfg.ligado,
        horario: cfg.horario_atendimento,
        limiteRespostasHora: cfg.limite_respostas_hora,
        pausaHumanoHoras: cfg.pausa_humano_horas,
        respostasUltimaHora: count ?? 0,
        ultimaDoPaciente: ultPac?.[0]?.timestamp_msg ? new Date(ultPac[0].timestamp_msg as string) : null,
        ultimaDoHumano: await ultimaDoHumano(db, item, new Date(agora.getTime() - cfg.pausa_humano_horas * 3600_000)),
      });

      if (decisao.acao === 'descartar') {
        await finalizar({ status: 'descartada', motivo: decisao.motivo });
        r.descartadas++;
        continue;
      }
      if (decisao.acao === 'esperar') {
        // Empurra para frente: uma resposta presa não pode travar a fila dos outros clientes.
        await finalizar({ status: 'pendente', motivo: decisao.motivo, enviar_em: new Date(agora.getTime() + ADIAR_MS).toISOString(), processado_em: null });
        r.adiadas++;
        continue;
      }

      if (cfg.modo !== 'real') {
        await finalizar({ status: 'simulada' });
        await db.from('whatsapp_ia_acoes').insert({
          agencia_id: item.agencia_id,
          cliente_id: item.cliente_id,
          acao: 'atendimento_simulado',
          resumo_detectado: item.texto.slice(0, 500),
          dados_extraidos: { fila_id: item.id, remetente: item.remetente },
        });
        r.simuladas++;
        continue;
      }

      // Envio real: só pelo OpenWA do próprio cliente, nunca pelo do ambiente.
      const chave = descriptografarSegredo(cfg.openwa_key_cifrada);
      if (!cfg.sessao_nome || !cfg.openwa_url || !chave) {
        await finalizar({ status: 'falhou', motivo: 'sem_openwa_do_cliente' });
        r.falhas++;
        continue;
      }
      const config = montarConfigOpenWA(cfg.openwa_url, chave);
      await marcarComoLidoOpenWA({ sessionName: cfg.sessao_nome, chatId: item.remetente, config });
      await dormir(1000 + Math.round(aleatorio() * 2000)); // o "digitando" e o aquecimento diário são do OpenWA
      const envio = await enviarMensagemOpenWA({ sessionName: cfg.sessao_nome, para: item.remetente, texto: item.texto, config });
      if (envio.ok) {
        await finalizar({ status: 'enviada', message_id: envio.messageId ?? null });
        r.enviadas++;
      } else {
        await finalizar({ status: 'falhou', motivo: (envio.erro ?? 'erro').slice(0, 200) });
        r.falhas++;
      }
    } catch (err) {
      console.error('[Atendimento fila] Falhou:', err instanceof Error ? err.message : err);
      await finalizar({ status: 'falhou', motivo: 'excecao' });
      r.falhas++;
    }
  }
  return r;
}
