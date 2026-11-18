/**
 * Regras puras do ritmo do atendimento: quando pode responder e quando espera. Sem banco,
 * sem rede: quem junta os fatos é fila.ts. O "digitando" e o limite diário com aquecimento
 * já são do OpenWA (SIMULATE_TYPING e SEND_PACING_*), não se repetem aqui.
 */
import { DIAS, type Horario } from './config';

const FUSO = 'America/Sao_Paulo';
const DIA_DA_SEMANA: Record<string, (typeof DIAS)[number]> = { Mon: 'seg', Tue: 'ter', Wed: 'qua', Thu: 'qui', Fri: 'sex', Sat: 'sab', Sun: 'dom' };

/** Horário vazio = sem janela definida: a IA não responde (falha fechada). */
export function dentroDoHorario(horario: Horario | null | undefined, agora: Date): boolean {
  if (!horario) return false;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(agora)
      .map((x) => [x.type, x.value])
  );
  const faixas = horario[DIA_DA_SEMANA[p.weekday]] ?? [];
  const hm = `${p.hour}:${p.minute}`;
  return faixas.some((f) => hm >= f.de && hm < f.ate);
}

/** Espera aleatória entre min e max segundos (`aleatorio` em [0,1) injetável nos testes). */
export function sortearAtrasoSegundos(min: number, max: number, aleatorio = Math.random()): number {
  return Math.round(min + aleatorio * Math.max(0, max - min));
}

export interface FatosDoEnvio {
  agora: Date;
  /** Quando o item foi enfileirado. */
  criadoEm: Date;
  ligado: boolean;
  horario: Horario | null;
  limiteRespostasHora: number;
  pausaHumanoHoras: number;
  /** Respostas (reais e simuladas) do cliente na última hora. */
  respostasUltimaHora: number;
  /** Última mensagem do paciente neste contato. */
  ultimaDoPaciente: Date | null;
  /** Última mensagem de uma pessoa (não do robô) neste contato. */
  ultimaDoHumano: Date | null;
}

export type Decisao = { acao: 'enviar' } | { acao: 'esperar'; motivo: string } | { acao: 'descartar'; motivo: string };

const HORAS = 3600_000;
/** Resposta que ficou presa fora do horário por mais que isso perdeu o sentido. */
const VALIDADE_HORAS = 12;
/** O paciente precisa ter escrito nas últimas horas: o robô nunca puxa conversa. */
const JANELA_PACIENTE_HORAS = 24;

export function decidirEnvio(f: FatosDoEnvio): Decisao {
  if (!f.ligado) return { acao: 'descartar', motivo: 'atendimento_desligado' };
  if (!f.ultimaDoPaciente || f.agora.getTime() - f.ultimaDoPaciente.getTime() > JANELA_PACIENTE_HORAS * HORAS) {
    return { acao: 'descartar', motivo: 'paciente_nao_escreveu' };
  }
  // Chegou mensagem nova depois de a resposta ser montada: ela está velha, quem enfileirou refaz.
  if (f.ultimaDoPaciente.getTime() > f.criadoEm.getTime()) return { acao: 'descartar', motivo: 'paciente_escreveu_depois' };
  if (f.ultimaDoHumano && f.agora.getTime() - f.ultimaDoHumano.getTime() < f.pausaHumanoHoras * HORAS) {
    return { acao: 'descartar', motivo: 'humano_assumiu' };
  }
  if (f.agora.getTime() - f.criadoEm.getTime() > VALIDADE_HORAS * HORAS) return { acao: 'descartar', motivo: 'expirou' };
  if (!dentroDoHorario(f.horario, f.agora)) return { acao: 'esperar', motivo: 'fora_do_horario' };
  if (f.respostasUltimaHora >= f.limiteRespostasHora) return { acao: 'esperar', motivo: 'limite_por_hora' };
  return { acao: 'enviar' };
}
