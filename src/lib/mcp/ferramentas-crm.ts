/**
 * Ferramentas do MCP - CRM e Gestão de Vendas (Agência e Clientes)
 */
import { supabase as db } from '../supabase';
import { ErroFerramenta, type Ferramenta } from './ferramentas';
import { garantirPipelinePadrao } from '../crm';

export const FERRAMENTAS_CRM: Ferramenta[] = [
  {
    name: 'crm_listar_negocios',
    title: 'Listar negócios do CRM',
    description:
      'Lista as oportunidades/leads no CRM da agência ou de um cliente específico. Retorna título, contato, telefone, e-mail, valor, estágio atual, responsável e tempo sem contato. Filtra por status ("aberto", "ganho", "perdido"), busca ou cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'ID do cliente (vazio = funil interno da agência).' },
        status: { type: 'string', enum: ['aberto', 'ganho', 'perdido', 'all'], description: 'Padrão "aberto".' },
        busca: { type: 'string', description: 'Trecho do nome do lead, empresa ou @ do Instagram.' },
        cidade: { type: 'string', description: 'Filtra por cidade da sede (ex: "João Pessoa", "Recife").' },
        nicho: { type: 'string', description: 'Filtra por nicho (ex: "Direito Previdenciário", "Endocrinologia").' },
        tier: { type: 'string', enum: ['A', 'B', 'C', 'all'], description: 'Filtra por Tier ICP: A (8 a 10), B (5 a 7.9) ou C (0 a 4.9).' },
        score_minimo: { type: 'number', description: 'Filtra negócios com score de qualificação maior ou igual a este valor.' },
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      let query = db
        .from('crm_negocios')
        .select(`
          id, titulo, valor, status, nome_contato, telefone, email, instagram_username, empresa,
          cargo, origem, prioridade, tags, tipo_perfil, cidade, bairro, nicho, dor_principal,
          url_site, score_qualificacao, data_proximo_followup, ultimo_contato_em, criado_em,
          estagio:crm_estagios!estagio_id(id, nome, cor, tipo_conclusao),
          responsavel:membros!responsavel_id(id, nome)
        `)
        .eq('agencia_id', ctx.agenciaId)
        .order('ordem_no_estagio', { ascending: true })
        .order('criado_em', { ascending: false });

      if (args.cliente_id) {
        query = query.eq('cliente_id', args.cliente_id);
      } else {
        query = query.is('cliente_id', null);
      }

      const statusFiltro = args.status || 'aberto';
      if (statusFiltro !== 'all') {
        query = query.eq('status', statusFiltro);
      }

      if (args.cidade && typeof args.cidade === 'string') {
        query = query.ilike('cidade', `%${args.cidade.trim()}%`);
      }

      if (args.nicho && typeof args.nicho === 'string') {
        query = query.ilike('nicho', `%${args.nicho.trim()}%`);
      }

      if (args.score_minimo !== undefined && !isNaN(Number(args.score_minimo))) {
        query = query.gte('score_qualificacao', Number(args.score_minimo));
      }

      if (args.tier && args.tier !== 'all') {
        if (args.tier === 'A') {
          query = query.gte('score_qualificacao', 8.0);
        } else if (args.tier === 'B') {
          query = query.gte('score_qualificacao', 5.0).lt('score_qualificacao', 8.0);
        } else if (args.tier === 'C') {
          query = query.lt('score_qualificacao', 5.0);
        }
      }

      if (args.busca && typeof args.busca === 'string') {
        const termo = args.busca.trim().replace(/[%,()*\\]/g, ' ');
        query = query.or(`titulo.ilike.%${termo}%,nome_contato.ilike.%${termo}%,empresa.ilike.%${termo}%`);
      }

      let { data, error } = await query;

      // Fallback gracioso caso a migration de novas colunas ou relações ainda não tenha sido aplicada no Supabase
      if (error && (error.message.includes('column') || (error as any).code === '42703' || (error as any).code === 'PGRST200' || (error as any).code === 'PGRST201')) {
        let fallbackQuery = db
          .from('crm_negocios')
          .select(`
            id, titulo, valor, status, nome_contato, telefone, email, instagram_username, empresa,
            cargo, origem, prioridade, tags, ultimo_contato_em, criado_em,
            estagio:crm_estagios!estagio_id(id, nome, cor, tipo_conclusao),
            responsavel:membros!responsavel_id(id, nome)
          `)
          .eq('agencia_id', ctx.agenciaId)
          .order('ordem_no_estagio', { ascending: true })
          .order('criado_em', { ascending: false });

        if (args.cliente_id) fallbackQuery = fallbackQuery.eq('cliente_id', args.cliente_id);
        else fallbackQuery = fallbackQuery.is('cliente_id', null);

        if (statusFiltro !== 'all') fallbackQuery = fallbackQuery.eq('status', statusFiltro);

        const fbResult = await fallbackQuery;
        if (!fbResult.error && fbResult.data) {
          data = fbResult.data as any;
          error = null;
        } else {
          // Segundo fallback: consulta plana sem joins se houver restrição de relação
          const flatResult = await db
            .from('crm_negocios')
            .select('*')
            .eq('agencia_id', ctx.agenciaId)
            .order('criado_em', { ascending: false });
          if (!flatResult.error && flatResult.data) {
            data = flatResult.data as any;
            error = null;
          }
        }
      }

      if (error) {
        throw new ErroFerramenta(
          `Erro ao listar negócios do CRM: ${error.message}. ` +
          `Dica: certifique-se de que a migration "20261012_crm_sistema_completo.sql" e "20261109_crm_qualificacao_sdr.sql" foram executadas no banco de dados.`
        );
      }

      return {
        total: (data || []).length,
        negocios: data || [],
      };
    },
  },

  {
    name: 'crm_criar_negocio',
    title: 'Criar negócio no CRM',
    description:
      'Cadastra uma nova oportunidade/lead no funil do CRM da agência com dados completos de auditoria, nicho, dor técnica, score de qualificação ICP e agendamento de follow-up.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título da oportunidade (ex: "Dr. André - Plano Completo").' },
        nome_contato: { type: 'string', description: 'Nome da pessoa de contato.' },
        telefone: { type: 'string', description: 'WhatsApp ou telefone com DDD.' },
        email: { type: 'string', description: 'E-mail do lead.' },
        valor: { type: 'number', description: 'Valor estimado em R$.' },
        cliente_id: { type: 'string', description: 'ID do cliente da agência (vazio = agência).' },
        empresa: { type: 'string', description: 'Nome da clínica ou escritório (se B2B).' },
        tipo_perfil: { type: 'string', enum: ['profissional', 'empresa'], description: 'Tipo do lead ("profissional" para Dr./Dra. ou "empresa" para clínica/escritório).' },
        cidade: { type: 'string', description: 'Cidade da sede (ex: "João Pessoa", "Recife", "Campina Grande").' },
        bairro: { type: 'string', description: 'Bairro da sede (ex: "Manaíra", "Boa Viagem").' },
        nicho: { type: 'string', description: 'Nicho auditado (ex: "Direito Previdenciário", "Cardiologia").' },
        dor_principal: { type: 'string', description: 'Gargalo técnico auditado (ex: "Sem Meta Pixel, landing page não responsiva").' },
        url_site: { type: 'string', description: 'URL do site ou Linktree atual.' },
        score_qualificacao: { type: 'number', description: 'Score de qualificação ICP 360 de 0.0 a 10.0.' },
        data_proximo_followup: { type: 'string', description: 'Data e hora ISO do próximo follow-up (ex: "2026-11-11T10:00:00-03:00").' },
        origem: { type: 'string', enum: ['manual', 'instagram', 'formulario', 'webhook_ads', 'indicacao', 'outros'] },
        prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'] },
      },
      required: ['titulo', 'nome_contato'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const clienteId = (args.cliente_id as string) || null;
      const pipe = await garantirPipelinePadrao(ctx.agenciaId, clienteId);
      if (!pipe || !pipe.estagios || pipe.estagios.length === 0) {
        throw new ErroFerramenta('Pipeline de vendas não encontrado ou sem etapas configuradas.');
      }

      const primeiroEstagio = pipe.estagios[0];

      let { data: negocio, error } = await db
        .from('crm_negocios')
        .insert({
          agencia_id: ctx.agenciaId,
          cliente_id: clienteId,
          pipeline_id: pipe.id,
          estagio_id: primeiroEstagio.id,
          titulo: String(args.titulo).trim(),
          nome_contato: String(args.nome_contato).trim(),
          telefone: args.telefone ? String(args.telefone).trim() : null,
          email: args.email ? String(args.email).trim().toLowerCase() : null,
          valor: Number(args.valor) || 0,
          empresa: args.empresa ? String(args.empresa).trim() : null,
          tipo_perfil: args.tipo_perfil || null,
          cidade: args.cidade ? String(args.cidade).trim() : null,
          bairro: args.bairro ? String(args.bairro).trim() : null,
          nicho: args.nicho ? String(args.nicho).trim() : null,
          dor_principal: args.dor_principal ? String(args.dor_principal).trim() : null,
          url_site: args.url_site ? String(args.url_site).trim() : null,
          score_qualificacao: args.score_qualificacao !== undefined ? Number(args.score_qualificacao) : null,
          data_proximo_followup: args.data_proximo_followup ? String(args.data_proximo_followup) : null,
          origem: (args.origem as any) || 'manual',
          prioridade: (args.prioridade as any) || 'media',
          responsavel_id: ctx.membroId || null,
          status: 'aberto',
          ultimo_contato_em: new Date().toISOString(),
        })
        .select()
        .single();

      // Se falhar porque as novas colunas ainda não foram migradas no Supabase (código 42703 ou mensagem "column")
      if (error && (error.message.includes('column') || (error as any).code === '42703')) {
        const tagsExtras: string[] = [];
        if (args.cidade) tagsExtras.push(`cidade:${args.cidade}`);
        if (args.nicho) tagsExtras.push(`nicho:${args.nicho}`);
        if (args.score_qualificacao !== undefined) tagsExtras.push(`score:${args.score_qualificacao}`);
        if (args.tipo_perfil) tagsExtras.push(`perfil:${args.tipo_perfil}`);

        const retry = await db
          .from('crm_negocios')
          .insert({
            agencia_id: ctx.agenciaId,
            cliente_id: clienteId,
            pipeline_id: pipe.id,
            estagio_id: primeiroEstagio.id,
            titulo: String(args.titulo).trim(),
            nome_contato: String(args.nome_contato).trim(),
            telefone: args.telefone ? String(args.telefone).trim() : null,
            email: args.email ? String(args.email).trim().toLowerCase() : null,
            valor: Number(args.valor) || 0,
            empresa: args.empresa ? String(args.empresa).trim() : null,
            origem: (args.origem as any) || 'manual',
            prioridade: (args.prioridade as any) || 'media',
            responsavel_id: ctx.membroId || null,
            status: 'aberto',
            tags: tagsExtras,
            ultimo_contato_em: new Date().toISOString(),
          })
          .select()
          .single();

        if (!retry.error && retry.data) {
          negocio = retry.data;
          error = null;
        }
      }

      // Se falhar por chave estrangeira do membro
      if (error && (error as any).code === '23503') {
        const retrySemMembro = await db
          .from('crm_negocios')
          .insert({
            agencia_id: ctx.agenciaId,
            cliente_id: clienteId,
            pipeline_id: pipe.id,
            estagio_id: primeiroEstagio.id,
            titulo: String(args.titulo).trim(),
            nome_contato: String(args.nome_contato).trim(),
            telefone: args.telefone ? String(args.telefone).trim() : null,
            email: args.email ? String(args.email).trim().toLowerCase() : null,
            valor: Number(args.valor) || 0,
            empresa: args.empresa ? String(args.empresa).trim() : null,
            origem: (args.origem as any) || 'manual',
            prioridade: (args.prioridade as any) || 'media',
            responsavel_id: null,
            status: 'aberto',
            ultimo_contato_em: new Date().toISOString(),
          })
          .select()
          .single();

        if (!retrySemMembro.error && retrySemMembro.data) {
          negocio = retrySemMembro.data;
          error = null;
        }
      }

      if (error || !negocio) {
        throw new ErroFerramenta(
          `Falha ao criar negócio no CRM: ${error?.message || 'Erro de gravação'}. ` +
          `Dica: certifique-se de que as migrations "20261012_crm_sistema_completo.sql" e "20261109_crm_qualificacao_sdr.sql" foram executadas no Supabase.`
        );
      }

      await db.from('crm_atividades').insert({
        negocio_id: negocio.id,
        agencia_id: ctx.agenciaId,
        membro_id: ctx.membroId,
        tipo: 'criacao',
        descricao: `Oportunidade criada via MCP na etapa "${primeiroEstagio.nome}" com Score ${args.score_qualificacao ?? 'N/A'}`,
      });

      return {
        sucesso: true,
        negocio_id: negocio.id,
        titulo: negocio.titulo,
        etapa: primeiroEstagio.nome,
        score: negocio.score_qualificacao,
      };
    },
  },

  {
    name: 'crm_mover_negocio',
    title: 'Mover negócio no funil',
    description:
      'Avança ou altera o estágio de um negócio no CRM. Pode marcar como "ganho" ou "perdido" especificando o motivo da perda ou valor final.',
    inputSchema: {
      type: 'object',
      properties: {
        negocio_id: { type: 'string', description: 'ID (UUID) do negócio.' },
        estagio_id: { type: 'string', description: 'ID do estágio de destino.' },
        motivo_perda: { type: 'string', description: 'Obrigatório se a etapa de destino for de perda.' },
        valor_final: { type: 'number', description: 'Valor fechado (se ganho).' },
      },
      required: ['negocio_id', 'estagio_id'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const { data: estagio } = await db.from('crm_estagios').select('*').eq('id', args.estagio_id).maybeSingle();
      if (!estagio) throw new ErroFerramenta('Estágio de destino não encontrado.');

      let status = 'aberto';
      let dataConclusao = null;
      let tipoAtividade = 'mudanca_estagio';
      let desc = `Card movido para etapa "${estagio.nome}"`;

      if (estagio.tipo_conclusao === 'ganho') {
        status = 'ganho';
        dataConclusao = new Date().toISOString();
        tipoAtividade = 'ganho';
        desc = `🏆 Negócio GANHO na etapa "${estagio.nome}"!`;
      } else if (estagio.tipo_conclusao === 'perdido') {
        status = 'perdido';
        dataConclusao = new Date().toISOString();
        tipoAtividade = 'perda';
        desc = `❌ Negócio perdido na etapa "${estagio.nome}". Motivo: ${args.motivo_perda || 'Não informado'}`;
      }

      const updates: Record<string, any> = {
        estagio_id: args.estagio_id,
        status,
        data_conclusao: dataConclusao,
        motivo_perda: args.motivo_perda || null,
        ultimo_contato_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      };
      if (args.valor_final !== undefined) updates.valor = Number(args.valor_final);

      const { data: atualizado, error } = await db
        .from('crm_negocios')
        .update(updates)
        .eq('id', args.negocio_id)
        .eq('agencia_id', ctx.agenciaId)
        .select()
        .single();

      if (error) throw new ErroFerramenta(`Falha ao mover negócio: ${error.message}`);

      await db.from('crm_atividades').insert({
        negocio_id: args.negocio_id,
        agencia_id: ctx.agenciaId,
        membro_id: ctx.membroId || null,
        tipo: tipoAtividade,
        descricao: desc,
      });

      return { sucesso: true, negocio: atualizado };
    },
  },

  {
    name: 'crm_adicionar_nota',
    title: 'Adicionar nota no negócio do CRM',
    description: 'Registra uma anotação, feedback de reunião ou resumo de ligação na linha do tempo de um negócio.',
    inputSchema: {
      type: 'object',
      properties: {
        negocio_id: { type: 'string', description: 'ID do negócio.' },
        texto: { type: 'string', description: 'Conteúdo da anotação.' },
        tipo: { type: 'string', enum: ['nota', 'whatsapp', 'ligacao', 'reuniao'], description: 'Padrão "nota".' },
      },
      required: ['negocio_id', 'texto'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const { data, error } = await db
        .from('crm_atividades')
        .insert({
          negocio_id: args.negocio_id,
          agencia_id: ctx.agenciaId,
          membro_id: ctx.membroId || null,
          tipo: args.tipo || 'nota',
          descricao: String(args.texto).trim(),
        })
        .select()
        .single();

      if (error) throw new ErroFerramenta(`Falha ao registrar anotação: ${error.message}`);

      await db
        .from('crm_negocios')
        .update({ ultimo_contato_em: new Date().toISOString() })
        .eq('id', args.negocio_id);

      return { sucesso: true, atividade: data };
    },
  },

  {
    name: 'crm_listar_estagios',
    title: 'Listar estágios do funil do CRM',
    description:
      'Retorna a lista de etapas/estágios do pipeline com seus IDs, nomes, ordem e cores. Permite que agentes descubram dinamicamente as etapas do funil para onde mover os leads.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'ID do cliente (vazio = funil interno da agência).' },
        pipeline_id: { type: 'string', description: 'ID do pipeline (opcional; se omitido, busca o pipeline padrão ativo).' },
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      let pipelineId = args.pipeline_id ? String(args.pipeline_id) : undefined;
      if (!pipelineId) {
        const clienteId = typeof args.cliente_id === 'string' ? args.cliente_id : null;
        const pipe = await garantirPipelinePadrao(ctx.agenciaId, clienteId);
        pipelineId = pipe?.id;
      }

      if (!pipelineId) {
        throw new ErroFerramenta('Pipeline de vendas não localizado.');
      }

      const { data: estagios, error } = await db
        .from('crm_estagios')
        .select('id, pipeline_id, nome, cor, ordem, tipo_conclusao, dias_limite_estagnado')
        .eq('pipeline_id', pipelineId)
        .order('ordem', { ascending: true });

      if (error) throw new ErroFerramenta(`Falha ao listar estágios: ${error.message}`);

      return {
        pipeline_id: pipelineId,
        total: (estagios || []).length,
        estagios: estagios || [],
      };
    },
  },

  {
    name: 'crm_agendar_followup',
    title: 'Agendar follow-up para um lead',
    description:
      'Registra a data e hora da próxima reabordagem para o lead no CRM, criando uma tarefa pendente e uma anotação na linha do tempo.',
    inputSchema: {
      type: 'object',
      properties: {
        negocio_id: { type: 'string', description: 'ID (UUID) do negócio no CRM.' },
        data_hora: { type: 'string', description: 'Data e hora do follow-up no formato ISO (ex: "2026-11-11T15:00:00-03:00").' },
        tipo: { type: 'string', enum: ['whatsapp', 'ligacao', 'reuniao'], description: 'Canal previsto para o follow-up (padrão: "whatsapp").' },
        motivo: { type: 'string', description: 'Contexto ou motivo da reabordagem (ex: "Lead pediu para chamar quinta após as 15h").' },
      },
      required: ['negocio_id', 'data_hora'],
      additionalProperties: false,
    },
    somenteLeitura: false,
    async executar(args, ctx) {
      const dataHora = String(args.data_hora).trim();
      const tipo = args.tipo || 'whatsapp';
      const motivo = args.motivo ? String(args.motivo).trim() : 'Follow-up agendado';

      // 1. Atualiza a data no negócio
      const { data: negocio, error: negErr } = await db
        .from('crm_negocios')
        .update({
          data_proximo_followup: dataHora,
          ultimo_contato_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', args.negocio_id)
        .eq('agencia_id', ctx.agenciaId)
        .select()
        .single();

      // Se falhar apenas porque a coluna data_proximo_followup não foi criada no banco
      if (negErr && (negErr.message.includes('column') || (negErr as any).code === '42703')) {
        await db
          .from('crm_negocios')
          .update({
            ultimo_contato_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', args.negocio_id)
          .eq('agencia_id', ctx.agenciaId);
      } else if (negErr) {
        throw new ErroFerramenta(`Erro ao agendar follow-up: ${negErr.message}`);
      }

      // 2. Insere a tarefa de follow-up na tabela crm_tarefas
      await db.from('crm_tarefas').insert({
        negocio_id: args.negocio_id,
        agencia_id: ctx.agenciaId,
        responsavel_id: ctx.membroId || null,
        titulo: motivo,
        tipo,
        prazo: dataHora,
        concluida: false,
      });

      // 3. Registra na timeline
      await db.from('crm_atividades').insert({
        negocio_id: args.negocio_id,
        agencia_id: ctx.agenciaId,
        membro_id: ctx.membroId || null,
        tipo: 'tarefa',
        descricao: `⏱ Follow-up agendado para ${dataHora}: ${motivo}`,
      });

      return {
        sucesso: true,
        negocio_id: args.negocio_id,
        data_proximo_followup: dataHora,
        motivo,
      };
    },
  },

  {
    name: 'crm_listar_followups_pendentes',
    title: 'Listar follow-ups pendentes do CRM',
    description:
      'Retorna a fila de leads com follow-up agendado vencido ou com vencimento até a data informada (padrão: NOW). Utilizada pela rotina diária das 08:30 para disparos de reengajamento.',
    inputSchema: {
      type: 'object',
      properties: {
        ate_data: { type: 'string', description: 'Data/hora limite no formato ISO (padrão: agora).' },
        limite: { type: 'number', description: 'Quantidade máxima de leads a retornar (padrão 50).' },
        cliente_id: { type: 'string', description: 'ID do cliente (vazio = agência).' },
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      const dataLimite = args.ate_data ? String(args.ate_data).trim() : new Date().toISOString();
      const limite = Number(args.limite) || 50;

      let query = db
        .from('crm_negocios')
        .select(`
          id, titulo, valor, status, nome_contato, telefone, email, empresa,
          nicho, cidade, bairro, dor_principal, url_site, score_qualificacao,
          data_proximo_followup, ultimo_contato_em,
          estagio:crm_estagios!estagio_id(id, nome, cor)
        `)
        .eq('agencia_id', ctx.agenciaId)
        .eq('status', 'aberto')
        .not('data_proximo_followup', 'is', null)
        .lte('data_proximo_followup', dataLimite)
        .order('data_proximo_followup', { ascending: true })
        .limit(limite);

      if (args.cliente_id) {
        query = query.eq('cliente_id', args.cliente_id);
      } else {
        query = query.is('cliente_id', null);
      }

      let { data, error } = await query;

      // Fallback: se a coluna data_proximo_followup não existir na tabela crm_negocios, consulta crm_tarefas
      if (error && (error.message.includes('column') || (error as any).code === '42703' || (error as any).code === 'PGRST200')) {
        const { data: tarefas, error: tarErr } = await db
          .from('crm_tarefas')
          .select(`
            id, negocio_id, titulo, tipo, prazo,
            negocio:crm_negocios!negocio_id(id, titulo, nome_contato, telefone, empresa, estagio:crm_estagios!estagio_id(id, nome, cor))
          `)
          .eq('agencia_id', ctx.agenciaId)
          .eq('concluida', false)
          .lte('prazo', dataLimite)
          .order('prazo', { ascending: true })
          .limit(limite);

        if (!tarErr && tarefas) {
          data = tarefas.map((t: any) => ({
            id: t.negocio?.id || t.negocio_id,
            titulo: t.negocio?.titulo || t.titulo,
            nome_contato: t.negocio?.nome_contato || 'Lead',
            telefone: t.negocio?.telefone || null,
            empresa: t.negocio?.empresa || null,
            data_proximo_followup: t.prazo,
            estagio: t.negocio?.estagio || null,
          })) as any;
          error = null;
        }
      }

      if (error) {
        throw new ErroFerramenta(`Erro ao listar follow-ups pendentes: ${error.message}`);
      }

      return {
        total: (data || []).length,
        data_referencia: dataLimite,
        leads_pendentes: data || [],
      };
    },
  },
];
