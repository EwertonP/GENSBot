/**
 * Do evento da agenda para o CRM: decide, sem tocar no banco, o que fazer com o negócio
 * quando uma reserva chega, é cancelada ou remarcada. Quem grava é crm-reserva-server.ts.
 *
 * Princípios:
 * - Nunca puxa para trás o que a equipe já avançou; nunca reabre negócio encerrado.
 * - O estágio é achado por NOME (nada de "estágio na posição N"): sem correspondência,
 *   registra a atividade e não move.
 * - Remarcação não é cancelamento: não desfaz estágio nem pede para remarcar.
 */
import type { ReservaDoWebhook } from './webhook-calcom';

export interface EstagioCrm {
  id: string;
  nome: string;
  ordem?: number | null;
  tipo_conclusao?: 'aberto' | 'ganho' | 'perdido' | null;
}

export interface NegocioCrm {
  id: string;
  status: 'aberto' | 'ganho' | 'perdido';
  estagio_id: string;
  responsavel_id?: string | null;
  nome_contato?: string | null;
}

const ABERTO = (e: EstagioCrm) => !e.tipo_conclusao || e.tipo_conclusao === 'aberto';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * "Consulta Agendada" exato; senão um estágio aberto cujo nome tem "agendado/agendada"
 * (ex.: "Qualificado / Agendado"). "Agendando" é em andamento e NÃO conta.
 */
export function acharEstagioAgendado(estagios: EstagioCrm[]): EstagioCrm | null {
  const abertos = estagios.filter(ABERTO);
  return abertos.find((e) => norm(e.nome) === 'consulta agendada') ?? abertos.find((e) => /\bagendad[oa]\b/.test(norm(e.nome))) ?? null;
}

/** Estágio de volta quando a consulta cai: "Em Atendimento"; senão um aberto com "atendimento" ou "triagem". */
export function acharEstagioAtendimento(estagios: EstagioCrm[]): EstagioCrm | null {
  const abertos = estagios.filter(ABERTO);
  return (
    abertos.find((e) => norm(e.nome) === 'em atendimento') ??
    abertos.find((e) => /atendimento/.test(norm(e.nome))) ??
    abertos.find((e) => /triagem/.test(norm(e.nome))) ??
    null
  );
}

const formatarHorario = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : 'horário não informado';

export interface AtividadePlano {
  tipo: 'reuniao' | 'mudanca_estagio' | 'criacao';
  descricao: string;
}

export interface TarefaPlano {
  titulo: string;
  tipo: 'whatsapp';
  prazo: Date;
  /** 'confirmar': presença da consulta; 'remarcar': a consulta caiu e é preciso marcar outra. */
  natureza: 'confirmar' | 'remarcar';
}

export interface Plano {
  criarNegocio: { estagio: EstagioCrm | null } | null;
  moverPara: EstagioCrm | null;
  atividades: AtividadePlano[];
  tarefa: TarefaPlano | null;
  /** Conclui as tarefas automáticas ainda abertas destas reservas (uid). */
  concluirTarefasDe: string[];
  /** Uma consulta nova chegou: as tarefas "remarcar" pendentes deste negócio não fazem mais sentido. */
  concluirRemarcarPendentes: boolean;
}

export interface EntradaPlano {
  reserva: ReservaDoWebhook;
  /** Negócio já ligado à reserva (ou achado por código/telefone). null = ainda não existe. */
  negocio: NegocioCrm | null;
  estagios: EstagioCrm[];
  /** Outras reservas ativas (confirmada ou pendente) e futuras do mesmo negócio. */
  outrasReservasAtivas: number;
  /** A reserva já estava marcada como `remarcada` antes deste evento (cancelamento da antiga). */
  reservaJaRemarcada: boolean;
  agora: Date;
}

const vazio = (): Plano => ({ criarNegocio: null, moverPara: null, atividades: [], tarefa: null, concluirTarefasDe: [], concluirRemarcarPendentes: false });
const mais = (d: Date, horas: number) => new Date(d.getTime() + horas * 3600_000);

export function planejarCrm({ reserva, negocio, estagios, outrasReservasAtivas, reservaJaRemarcada, agora }: EntradaPlano): Plano {
  const plano = vazio();
  const nome = reserva.nomeContato || negocio?.nome_contato || 'paciente';
  const quando = formatarHorario(reserva.inicio);
  const inicio = reserva.inicio ? new Date(reserva.inicio) : null;
  const futura = inicio !== null && inicio.getTime() > agora.getTime();

  if (reserva.status === 'confirmada' || reserva.status === 'pendente') {
    const confirmada = reserva.status === 'confirmada';
    const alvo = confirmada ? acharEstagioAgendado(estagios) : null;

    plano.atividades.push({
      tipo: 'reuniao',
      descricao: confirmada
        ? reserva.remarcadaDeUid
          ? `Consulta remarcada para ${quando}.`
          : `Consulta marcada para ${quando}.`
        : `Consulta solicitada para ${quando}, aguardando confirmação.`,
    });

    if (!negocio) {
      // Negócio novo nasce no estágio de agendado (confirmada) ou no de atendimento (pendente).
      const inicial = alvo ?? acharEstagioAtendimento(estagios) ?? estagios.filter(ABERTO)[0] ?? null;
      plano.criarNegocio = { estagio: inicial };
    } else if (negocio.status !== 'aberto') {
      plano.atividades.push({ tipo: 'reuniao', descricao: 'Este negócio já está encerrado: a consulta foi registrada, mas ele não foi reaberto.' });
    } else if (alvo) {
      const atual = estagios.find((e) => e.id === negocio.estagio_id);
      // Só avança: se a equipe já levou o negócio mais adiante (ou ele está no estágio certo), não mexe.
      if (atual && alvo.id !== atual.id && (atual.ordem ?? 0) < (alvo.ordem ?? 0)) {
        plano.moverPara = alvo;
        plano.atividades.push({ tipo: 'mudanca_estagio', descricao: `Movido de "${atual.nome}" para "${alvo.nome}" pela agenda.` });
      }
    }

    if (futura && negocio?.status !== 'ganho' && negocio?.status !== 'perdido') {
      const prazo = confirmada ? new Date(Math.max(agora.getTime(), inicio!.getTime() - 24 * 3600_000)) : mais(agora, 2);
      plano.tarefa = {
        titulo: confirmada ? `Confirmar presença de ${nome} (consulta ${quando})` : `Confirmar consulta solicitada de ${nome} (${quando})`,
        tipo: 'whatsapp',
        prazo,
        natureza: 'confirmar',
      };
    }
    plano.concluirRemarcarPendentes = confirmada;
    if (reserva.remarcadaDeUid) plano.concluirTarefasDe.push(reserva.remarcadaDeUid);
    return plano;
  }

  // cancelada ou recusada
  if (reservaJaRemarcada || !negocio) return plano; // a antiga que foi remarcada, ou nada no CRM para atualizar
  const motivo = reserva.motivoCancelamento ? `: ${reserva.motivoCancelamento}` : '';
  plano.atividades.push({ tipo: 'reuniao', descricao: `Consulta ${reserva.status === 'recusada' ? 'recusada' : 'cancelada'} (${quando})${motivo}.` });
  plano.concluirTarefasDe.push(reserva.uid);

  const agendado = acharEstagioAgendado(estagios);
  if (negocio.status === 'aberto' && outrasReservasAtivas === 0 && agendado && negocio.estagio_id === agendado.id) {
    // Só desfaz se o negócio ainda está no estágio que a própria agenda pôs.
    const volta = acharEstagioAtendimento(estagios);
    if (volta) {
      plano.moverPara = volta;
      plano.atividades.push({ tipo: 'mudanca_estagio', descricao: `Movido de "${agendado.nome}" para "${volta.nome}": a consulta caiu.` });
    }
    plano.tarefa = { titulo: `Remarcar consulta com ${nome}`, tipo: 'whatsapp', prazo: mais(agora, 2), natureza: 'remarcar' };
  }
  return plano;
}
