/**
 * Aplica no CRM o plano de crm-reserva.ts. Toda consulta filtra por agencia_id (a service
 * role ignora o RLS). Nunca lança: uma falha vira uma linha visível em whatsapp_ia_acoes
 * (`agenda_crm_falhou`) e o webhook continua respondendo 200, para o Cal.com não reenviar.
 *
 * whatsapp_ia_acoes também é o livro-razão de idempotência: uma linha `agenda_crm` por
 * (reserva, gatilho, instante do evento). Reenvio com corpo diferente não repete o CRM.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { garantirPipelinePadrao } from '@/lib/crm';
import { notificar } from '@/lib/notificar';
import { equipeDoCliente, gestoresDaAgencia, unirDestinatarios } from '@/lib/notificar-destinatarios';
import { planejarCrm, type EstagioCrm, type NegocioCrm, type Plano } from './crm-reserva';
import type { ReservaDoWebhook } from './webhook-calcom';

export type ResultadoCrm =
  | { ok: true; acao: 'aplicado' | 'ja_aplicado'; negocioId: string | null }
  | { ok: false; acao: 'falhou'; erro: string };

type NegocioComFunil = NegocioCrm & { pipeline_id: string };

const ACAO_OK = 'agenda_crm';
const ACAO_FALHA = 'agenda_crm_falhou';

/** O funil marcado como padrão primeiro (um cliente pode ter vários); só cria se não houver nenhum. */
export async function pipelineParaNovoNegocio(db: SupabaseClient, agenciaId: string, clienteId: string): Promise<{ id: string; estagios: EstagioCrm[] } | null> {
  const { data } = await db
    .from('crm_pipelines')
    .select('id, estagios:crm_estagios(id, nome, ordem, tipo_conclusao)')
    .eq('agencia_id', agenciaId)
    .eq('cliente_id', clienteId)
    .eq('ativo', true)
    .order('padrao', { ascending: false })
    .order('criado_em', { ascending: true })
    .limit(1);
  const achado = (data as Array<{ id: string; estagios: EstagioCrm[] }> | null)?.[0];
  if (achado) return achado;

  const criado = await garantirPipelinePadrao(agenciaId, clienteId);
  return criado ? { id: criado.id, estagios: (criado.estagios ?? []) as EstagioCrm[] } : null;
}

/** Quem fica com a tarefa: o responsável do negócio; senão o responsável fixo do cliente; senão um gestor. */
async function responsavelPadrao(agenciaId: string, clienteId: string, doNegocio: string | null | undefined): Promise<string | null> {
  if (doNegocio) return doNegocio;
  const equipe = await equipeDoCliente(clienteId);
  if (equipe[0]) return equipe[0];
  return (await gestoresDaAgencia(agenciaId))[0] ?? null;
}

export async function aplicarReservaNoCrm({
  db,
  agenciaId,
  clienteId,
  integracaoId,
  reserva,
  negocioIdAtual,
  reservaJaRemarcada,
  agora = new Date(),
}: {
  db: SupabaseClient;
  agenciaId: string;
  clienteId: string;
  integracaoId: string;
  reserva: ReservaDoWebhook;
  negocioIdAtual: string | null;
  reservaJaRemarcada: boolean;
  agora?: Date;
}): Promise<ResultadoCrm> {
  // A chave é (reserva, gatilho): cada evento real (criada, cancelada, remarcada) dispara uma vez por uid.
  // O instante do evento NÃO entra: um reenvio com outro `createdAt` duplicaria as atividades.
  const chave = { reserva_uid: reserva.uid, gatilho: reserva.gatilho };
  try {
    // 1. Idempotência.
    const { data: jaFeito } = await db.from('whatsapp_ia_acoes').select('id').eq('agencia_id', agenciaId).eq('acao', ACAO_OK).contains('dados_extraidos', chave).limit(1);
    if (jaFeito && jaFeito.length > 0) return { ok: true, acao: 'ja_aplicado', negocioId: negocioIdAtual };

    // 2. Negócio e funil.
    let negocio: NegocioComFunil | null = null;
    if (negocioIdAtual) {
      const { data } = await db.from('crm_negocios').select('id, status, estagio_id, pipeline_id, responsavel_id, nome_contato').eq('id', negocioIdAtual).eq('agencia_id', agenciaId).maybeSingle();
      negocio = (data as NegocioComFunil | null) ?? null;
    }
    let pipelineId: string | null = negocio?.pipeline_id ?? null;
    let estagios: EstagioCrm[] = [];
    if (negocio) {
      const { data } = await db.from('crm_estagios').select('id, nome, ordem, tipo_conclusao').eq('pipeline_id', negocio.pipeline_id);
      estagios = (data as EstagioCrm[] | null) ?? [];
    } else {
      const funil = await pipelineParaNovoNegocio(db, agenciaId, clienteId);
      pipelineId = funil?.id ?? null;
      estagios = funil?.estagios ?? [];
    }

    // 3. Outras consultas ativas e futuras deste negócio.
    let outras = 0;
    if (negocio) {
      const { count } = await db
        .from('agenda_reservas')
        .select('id', { count: 'exact', head: true })
        .eq('agencia_id', agenciaId)
        .eq('negocio_id', negocio.id)
        .neq('uid', reserva.uid)
        .in('status', ['confirmada', 'pendente'])
        .gt('inicio', agora.toISOString());
      outras = count ?? 0;
    }

    const plano: Plano = planejarCrm({ reserva, negocio, estagios, outrasReservasAtivas: outras, reservaJaRemarcada, agora });
    const estagioAnterior = negocio ? estagios.find((e) => e.id === negocio!.estagio_id)?.nome ?? null : null;

    // 4. Executa.
    const dadosExtras = { ...chave, evento_em: reserva.eventoEm, origem: 'agenda' };
    let negocioId = negocio?.id ?? null;
    const responsavelId = plano.criarNegocio || plano.tarefa ? await responsavelPadrao(agenciaId, clienteId, negocio?.responsavel_id) : null;

    if (plano.criarNegocio) {
      const inicial = plano.criarNegocio.estagio;
      if (!pipelineId || !inicial) throw new Error('Funil sem estágios: não deu para criar o negócio.');
      const nome = reserva.nomeContato || (reserva.telefone ? `Lead (${reserva.telefone})` : 'Paciente da agenda');
      const { data: novo, error } = await db
        .from('crm_negocios')
        .insert({
          agencia_id: agenciaId,
          cliente_id: clienteId,
          pipeline_id: pipelineId,
          estagio_id: inicial.id,
          titulo: `Consulta - ${nome}`,
          nome_contato: nome,
          telefone: reserva.telefone || null,
          email: reserva.email,
          responsavel_id: responsavelId,
          origem: 'whatsapp',
          prioridade: 'media',
          status: 'aberto',
          ultimo_contato_em: agora.toISOString(),
        })
        .select('id')
        .single();
      if (error || !novo) throw new Error(`Falha ao criar o negócio: ${error?.message ?? 'sem retorno'}`);
      negocioId = (novo as { id: string }).id;
      await db.from('crm_atividades').insert({ agencia_id: agenciaId, negocio_id: negocioId, membro_id: null, tipo: 'criacao', descricao: `Negócio criado automaticamente pela agenda (estágio "${inicial.nome}").`, dados_extras: dadosExtras });
      // A reserva passa a apontar para o negócio recém-criado.
      await db.from('agenda_reservas').update({ negocio_id: negocioId }).eq('integracao_id', integracaoId).eq('agencia_id', agenciaId).eq('uid', reserva.uid);
    }
    if (!negocioId) return { ok: true, acao: 'aplicado', negocioId: null }; // nada a atualizar (ex.: cancelamento sem negócio)

    if (plano.moverPara && negocio) {
      await db
        .from('crm_negocios')
        .update({ estagio_id: plano.moverPara.id, ultimo_contato_em: agora.toISOString(), atualizado_em: agora.toISOString() })
        .eq('id', negocioId)
        .eq('agencia_id', agenciaId)
        .eq('estagio_id', negocio.estagio_id); // só se ninguém mexeu nesse meio tempo
    }

    if (plano.atividades.length) {
      await db.from('crm_atividades').insert(plano.atividades.map((a) => ({ agencia_id: agenciaId, negocio_id: negocioId, membro_id: null, tipo: a.tipo, descricao: a.descricao, dados_extras: dadosExtras })));
    }

    // Tarefas: primeiro conclui as que deixaram de valer, depois cria a nova.
    const concluir = async (marcadores: string[]) => {
      if (!marcadores.length) return;
      await db.from('crm_tarefas').update({ concluida: true, concluida_em: agora.toISOString() }).eq('agencia_id', agenciaId).eq('negocio_id', negocioId).eq('concluida', false).in('reserva_uid', marcadores);
    };
    await concluir(plano.concluirTarefasDe);
    if (plano.concluirRemarcarPendentes) {
      const { data: pendentes } = await db.from('crm_tarefas').select('reserva_uid').eq('agencia_id', agenciaId).eq('negocio_id', negocioId).eq('concluida', false).like('reserva_uid', 'remarcar:%');
      await concluir(((pendentes as Array<{ reserva_uid: string }> | null) ?? []).map((t) => t.reserva_uid));
    }
    if (plano.tarefa) {
      const marcador = plano.tarefa.natureza === 'remarcar' ? `remarcar:${reserva.uid}` : reserva.uid;
      const { data: existente } = await db.from('crm_tarefas').select('id').eq('agencia_id', agenciaId).eq('negocio_id', negocioId).eq('reserva_uid', marcador).eq('concluida', false).limit(1);
      const campos = { titulo: plano.tarefa.titulo, tipo: plano.tarefa.tipo, prazo: plano.tarefa.prazo.toISOString() };
      if (existente && existente.length > 0) {
        await db.from('crm_tarefas').update(campos).eq('id', (existente[0] as { id: string }).id).eq('agencia_id', agenciaId);
      } else {
        await db.from('crm_tarefas').insert({ agencia_id: agenciaId, negocio_id: negocioId, responsavel_id: responsavelId, reserva_uid: marcador, ...campos });
      }
    }

    // 5. Livro-razão (marca como feito).
    await db.from('whatsapp_ia_acoes').insert({
      agencia_id: agenciaId,
      cliente_id: clienteId,
      negocio_id: negocioId,
      acao: ACAO_OK,
      estagio_anterior: estagioAnterior,
      estagio_novo: plano.moverPara?.nome ?? plano.criarNegocio?.estagio?.nome ?? estagioAnterior,
      resumo_detectado: plano.atividades.map((a) => a.descricao).join(' ') || 'Sem mudança no CRM.',
      dados_extraidos: chave,
    });

    // 6. Avisa quem cuida do cliente (sino e push). Depois do livro-razão: um evento repetido não avisa de novo.
    if (plano.aviso) {
      let destinatarios = unirDestinatarios([negocio?.responsavel_id ?? responsavelId], await equipeDoCliente(clienteId));
      if (destinatarios.length === 0) destinatarios = await gestoresDaAgencia(agenciaId);
      await notificar(destinatarios, { tipo: 'consulta_agenda', titulo: plano.aviso.titulo, corpo: plano.aviso.corpo, url: '/?tab=crm', agrupar: `agenda:${reserva.uid}`, evitarRepetirMin: 30 });
    }
    return { ok: true, acao: 'aplicado', negocioId };
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    console.error('[Agenda→CRM] Falhou:', erro);
    try {
      await db.from('whatsapp_ia_acoes').insert({ agencia_id: agenciaId, cliente_id: clienteId, negocio_id: negocioIdAtual, acao: ACAO_FALHA, resumo_detectado: `A reserva ${reserva.uid.slice(0, 8)} não foi aplicada no CRM: ${erro}`, dados_extraidos: { ...chave, erro } });
    } catch {
      /* o log da falha também falhou; o console.error acima é o que sobra */
    }
    return { ok: false, acao: 'falhou', erro };
  }
}
