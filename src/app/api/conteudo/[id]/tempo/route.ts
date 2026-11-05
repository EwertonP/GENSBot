import { NextResponse } from 'next/server';
import { supabase as db } from '@/lib/supabase';
import { getContextoAgencia, respostaErro, traduzirErroBanco } from '@/lib/clientes-server';

export interface TempoDemanda {
  id: string;
  agencia_id: string;
  demanda_id: string;
  membro_id: string | null;
  inicio: string;
  fim: string | null;
  segundos: number;
  descricao: string | null;
  criado_em: string;
}

/** GET /api/conteudo/[id]/tempo: lista apontamentos de tempo e tempo total. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;

  const { id: demandaId } = await params;
  if (!demandaId) return respostaErro('ID da demanda não informado.', 400);

  const { data, error } = await db
    .from('tempos_demanda')
    .select('id, agencia_id, demanda_id, membro_id, inicio, fim, segundos, descricao, criado_em')
    .eq('agencia_id', auth.ctx.membro.agencia_id)
    .eq('demanda_id', demandaId)
    .order('inicio', { ascending: false });

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ tempos: [], totalSegundos: 0, ativo: null });
    }
    return traduzirErroBanco(error, 'ler apontamentos de tempo');
  }

  const tempos: TempoDemanda[] = data ?? [];
  const membroId = auth.ctx.membro.id;

  // Verifica se há um cronômetro rodando (sem 'fim')
  const ativo = tempos.find((t) => !t.fim && t.membro_id === membroId) || null;

  // Soma de segundos fechados + segundos do cronômetro rodando
  const agora = Date.now();
  let totalSegundos = 0;
  for (const t of tempos) {
    if (t.fim) {
      totalSegundos += t.segundos || 0;
    } else {
      const decorrido = Math.max(0, Math.floor((agora - new Date(t.inicio).getTime()) / 1000));
      totalSegundos += decorrido;
    }
  }

  return NextResponse.json({ tempos, totalSegundos, ativo });
}

/** POST /api/conteudo/[id]/tempo: inicia, pausa, adiciona manual ou exclui apontamento. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;

  const { id: demandaId } = await params;
  if (!demandaId) return respostaErro('ID da demanda não informado.', 400);

  const body = (await req.json().catch(() => null)) as {
    acao?: string;
    segundos?: number;
    minutos?: number;
    descricao?: string;
    tempo_id?: string;
  };

  const acao = body?.acao || 'iniciar';
  const agenciaId = auth.ctx.membro.agencia_id;
  const membroId = auth.ctx.membro.id;

  if (acao === 'iniciar') {
    // Pausa qualquer outro cronômetro aberto deste membro antes
    const { data: abertos } = await db
      .from('tempos_demanda')
      .select('id, inicio')
      .eq('agencia_id', agenciaId)
      .eq('membro_id', membroId)
      .is('fim', null);

    if (abertos && abertos.length > 0) {
      const agoraIso = new Date().toISOString();
      for (const ab of abertos) {
        const seg = Math.max(0, Math.floor((Date.now() - new Date(ab.inicio).getTime()) / 1000));
        await db.from('tempos_demanda').update({ fim: agoraIso, segundos: seg }).eq('id', ab.id);
      }
    }

    // Cria novo apontamento ativo
    const { data, error } = await db
      .from('tempos_demanda')
      .insert({
        agencia_id: agenciaId,
        demanda_id: demandaId,
        membro_id: membroId,
        inicio: new Date().toISOString(),
        fim: null,
        segundos: 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ ok: true, aviso: 'Tabela tempos_demanda pendente de migration' });
      }
      return traduzirErroBanco(error, 'iniciar cronômetro');
    }

    return NextResponse.json({ ok: true, ativo: data });
  }

  if (acao === 'pausar') {
    const { data: abertos, error: errBusca } = await db
      .from('tempos_demanda')
      .select('id, inicio')
      .eq('agencia_id', agenciaId)
      .eq('demanda_id', demandaId)
      .eq('membro_id', membroId)
      .is('fim', null);

    if (errBusca) {
      if (errBusca.code === '42P01') return NextResponse.json({ ok: true });
      return traduzirErroBanco(errBusca, 'buscar cronômetro ativo');
    }

    if (!abertos || abertos.length === 0) {
      return NextResponse.json({ ok: true, mensagem: 'Nenhum cronômetro ativo para pausar.' });
    }

    const agoraIso = new Date().toISOString();
    for (const ab of abertos) {
      const seg = Math.max(0, Math.floor((Date.now() - new Date(ab.inicio).getTime()) / 1000));
      await db.from('tempos_demanda').update({ fim: agoraIso, segundos: seg }).eq('id', ab.id);
    }

    return NextResponse.json({ ok: true });
  }

  if (acao === 'manual') {
    const min = Number(body?.minutos) || 0;
    if (min <= 0) return respostaErro('Minutos deve ser maior que zero.', 400);

    const segundos = Math.round(min * 60);
    const { data, error } = await db
      .from('tempos_demanda')
      .insert({
        agencia_id: agenciaId,
        demanda_id: demandaId,
        membro_id: membroId,
        inicio: new Date(Date.now() - segundos * 1000).toISOString(),
        fim: new Date().toISOString(),
        segundos,
        descricao: (body?.descricao || '').trim().slice(0, 200) || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ ok: true });
      return traduzirErroBanco(error, 'salvar apontamento manual');
    }

    return NextResponse.json({ ok: true, item: data });
  }

  if (acao === 'excluir') {
    const tempoId = body?.tempo_id;
    if (!tempoId) return respostaErro('tempo_id obrigatório.', 400);

    const { error } = await db
      .from('tempos_demanda')
      .delete()
      .eq('id', tempoId)
      .eq('agencia_id', agenciaId);

    if (error && error.code !== '42P01') {
      return traduzirErroBanco(error, 'excluir apontamento de tempo');
    }

    return NextResponse.json({ ok: true });
  }

  return respostaErro('Ação não suportada.', 400);
}
