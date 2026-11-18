import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { exigirMasterDoCliente } from '@/lib/atendimento/acesso';
import { lerConfig } from '@/lib/atendimento/config';
import { consultarSessao, iniciarSessao, type EstadoSessao } from '@/lib/atendimento/sessao';
import { configOpenWA } from '@/lib/openwa-config';
import { respostaErro } from '@/lib/clientes-server';

export const maxDuration = 60;

type Contexto = { params: Promise<{ clienteId: string }> };

/** Quem pode mexer, qual sessão e em qual OpenWA: sempre o OpenWA PRÓPRIO do cliente, nunca o da agência. */
async function preparar(params: Contexto['params']) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return { ok: false, erro: acesso.response } as const;

  const config = await lerConfig(db, acesso.agenciaId, acesso.clienteId);
  const sessionName = (config?.sessao_nome as string | null) ?? null;
  if (!sessionName) return { ok: false, erro: respostaErro('Salve o nome da sessão do WhatsApp primeiro.', 400) } as const;

  let openwa;
  try {
    openwa = await configOpenWA({ clienteId: acesso.clienteId, agenciaId: acesso.agenciaId });
  } catch (err) {
    return { ok: false, erro: respostaErro(err instanceof Error ? err.message : 'Configuração do OpenWA indisponível.', 500) } as const;
  }
  if (openwa.origem !== 'cliente') {
    return { ok: false, erro: respostaErro('Defina o endereço e a chave do OpenWA deste cliente primeiro. Esta tela não mexe no OpenWA da agência.', 400) } as const;
  }
  return { ok: true, acesso, sessionName, openwa } as const;
}

async function responder(estado: EstadoSessao, acesso: { agenciaId: string; clienteId: string }, sessionName: string) {
  if (!estado.ok) return respostaErro(estado.erro, 502);
  const status = estado.conectada ? 'conectado' : estado.existe ? 'aguardando_qrcode' : 'desconectado';
  await db
    .from('whatsapp_sessions')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('session_name', sessionName)
    .eq('agencia_id', acesso.agenciaId)
    .eq('cliente_id', acesso.clienteId);
  return NextResponse.json({ existe: estado.existe, conectada: estado.conectada, qr: estado.qr, status });
}

/** Estado da sessão e o QR, se ainda não conectou. Não cria nada. */
export async function GET(_req: Request, { params }: Contexto): Promise<Response> {
  const p = await preparar(params);
  if (!p.ok) return p.erro;
  return responder(await consultarSessao({ config: p.openwa, sessionName: p.sessionName }), p.acesso, p.sessionName);
}

/** Cria a sessão (se preciso), liga e devolve o QR. Cria também a linha em whatsapp_sessions, deste cliente. */
export async function POST(_req: Request, { params }: Contexto): Promise<Response> {
  const p = await preparar(params);
  if (!p.ok) return p.erro;
  const { acesso, sessionName, openwa } = p;

  // O nome da sessão é único no sistema todo: um nome que já é de outro cliente ou agência não é tomado.
  const { data: existente } = await db.from('whatsapp_sessions').select('id, agencia_id, cliente_id').eq('session_name', sessionName).maybeSingle();
  if (existente && (existente.agencia_id !== acesso.agenciaId || existente.cliente_id !== acesso.clienteId)) {
    return respostaErro(`O nome de sessão "${sessionName}" já está em uso por outra conta. Escolha outro.`, 409);
  }
  if (!existente) {
    const { error } = await db.from('whatsapp_sessions').insert({
      agencia_id: acesso.agenciaId,
      cliente_id: acesso.clienteId,
      membro_id: null,
      session_name: sessionName,
      status: 'aguardando_qrcode',
      // A escuta por IA global (OpenAI) fica desligada nas sessões de cliente: o atendimento usa a chave do cliente.
      ia_escuta_ativa: false,
    });
    if (error) return respostaErro('Não consegui cadastrar a sessão do WhatsApp.', 500);
  }

  return responder(await iniciarSessao({ config: openwa, sessionName }), acesso, sessionName);
}
