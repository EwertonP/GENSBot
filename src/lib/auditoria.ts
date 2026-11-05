import { supabase as db } from '@/lib/supabase';

export type ModuloAuditoria =
  | 'demandas'
  | 'propostas'
  | 'contratos'
  | 'clientes'
  | 'financeiro'
  | 'redes'
  | 'crm'
  | 'equipe';

export type AcaoAuditoria =
  | 'criou'
  | 'moveu'
  | 'aprovou'
  | 'assinou'
  | 'conectou'
  | 'alterou'
  | 'excluiu'
  | 'ajuste_solicitado';

export interface EventoAuditoria {
  id?: string;
  agencia_id: string;
  membro_id?: string | null;
  cliente_id?: string | null;
  modulo: ModuloAuditoria;
  acao: AcaoAuditoria;
  descricao: string;
  detalhes?: Record<string, any>;
  criado_em?: string;
  membro?: { id: string; nome: string; foto_url?: string | null } | null;
  cliente?: { id: string; nome: string } | null;
}

/**
 * Registra um evento na auditoria da agência de forma não-bloqueante.
 * Nunca lança exceção para não interromper a operação principal.
 */
export async function registrarEventoAuditoria(
  evento: Omit<EventoAuditoria, 'id' | 'criado_em'>
): Promise<boolean> {
  try {
    const { error } = await db.from('auditoria_eventos').insert({
      agencia_id: evento.agencia_id,
      membro_id: evento.membro_id || null,
      cliente_id: evento.cliente_id || null,
      modulo: evento.modulo,
      acao: evento.acao,
      descricao: evento.descricao,
      detalhes: evento.detalhes || {},
    });

    if (error) {
      if (error.code !== '42P01') {
        console.warn('Erro ao gravar auditoria_eventos:', error.message);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Falha silenciosa ao registrar auditoria:', err);
    return false;
  }
}

/**
 * Agrupa eventos de auditoria por data amigável (Hoje, Ontem, dd/mm/aaaa).
 */
export function agruparEventosPorData(eventos: EventoAuditoria[]): {
  data: string;
  titulo: string;
  itens: EventoAuditoria[];
}[] {
  const mapa = new Map<string, EventoAuditoria[]>();
  const hoje = new Date().toISOString().slice(0, 10);
  const ontemDate = new Date();
  ontemDate.setDate(ontemDate.getDate() - 1);
  const ontem = ontemDate.toISOString().slice(0, 10);

  for (const ev of eventos) {
    const dia = (ev.criado_em || new Date().toISOString()).slice(0, 10);
    const lista = mapa.get(dia) || [];
    lista.push(ev);
    mapa.set(dia, lista);
  }

  const resultado: { data: string; titulo: string; itens: EventoAuditoria[] }[] = [];

  for (const [dia, itens] of mapa.entries()) {
    let titulo = dia;
    if (dia === hoje) {
      titulo = 'Hoje';
    } else if (dia === ontem) {
      titulo = 'Ontem';
    } else {
      const [ano, mes, d] = dia.split('-');
      titulo = `${d}/${mes}/${ano}`;
    }

    resultado.push({
      data: dia,
      titulo,
      itens,
    });
  }

  return resultado.sort((a, b) => b.data.localeCompare(a.data));
}
