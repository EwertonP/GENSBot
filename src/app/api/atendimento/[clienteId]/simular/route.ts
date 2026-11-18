import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { exigirMasterDoCliente } from '@/lib/atendimento/acesso';
import { proporResposta } from '@/lib/atendimento/assistente';
import { lerConfig } from '@/lib/atendimento/config';
import { dentroDoHorario } from '@/lib/atendimento/regras';
import { respostaErro } from '@/lib/clientes-server';
import type { ChatMessage } from '@/types/ai';

export const maxDuration = 60;

const MAX_TURNOS = 20;
const MAX_TEXTO = 1000;

/**
 * Simulador: o que a IA responderia a uma conversa digitada na tela. NÃO envia, NÃO grava na fila,
 * NÃO notifica a equipe e não precisa de sessão nem de atendimento ligado. Gasta a chave de IA
 * do cliente, por isso é só do gestor e a conversa tem tamanho máximo.
 */
export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  let turnos: ChatMessage[];
  try {
    const { mensagens } = (await req.json()) as { mensagens?: Array<{ de?: unknown; texto?: unknown }> };
    if (!Array.isArray(mensagens) || mensagens.length === 0 || mensagens.length > MAX_TURNOS) throw new Error();
    turnos = mensagens.map((m) => {
      if ((m.de !== 'paciente' && m.de !== 'ia') || typeof m.texto !== 'string' || !m.texto.trim() || m.texto.length > MAX_TEXTO) throw new Error();
      return { role: m.de === 'paciente' ? 'user' : 'assistant', content: m.texto.trim() };
    });
    if (turnos[turnos.length - 1].role !== 'user') throw new Error();
  } catch {
    return respostaErro(`Envie de 1 a ${MAX_TURNOS} mensagens (até ${MAX_TEXTO} caracteres cada), a última do paciente.`, 400);
  }

  try {
    const agora = new Date();
    const [proposta, cfg] = await Promise.all([
      proporResposta({ db, agenciaId: acesso.agenciaId, clienteId: acesso.clienteId, messages: turnos, agora }),
      lerConfig(db, acesso.agenciaId, acesso.clienteId),
    ]);
    return NextResponse.json({
      proposta,
      // Como a fila trataria essa resposta agora: o atraso sorteado e se o horário de atendimento permite.
      ritmo: {
        minSegundos: Number(cfg?.resposta_min_segundos ?? 45),
        maxSegundos: Number(cfg?.resposta_max_segundos ?? 180),
        dentroDoHorario: dentroDoHorario((cfg?.horario_atendimento as never) ?? null, agora),
      },
    });
  } catch (err) {
    console.error('[Atendimento simulador] Falhou:', err instanceof Error ? err.message : err);
    return respostaErro('A IA não respondeu. Confira a chave e o modelo cadastrados na tela de IA do CRM.', 502);
  }
}
