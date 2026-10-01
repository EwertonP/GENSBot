/**
 * Servidor MCP (JSON-RPC 2.0 sobre Streamable HTTP, modo sem estado: cada POST
 * recebe uma resposta JSON). Implementa initialize, ping, tools/list e tools/call.
 */
import { supabase as serviceSupabase } from '../supabase';
import type { ContextoMcp } from './oauth';
import { ErroFerramenta, FERRAMENTAS as FERRAMENTAS_C1 } from './ferramentas';
import { FERRAMENTAS_C2 } from './ferramentas-c2';
import { FERRAMENTAS_C3 } from './ferramentas-c3';
import { FERRAMENTAS_C4 } from './ferramentas-c4';
import { FERRAMENTAS_C5 } from './ferramentas-c5';
import { FERRAMENTAS_C6 } from './ferramentas-c6';
import { FERRAMENTAS_C7 } from './ferramentas-c7';
import { FERRAMENTAS_C8 } from './ferramentas-c8';

const FERRAMENTAS = [...FERRAMENTAS_C1, ...FERRAMENTAS_C2, ...FERRAMENTAS_C3, ...FERRAMENTAS_C4, ...FERRAMENTAS_C5, ...FERRAMENTAS_C6, ...FERRAMENTAS_C7, ...FERRAMENTAS_C8];

export const VERSOES_PROTOCOLO = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCOES = [
  'Você está conectado ao GENSBot, o sistema operacional da Agência GENS (clientes, esteira de demandas, rotina da equipe).',
  'Antes de criar conteúdo de um cliente, use ler_cliente para respeitar tom, regras e restrições e não repetir temas.',
  'Conteúdo (post/reel/story) só entra via criar_demandas_lote com o scorecard do MetodoViral (média ≥ 9 e humanizer rodado).',
  'Automações de DM nascem pausadas, só são editadas pausadas e exigem a copy já passada pelo humanizer; ativar é sempre pela tela.',
  'Formulários criados ficam em rascunho; aprovações devolvem link e mensagem para a equipe enviar.',
  'Você não publica, não envia mensagens a clientes e não exclui nada. Confirme com a pessoa antes de mover várias demandas de uma vez.',
].join(' ');

interface RequisicaoRpc {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type RespostaRpc =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

function erro(id: RequisicaoRpc['id'], code: number, message: string): RespostaRpc {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function listarFerramentas() {
  return FERRAMENTAS.map((f) => ({
    name: f.name,
    title: f.title,
    description: f.description,
    inputSchema: f.inputSchema,
    annotations: { title: f.title, readOnlyHint: f.somenteLeitura, destructiveHint: false, openWorldHint: false },
  }));
}

async function auditar(ctx: ContextoMcp, ferramenta: string, argumentos: unknown, sucesso: boolean, resumo: string) {
  const args = JSON.stringify(argumentos ?? {});
  const { error } = await serviceSupabase.from('mcp_audit_log').insert({
    agencia_id: ctx.agenciaId,
    membro_id: ctx.membroId,
    client_id: ctx.clientId,
    ferramenta,
    // Argumentos grandes (lote de demandas) são truncados no log.
    argumentos: args.length > 20000 ? { truncado: true, tamanho: args.length } : (argumentos ?? {}),
    sucesso,
    resumo: resumo.slice(0, 500),
  });
  if (error) console.error('mcp_audit_log:', error.message);
}

async function chamarFerramenta(params: Record<string, unknown> | undefined, ctx: ContextoMcp) {
  const nome = String(params?.name || '');
  const args = (params?.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>;
  const ferramenta = FERRAMENTAS.find((f) => f.name === nome);
  if (!ferramenta) return null;

  try {
    const resultado = await ferramenta.executar(args, ctx);
    if (!ferramenta.somenteLeitura) await auditar(ctx, nome, args, true, 'ok');
    return {
      content: [{ type: 'text', text: JSON.stringify(resultado, null, 2) }],
      structuredContent: resultado as Record<string, unknown>,
      isError: false,
    };
  } catch (e) {
    // Erro de validação vai para o modelo corrigir; erro inesperado não vaza detalhe interno.
    const mensagem = e instanceof ErroFerramenta ? e.message : 'Erro interno ao executar a ferramenta. Tente de novo.';
    if (!(e instanceof ErroFerramenta)) console.error(`MCP ${nome}:`, e);
    await auditar(ctx, nome, args, false, e instanceof Error ? e.message : String(e));
    return { content: [{ type: 'text', text: mensagem }], isError: true };
  }
}

/** Processa uma mensagem JSON-RPC. Retorna null para notificações (sem resposta). */
export async function processarMensagem(msg: RequisicaoRpc, ctx: ContextoMcp): Promise<RespostaRpc | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return erro(msg?.id, -32600, 'Requisição JSON-RPC inválida.');
  if (msg.id === undefined || msg.id === null) return null;

  switch (msg.method) {
    case 'initialize': {
      const pedida = String(msg.params?.protocolVersion || '');
      return {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: VERSOES_PROTOCOLO.includes(pedida) ? pedida : VERSOES_PROTOCOLO[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'gensbot', title: 'GENSBot', version: '1.0.0' },
          instructions: INSTRUCOES,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id: msg.id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id: msg.id, result: { tools: listarFerramentas() } };
    case 'tools/call': {
      const resultado = await chamarFerramenta(msg.params, ctx);
      if (!resultado) return erro(msg.id, -32602, `Ferramenta desconhecida: ${String(msg.params?.name)}`);
      return { jsonrpc: '2.0', id: msg.id, result: resultado };
    }
    default:
      return erro(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}
