import { NextResponse } from 'next/server';
import { getContextoAgencia, respostaErro, traduzirErroBanco, respostaSeMembroEscopado } from '@/lib/clientes-server';
import { supabase as serviceSupabase } from '@/lib/supabase';
import { criptografarSegredo, segredoDisponivel } from '@/lib/cripto';
import type { AIAgentConfig } from '@/types/ai';

/** A chave de API nunca volta para o navegador: só um aviso de que existe uma salva. */
function semChave<T extends { api_key?: string | null }>(config: T) {
  const { api_key, ...resto } = config;
  return { ...resto, tem_api_key: Boolean(api_key) };
}

// GET: Retorna a configuração de IA do cliente selecionado ou da agência
export async function GET(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('cliente_id');
  const ehAgencia = !clienteId || clienteId === 'agencia' || clienteId === 'null';

  try {
    let query = serviceSupabase
      .from('ai_agent_configs')
      .select('*')
      .eq('agencia_id', membro.agencia_id);

    if (ehAgencia) {
      query = query.is('cliente_id', null);
    } else {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return traduzirErroBanco(error, 'GET /api/crm/ai/config');

    return NextResponse.json(data ? semChave(data) : null);
  } catch (err: any) {
    console.error('Erro ao buscar configuração de IA:', err);
    return respostaErro('Falha interna ao carregar configuração de IA.', 500);
  }
}

// POST: Salva ou atualiza a configuração de IA do cliente/agência
export async function POST(req: Request) {
  const auth = await getContextoAgencia();
  if (!auth.ok) return auth.response;
  const bloqueio = respostaSeMembroEscopado(auth.ctx);
  if (bloqueio) return bloqueio;
  const { membro } = auth.ctx;

  try {
    const body = await req.json();
    const {
      cliente_id,
      ativo,
      provedor = 'openai',
      api_key,
      modelo = 'gpt-4o-mini',
      temperatura = 0.7,
      nome_agente = 'Assistente Comercial',
      prompt_sistema,
      pipeline_id,
      estagio_inicial_id,
      estagio_qualificado_id,
      estagio_proposta_id,
      estagio_agendado_id,
      responder_direct_geral = true,
      palavras_pausar_ia,
    } = body;

    const payload: Partial<AIAgentConfig> & { agencia_id: string; atualizado_em: string } = {
      agencia_id: membro.agencia_id,
      cliente_id: cliente_id || null,
      ativo: Boolean(ativo),
      provedor,
      modelo,
      temperatura: Number(temperatura) || 0.7,
      nome_agente: nome_agente.trim(),
      prompt_sistema: prompt_sistema?.trim() || 'Você é um assistente comercial cordial.',
      pipeline_id: pipeline_id || null,
      estagio_inicial_id: estagio_inicial_id || null,
      estagio_qualificado_id: estagio_qualificado_id || null,
      estagio_proposta_id: estagio_proposta_id || null,
      estagio_agendado_id: estagio_agendado_id || null,
      responder_direct_geral: Boolean(responder_direct_geral),
      palavras_pausar_ia: Array.isArray(palavras_pausar_ia) ? palavras_pausar_ia : ['atendente', 'falar com humano'],
      atualizado_em: new Date().toISOString(),
    };

    // Só atualiza api_key se foi informada (não sobrescreve com vazio se já existia).
    // A chave vai criptografada; sem AI_KEYS_SECRET não salvamos (nada de texto puro no banco).
    if (api_key && api_key.trim()) {
      if (!segredoDisponivel()) {
        return respostaErro(
          'AI_KEYS_SECRET não está configurada no servidor, então a chave não foi salva. Gere uma com "openssl rand -base64 32" e defina na Vercel.',
          500
        );
      }
      payload.api_key = criptografarSegredo(api_key.trim());
    }

    const { data, error } = await serviceSupabase
      .from('ai_agent_configs')
      .upsert(payload, { onConflict: 'agencia_id,cliente_id' })
      .select()
      .single();

    if (error) return traduzirErroBanco(error, 'POST /api/crm/ai/config');

    return NextResponse.json(semChave(data));
  } catch (err: any) {
    console.error('Erro ao salvar configuração de IA:', err);
    return respostaErro('Falha interna ao salvar configuração de IA.', 500);
  }
}
