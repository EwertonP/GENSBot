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
      },
      additionalProperties: false,
    },
    somenteLeitura: true,
    async executar(args, ctx) {
      let query = db
        .from('crm_negocios')
        .select(`
          id, titulo, valor, status, nome_contato, telefone, email, instagram_username, empresa,
          origem, prioridade, tags, ultimo_contato_em, criado_em,
          estagio:crm_estagios(id, nome, cor, tipo_conclusao),
          responsavel:membros(id, nome)
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

      if (args.busca && typeof args.busca === 'string') {
        const termo = args.busca.trim().replace(/[%,()*\\]/g, ' ');
        query = query.or(`titulo.ilike.%${termo}%,nome_contato.ilike.%${termo}%,empresa.ilike.%${termo}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

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
      'Cadastra uma nova oportunidade/lead no funil do CRM da agência ou de um cliente. Se não for informado estágio, insere na etapa inicial do pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título da oportunidade (ex: "Dr. André - Plano Completo").' },
        nome_contato: { type: 'string', description: 'Nome da pessoa de contato.' },
        telefone: { type: 'string', description: 'WhatsApp ou telefone com DDD.' },
        email: { type: 'string', description: 'E-mail do lead.' },
        valor: { type: 'number', description: 'Valor estimado em R$.' },
        cliente_id: { type: 'string', description: 'ID do cliente da agência (vazio = agência).' },
        empresa: { type: 'string', description: 'Nome da empresa (se B2B).' },
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

      const { data: negocio, error } = await db
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
          responsavel_id: ctx.membroId,
          status: 'aberto',
          ultimo_contato_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !negocio) throw new Error(error?.message || 'Falha ao criar negócio.');

      await db.from('crm_atividades').insert({
        negocio_id: negocio.id,
        agencia_id: ctx.agenciaId,
        membro_id: ctx.membroId,
        tipo: 'criacao',
        descricao: `Oportunidade criada via MCP na etapa "${primeiroEstagio.nome}"`,
      });

      return {
        sucesso: true,
        negocio_id: negocio.id,
        titulo: negocio.titulo,
        etapa: primeiroEstagio.nome,
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

      if (error) throw new Error(error.message);

      await db.from('crm_atividades').insert({
        negocio_id: args.negocio_id,
        agencia_id: ctx.agenciaId,
        membro_id: ctx.membroId,
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
          membro_id: ctx.membroId,
          tipo: args.tipo || 'nota',
          descricao: String(args.texto).trim(),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await db
        .from('crm_negocios')
        .update({ ultimo_contato_em: new Date().toISOString() })
        .eq('id', args.negocio_id);

      return { sucesso: true, atividade: data };
    },
  },
];
