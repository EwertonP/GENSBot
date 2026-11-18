import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { exigirMasterDoCliente } from '@/lib/atendimento/acesso';
import { configPublica, lerConfig, salvarConfig, type EntradaConfig } from '@/lib/atendimento/config';
import { lerIntegracao, paraPublica } from '@/lib/agenda/integracao';
import { respostaErro } from '@/lib/clientes-server';

type Contexto = { params: Promise<{ clienteId: string }> };

/** Configuração do atendimento + estado da integração da agenda. Nunca devolve chave nem segredo. */
export async function GET(_req: Request, { params }: Contexto) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  const [config, integracao] = await Promise.all([
    lerConfig(db, acesso.agenciaId, acesso.clienteId),
    lerIntegracao(db, acesso.agenciaId, acesso.clienteId),
  ]);

  const { count } = await db
    .from('agenda_reservas')
    .select('id', { count: 'exact', head: true })
    .eq('agencia_id', acesso.agenciaId)
    .eq('cliente_id', acesso.clienteId);

  // Reservas que chegaram mas não foram aplicadas no CRM (últimos 7 dias): é o que a equipe precisa ver.
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { count: falhas } = await db
    .from('whatsapp_ia_acoes')
    .select('id', { count: 'exact', head: true })
    .eq('agencia_id', acesso.agenciaId)
    .eq('cliente_id', acesso.clienteId)
    .eq('acao', 'agenda_crm_falhou')
    .gte('criado_em', seteDiasAtras);

  return NextResponse.json({
    config: configPublica(config),
    agenda: integracao ? paraPublica(integracao) : null,
    reservasRecebidas: count ?? 0,
    falhasCrm: falhas ?? 0,
  });
}

export async function PUT(req: Request, { params }: Contexto) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  let corpo: EntradaConfig;
  try {
    corpo = (await req.json()) as EntradaConfig;
  } catch {
    return respostaErro('Corpo inválido.', 400);
  }

  const r = await salvarConfig(db, acesso.agenciaId, acesso.clienteId, corpo);
  if (!r.ok) return respostaErro(r.erro, r.status);
  return NextResponse.json({ config: r.config });
}
