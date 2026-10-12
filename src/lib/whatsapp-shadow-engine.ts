import { supabase as serviceSupabase } from '@/lib/supabase';
import { garantirPipelinePadrao } from '@/lib/crm';

interface AnaliseMensagemContexto {
  agenciaId: string;
  clienteId: string | null;
  remetenteTelefone: string;
  remetenteNome?: string | null;
  mensagensTexto: string[]; // histórico recente da conversa (paciente + secretária)
}

interface DecisaoIAWhatsApp {
  criarNovoCard: boolean;
  moverEstagio: boolean;
  nomeContatoSugerido?: string;
  tituloNegocioSugerido?: string;
  procedimentoInteresse?: string;
  valorEstimado?: number;
  estagioAlvoNome?: 'Novo Lead' | 'Em Atendimento' | 'Qualificado' | 'Consulta Agendada' | 'Venda Fechada' | 'Perdido';
  resumoConversa?: string;
  motivoPerda?: string;
  dataHoraAgendada?: string;
}

/**
 * Analisa a janela recente de conversa do WhatsApp usando LLM para inferir intenções,
 * extrair dados do paciente/procedimento e decidir movimentações no CRM.
 */
export async function analisarConversaWhatsAppComIA(
  conversa: string,
  historicoCard?: any
): Promise<DecisaoIAWhatsApp> {
  const promptSistema = `Você é um analista especialista em CRM e vendas para clínicas e empresas prestadoras de serviços.
Sua missão é analisar o diálogo do WhatsApp entre um cliente/paciente e o atendente/secretária e extrair com precisão cirúrgica:
1. Identificação do Lead: Nome da pessoa (se mencionado) e procedimento ou queixa de interesse (ex: Botox, Harmonização, Limpeza de Pele, Consulta Dermatológica, etc).
2. Estágio Atual no Funil:
   - "Novo Lead": se foi apenas um primeiro "olá" ou dúvida inicial sem aprofundamento.
   - "Em Atendimento": se a secretária está tirando dúvidas, explicando valores ou enviando opções.
   - "Qualificado": se o paciente confirmou que tem interesse real e atende aos pré-requisitos.
   - "Consulta Agendada": se foi COMBINADO um dia ou horário específico entre as partes (ex: "fechado para quinta às 15h").
   - "Venda Fechada": se o paciente compareceu, pagou ou confirmou o procedimento.
   - "Perdido": se o paciente disse explicitamente que desistiu, achou muito caro, marcou com outro ou pediu para cancelar.
3. Resumo da Conversa: Um parágrafo conciso (2 a 3 frases) com o status atual para a médica ou gestor ler.

Responda ESTRITAMENTE em formato JSON com as chaves:
{
  "criarNovoCard": boolean,
  "moverEstagio": boolean,
  "nomeContatoSugerido": string ou null,
  "tituloNegocioSugerido": string ou null,
  "procedimentoInteresse": string ou null,
  "valorEstimado": number ou null,
  "estagioAlvoNome": "Novo Lead" | "Em Atendimento" | "Qualificado" | "Consulta Agendada" | "Venda Fechada" | "Perdido" ou null,
  "resumoConversa": string,
  "motivoPerda": string ou null,
  "dataHoraAgendada": string ou null
}`;

  // Se tiver chaves de API configuradas no ambiente ou no banco, usa OpenAI ou fallback inteligente
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: promptSistema },
            {
              role: 'user',
              content: `Histórico recente da conversa:\n${conversa}\n\nDados atuais do negócio:\n${JSON.stringify(historicoCard || {})}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content) as DecisaoIAWhatsApp;
        }
      }
    } catch (err) {
      console.error('[IA WhatsApp] Erro na chamada à OpenAI:', err);
    }
  }

  // Fallback heurístico inteligente caso não haja API Key conectada no momento
  const convLower = conversa.toLowerCase();
  const temAgendamento =
    convLower.includes('agendado') ||
    convLower.includes('marcado') ||
    convLower.includes('confirmado para') ||
    convLower.includes('às ') ||
    convLower.includes('as ') ||
    convLower.includes('horário marcado');

  const temDesistencia =
    convLower.includes('desisti') ||
    convLower.includes('não vou poder') ||
    convLower.includes('muito caro') ||
    convLower.includes('cancelar');

  return {
    criarNovoCard: true,
    moverEstagio: temAgendamento || temDesistencia,
    estagioAlvoNome: temDesistencia ? 'Perdido' : temAgendamento ? 'Consulta Agendada' : 'Em Atendimento',
    resumoConversa: 'Conversa em andamento no WhatsApp.',
    procedimentoInteresse: 'Interesse via WhatsApp',
    motivoPerda: temDesistencia ? 'Desistência informada no WhatsApp' : undefined,
  };
}

/**
 * Processa a sincronização de mensagens do WhatsApp e aplica as decisões da IA no CRM.
 */
export async function sincronizarMensagemEAtualizarCrm(ctx: AnaliseMensagemContexto) {
  const { agenciaId, clienteId, remetenteTelefone, remetenteNome, mensagensTexto } = ctx;

  const telefoneLimpo = remetenteTelefone.replace(/\D/g, '');
  if (!telefoneLimpo) return;

  // 1. Busca se já existe um negócio ativo para este contato/telefone neste cliente
  let { data: negocioExistente } = await serviceSupabase
    .from('crm_negocios')
    .select('*, estagio:crm_estagios!estagio_id(*)')
    .eq('agencia_id', agenciaId)
    .ilike('telefone', `%${telefoneLimpo.slice(-8)}%`)
    .eq('status', 'aberto')
    .maybeSingle();

  // Garante que o pipeline exista
  const pipeline = await garantirPipelinePadrao(agenciaId, clienteId);
  if (!pipeline) return { ok: false, error: 'Pipeline padrão não encontrado' };
  const estagios = pipeline.estagios || [];

  const conversaTexto = mensagensTexto.join('\n');
  const decisao = await analisarConversaWhatsAppComIA(conversaTexto, negocioExistente);

  // 2. Se NÃO existe card e a IA recomendou criar:
  if (!negocioExistente && decisao.criarNovoCard) {
    const estagioInicial =
      estagios.find((e) => e.nome.toLowerCase() === (decisao.estagioAlvoNome || 'novo lead').toLowerCase()) ||
      estagios[0];

    const titulo = decisao.tituloNegocioSugerido || `${decisao.procedimentoInteresse || 'Atendimento'} - ${remetenteNome || telefoneLimpo}`;

    const { data: novoNegocio, error: erroCriar } = await serviceSupabase
      .from('crm_negocios')
      .insert({
        agencia_id: agenciaId,
        cliente_id: clienteId,
        pipeline_id: pipeline.id,
        estagio_id: estagioInicial.id,
        titulo,
        valor: decisao.valorEstimado || 0,
        nome_contato: decisao.nomeContatoSugerido || remetenteNome || `Lead (${telefoneLimpo})`,
        telefone: telefoneLimpo,
        origem: 'whatsapp',
        prioridade: 'media',
        status: 'aberto',
        ultimo_contato_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (!erroCriar && novoNegocio) {
      negocioExistente = novoNegocio;

      // Log da ação
      await serviceSupabase.from('whatsapp_ia_acoes').insert({
        agencia_id: agenciaId,
        cliente_id: clienteId,
        negocio_id: novoNegocio.id,
        acao: 'card_criado',
        estagio_novo: estagioInicial.nome,
        resumo_detectado: decisao.resumoConversa || 'Card criado automaticamente pela escuta ativa do WhatsApp.',
      });

      // Atividade no CRM
      await serviceSupabase.from('crm_atividades').insert({
        negocio_id: novoNegocio.id,
        agencia_id: agenciaId,
        tipo: 'criacao',
        descricao: `⚡ Oportunidade criada automaticamente via escuta ativa do WhatsApp. Interesse: ${decisao.procedimentoInteresse || 'Não especificado'}.`,
      });
    }
  }

  // 3. Se JÁ EXISTE card e a IA detectou mudança de estágio (ex: Agendamento ou Perda):
  if (negocioExistente && decisao.moverEstagio && decisao.estagioAlvoNome) {
    const estagioDestino = estagios.find(
      (e) => e.nome.toLowerCase() === decisao.estagioAlvoNome!.toLowerCase()
    );

    if (estagioDestino && estagioDestino.id !== negocioExistente.estagio_id) {
      const updates: Record<string, any> = {
        estagio_id: estagioDestino.id,
        ultimo_contato_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };

      if (estagioDestino.tipo_conclusao === 'perdido') {
        updates.status = 'perdido';
        updates.motivo_perda = decisao.motivoPerda || 'Perda detectada na conversa';
        updates.data_conclusao = new Date().toISOString();
      } else if (estagioDestino.tipo_conclusao === 'ganho') {
        updates.status = 'ganho';
        updates.data_conclusao = new Date().toISOString();
      }

      await serviceSupabase
        .from('crm_negocios')
        .update(updates)
        .eq('id', negocioExistente.id);

      // Log de ação da IA
      await serviceSupabase.from('whatsapp_ia_acoes').insert({
        agencia_id: agenciaId,
        cliente_id: clienteId,
        negocio_id: negocioExistente.id,
        acao: 'estagio_movido',
        estagio_anterior: negocioExistente.estagio?.nome || 'Anterior',
        estagio_novo: estagioDestino.nome,
        resumo_detectado: decisao.resumoConversa || `Card movido para "${estagioDestino.nome}" com base nas mensagens trocadas.`,
      });

      // Atividade cronológica no CRM
      await serviceSupabase.from('crm_atividades').insert({
        negocio_id: negocioExistente.id,
        agencia_id: agenciaId,
        tipo: 'mudanca_estagio',
        descricao: `⚡ IA Copiloto moveu o card para "${estagioDestino.nome}": ${decisao.resumoConversa || 'Identificado na conversa do WhatsApp.'}`,
      });
    }
  }

  // 4. Salva resumo periódico na timeline do card
  if (negocioExistente && decisao.resumoConversa) {
    await serviceSupabase.from('crm_atividades').insert({
      negocio_id: negocioExistente.id,
      agencia_id: agenciaId,
      tipo: 'whatsapp',
      descricao: `💬 Resumo do WhatsApp: ${decisao.resumoConversa}`,
      dados_extras: { data_hora_agendada: decisao.dataHoraAgendada || null },
    });
  }

  return { ok: true, negocioId: negocioExistente?.id || null };
}
