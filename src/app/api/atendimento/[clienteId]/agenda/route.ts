import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { exigirMasterDoCliente } from '@/lib/atendimento/acesso';
import { conectarAgenda, desconectarAgenda } from '@/lib/agenda/integracao';
import { respostaErro } from '@/lib/clientes-server';

type Contexto = { params: Promise<{ clienteId: string }> };

/** Conecta a agenda: confere a chave do Cal.com, cadastra o webhook e guarda tudo cifrado. */
export async function POST(req: Request, { params }: Contexto) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  let corpo: { apiKey?: unknown; apiBase?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return respostaErro('Corpo inválido.', 400);
  }
  if (typeof corpo.apiKey !== 'string') return respostaErro('Informe a chave de API do Cal.com.', 400);

  const r = await conectarAgenda({
    db,
    agenciaId: acesso.agenciaId,
    clienteId: acesso.clienteId,
    apiKey: corpo.apiKey,
    apiBase: typeof corpo.apiBase === 'string' ? corpo.apiBase : null,
  });
  if (!r.ok) return respostaErro(r.erro, r.status);
  return NextResponse.json({ agenda: r.integracao, usuario: r.usuario ?? null, aviso: r.aviso ?? null });
}

export async function DELETE(_req: Request, { params }: Contexto) {
  const acesso = await exigirMasterDoCliente((await params).clienteId);
  if (!acesso.ok) return acesso.response;

  const r = await desconectarAgenda({ db, agenciaId: acesso.agenciaId, clienteId: acesso.clienteId });
  if (!r.ok) return respostaErro(r.erro, r.status);
  return NextResponse.json({ agenda: null });
}
