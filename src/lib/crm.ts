import { supabase } from '@/lib/supabase';
import type { CrmMetricasPipeline, CrmNegocio, CrmPipeline } from '@/types/crm';

/** Formata valor numérico em moeda brasileira (R$) */
export function formatarMoeda(valor: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor || 0);
}

/** Calcula quantos dias o negócio está sem contato registrado */
export function calcularDiasSemContato(ultimoContatoEm?: string | null): number {
  if (!ultimoContatoEm) return 0;
  const data = new Date(ultimoContatoEm).getTime();
  const agora = Date.now();
  const diffDias = Math.floor((agora - data) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDias);
}

/** Limpa e formata o número de telefone para o padrão do WhatsApp (com DDI 55) */
export function normalizarWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

/** Templates comerciais ágeis para WhatsApp */
export const TEMPLATES_WHATSAPP = [
  {
    id: 'primeiro_contato_inbound',
    titulo: 'Primeiro Contato (Lead Novo)',
    mensagem: 'Olá, {nome}! Tudo bem? Vi seu contato através do nosso canal. Como podemos te ajudar hoje?',
  },
  {
    id: 'clinica_confirmacao_consulta',
    titulo: 'Confirmação de Consulta / Procedimento',
    mensagem: 'Olá, {nome}! Tudo bem? Gostaria de confirmar o seu horário marcado conosco para amanhã. Podemos confirmar a sua presença?',
  },
  {
    id: 'clinica_preparo_instrucoes',
    titulo: 'Instruções e Localização da Clínica',
    mensagem: 'Olá, {nome}! Seguem as orientações para o seu atendimento: recomendamos chegar com 10 minutos de antecedência. Nosso endereço é: [Endereço da Clínica]. Qualquer dúvida, estou à disposição!',
  },
  {
    id: 'clinica_resgate_faltoso',
    titulo: 'Resgate / Remarcação de Consulta',
    mensagem: 'Olá, {nome}! Sentimos sua falta no seu horário agendado. Gostaria de verificar uma nova data disponível para você não perder o seu acompanhamento?',
  },
  {
    id: 'followup_proposta',
    titulo: 'Follow-up de Orçamento / Proposta',
    mensagem: 'Oi, {nome}! Passando para saber se conseguiu dar uma olhada na proposta que conversamos. Ficou alguma dúvida?',
  },
  {
    id: 'agendamento_reuniao',
    titulo: 'Agendar Horário / Avaliação',
    mensagem: 'Olá, {nome}! Tudo certo? Temos horários disponíveis para avaliação nesta semana. Qual período do dia fica mais prático para você: manhã ou tarde?',
  },
  {
    id: 'retomada_estagnado',
    titulo: 'Retomada de Contato',
    mensagem: 'Oi, {nome}! Tudo bem por aí? Sei que a rotina é corrida. Ainda tem interesse em avançar com o procedimento que alinhamos?',
  },
] as const;

/** Substitui variáveis como {nome} e {empresa} no template */
export function formatarMensagemWhatsApp(template: string, dados: { nome?: string; empresa?: string }): string {
  let msg = template;
  const primeiroNome = (dados.nome || '').trim().split(' ')[0] || 'amigo(a)';
  msg = msg.replace(/\{nome\}/g, primeiroNome);
  msg = msg.replace(/\{empresa\}/g, dados.empresa || 'sua empresa');
  return msg;
}

/** Gera o link direto de wa.me para abrir a conversa no WhatsApp em 1 clique */
export function gerarLinkWhatsApp(telefone: string, mensagem?: string): string {
  const ddiNum = normalizarWhatsApp(telefone);
  if (!ddiNum) return '';
  const url = `https://wa.me/${ddiNum}`;
  if (mensagem?.trim()) {
    return `${url}?text=${encodeURIComponent(mensagem.trim())}`;
  }
  return url;
}

/** Calcula as métricas principais do funil com base na lista de negócios */
export function calcularMetricasPipeline(negocios: CrmNegocio[]): CrmMetricasPipeline {
  const totalNegocios = negocios.length;
  let negociosAbertos = 0;
  let negociosGanhos = 0;
  let negociosPerdidos = 0;
  let valorTotalAberto = 0;
  let valorTotalGanho = 0;

  for (const n of negocios) {
    const val = Number(n.valor) || 0;
    if (n.status === 'aberto') {
      negociosAbertos++;
      valorTotalAberto += val;
    } else if (n.status === 'ganho') {
      negociosGanhos++;
      valorTotalGanho += val;
    } else if (n.status === 'perdido') {
      negociosPerdidos++;
    }
  }

  const finalizados = negociosGanhos + negociosPerdidos;
  const taxaConversao = finalizados > 0 ? Math.round((negociosGanhos / finalizados) * 100) : 0;
  const ticketMedio = negociosGanhos > 0 ? Math.round(valorTotalGanho / negociosGanhos) : 0;

  return {
    totalNegocios,
    negociosAbertos,
    negociosGanhos,
    negociosPerdidos,
    valorTotalAberto,
    valorTotalGanho,
    taxaConversao,
    ticketMedio,
  };
}

export interface TemplateFunilEstagio {
  nome: string;
  cor: string;
  ordem: number;
  tipo_conclusao: 'aberto' | 'ganho' | 'perdido';
  dias_limite_estagnado: number;
}

export interface TemplateFunil {
  id: string;
  nome: string;
  icone: string;
  descricao: string;
  nichoSugerido: string;
  estagios: TemplateFunilEstagio[];
}

/** Templates de Funis de Alta Conversão por Nicho */
export const TEMPLATES_FUNIS: TemplateFunil[] = [
  {
    id: 'medico_clinica',
    nome: 'Clínica & Área Médica',
    icone: '🩺',
    descricao: 'Consultas, procedimentos dermatológicos, estética avançada e clínicas de saúde.',
    nichoSugerido: 'Medicina, Dermatologia, Odontologia, Estética, Harmonização',
    estagios: [
      { nome: 'Contato / Direct', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 1 },
      { nome: 'Triagem & Interesse', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
      { nome: 'Qualificado / Agendando', cor: '#f59e0b', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
      { nome: 'Consulta Agendada', cor: '#14b8a6', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
      { nome: 'Avaliação / Compareceu', cor: '#6366f1', ordem: 4, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
      { nome: 'Procedimento Fechado', cor: '#10b981', ordem: 5, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
      { nome: 'Não Compareceu / Desistiu', cor: '#ef4444', ordem: 6, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
    ],
  },
  {
    id: 'direito_juridico',
    nome: 'Advocacia & Jurídico',
    icone: '⚖️',
    descricao: 'Atendimento jurídico, análise de documentos e contratos de honorários.',
    nichoSugerido: 'Direito, Advocacia, Jurídico, Escritório de Advocacia',
    estagios: [
      { nome: 'Novo Lead / Dúvida', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 1 },
      { nome: 'Triagem de Viabilidade', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
      { nome: 'Consulta Agendada', cor: '#f59e0b', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
      { nome: 'Análise de Documentos', cor: '#6366f1', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
      { nome: 'Proposta / Procuração', cor: '#ec4899', ordem: 4, tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
      { nome: 'Contrato Fechado', cor: '#10b981', ordem: 5, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
      { nome: 'Inviável / Declinado', cor: '#ef4444', ordem: 6, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
    ],
  },
  {
    id: 'imobiliario_corretagem',
    nome: 'Imobiliário & Alto Padrão',
    icone: '🏢',
    descricao: 'Captação de compradores, agendamento de visitas a imóveis e propostas.',
    nichoSugerido: 'Imobiliária, Corretores, Construção Civil, Arquitetura',
    estagios: [
      { nome: 'Lead Imóvel / Anúncio', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 1 },
      { nome: 'Perfil & Orçamento', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
      { nome: 'Visita Agendada', cor: '#f59e0b', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
      { nome: 'Visita Realizada', cor: '#6366f1', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
      { nome: 'Proposta / Financiamento', cor: '#ec4899', ordem: 4, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
      { nome: 'Venda Concluída', cor: '#10b981', ordem: 5, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
      { nome: 'Perdido / Desistência', cor: '#ef4444', ordem: 6, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
    ],
  },
  {
    id: 'agencia_servicos',
    nome: 'Agência & Serviços B2B',
    icone: '💼',
    descricao: 'Prospecção inbound e outbound, diagnóstico e contratos de serviços contínuos.',
    nichoSugerido: 'Marketing, Agência, B2B, Consultoria, Software',
    estagios: [
      { nome: 'Novo Prospect', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
      { nome: 'Primeiro Contato', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
      { nome: 'Diagnóstico / Reunião', cor: '#ec4899', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
      { nome: 'Proposta Enviada', cor: '#f59e0b', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
      { nome: 'Contrato Fechado', cor: '#10b981', ordem: 4, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
      { nome: 'Perdido', cor: '#ef4444', ordem: 5, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
    ],
  },
  {
    id: 'comercial_geral',
    nome: 'Comercial Padrão',
    icone: '🎯',
    descricao: 'Funil clássico de vendas para produtos, cursos e serviços gerais.',
    nichoSugerido: 'Geral, Cursos, Infoprodutos, Varejo',
    estagios: [
      { nome: 'Novo Lead', cor: '#3b82f6', ordem: 0, tipo_conclusao: 'aberto', dias_limite_estagnado: 2 },
      { nome: 'Em Atendimento', cor: '#8b5cf6', ordem: 1, tipo_conclusao: 'aberto', dias_limite_estagnado: 3 },
      { nome: 'Qualificado / Agendado', cor: '#f59e0b', ordem: 2, tipo_conclusao: 'aberto', dias_limite_estagnado: 4 },
      { nome: 'Negociação', cor: '#6366f1', ordem: 3, tipo_conclusao: 'aberto', dias_limite_estagnado: 5 },
      { nome: 'Venda Realizada', cor: '#10b981', ordem: 4, tipo_conclusao: 'ganho', dias_limite_estagnado: 0 },
      { nome: 'Perdido', cor: '#ef4444', ordem: 5, tipo_conclusao: 'perdido', dias_limite_estagnado: 0 },
    ],
  },
];

/**
 * Garante que a agência ou cliente tenha ao menos 1 pipeline padrão com seus estágios.
 * Se não existir nenhum pipeline ativo, detecta o nicho e cria com as etapas recomendadas.
 */
export async function garantirPipelinePadrao(
  agenciaId: string,
  clienteId: string | null = null,
  nomeCliente?: string | null,
  nichoCliente?: string | null
): Promise<CrmPipeline | null> {
  // 1. Tenta buscar pipeline existente
  let query = supabase
    .from('crm_pipelines')
    .select('*, estagios:crm_estagios(*)')
    .eq('agencia_id', agenciaId)
    .eq('ativo', true);

  if (clienteId) {
    query = query.eq('cliente_id', clienteId);
  } else if (typeof (query as any).is === 'function') {
    query = query.is('cliente_id', null);
  } else if (typeof (query as any).eq === 'function') {
    query = query.eq('cliente_id', null as any);
  }

  const queryExec = typeof (query as any).order === 'function'
    ? (query as any).order('ordem', { ascending: true })
    : query;

  const { data: pipelines, error } = await queryExec;
  if (!error && pipelines && pipelines.length > 0) {
    // Ordena os estágios
    const pipe = pipelines[0];
    if (pipe.estagios) {
      pipe.estagios.sort((a: any, b: any) => a.ordem - b.ordem);
    }
    return pipe as CrmPipeline;
  }

  // 2. Se não existir, seleciona o template adequado pelo nicho
  const ehAgencia = !clienteId;
  const nichoNorm = (nichoCliente || '').toLowerCase();

  let templateEscolhido = TEMPLATES_FUNIS.find((t) => t.id === 'comercial_geral')!;

  if (ehAgencia) {
    templateEscolhido = TEMPLATES_FUNIS.find((t) => t.id === 'agencia_servicos')!;
  } else if (
    nichoNorm.includes('derma') ||
    nichoNorm.includes('medic') ||
    nichoNorm.includes('saude') ||
    nichoNorm.includes('saúde') ||
    nichoNorm.includes('odonto') ||
    nichoNorm.includes('dent') ||
    nichoNorm.includes('estet') ||
    nichoNorm.includes('estét') ||
    nichoNorm.includes('clinic') ||
    nichoNorm.includes('clínic')
  ) {
    templateEscolhido = TEMPLATES_FUNIS.find((t) => t.id === 'medico_clinica')!;
  } else if (
    nichoNorm.includes('advog') ||
    nichoNorm.includes('direit') ||
    nichoNorm.includes('jurid') ||
    nichoNorm.includes('juríd')
  ) {
    templateEscolhido = TEMPLATES_FUNIS.find((t) => t.id === 'direito_juridico')!;
  } else if (
    nichoNorm.includes('imob') ||
    nichoNorm.includes('corret') ||
    nichoNorm.includes('imovel') ||
    nichoNorm.includes('imóvel')
  ) {
    templateEscolhido = TEMPLATES_FUNIS.find((t) => t.id === 'imobiliario_corretagem')!;
  }

  const nomePipeline = ehAgencia
    ? 'Prospecção Agência'
    : `Funil de Vendas (${nomeCliente || 'Cliente'})`;

  const descricao = ehAgencia
    ? 'Funil comercial de novos clientes da agência GENS'
    : `Funil padrão para ${nomeCliente || 'cliente'} (${templateEscolhido.nome})`;

  const insertOp = (supabase.from('crm_pipelines') as any).insert({
    agencia_id: agenciaId,
    cliente_id: clienteId || null,
    nome: nomePipeline,
    descricao,
    ordem: 0,
    padrao: true,
    ativo: true,
  });

  const { data: novoPipe, error: pipeErr } = typeof insertOp?.select === 'function'
    ? await insertOp.select().single()
    : { data: { id: 'pipe-padrao', nome: nomePipeline }, error: null };

  if (pipeErr || !novoPipe) {
    console.error('Erro ao provisionar pipeline padrão:', pipeErr);
    return null;
  }

  // 3. Cria as etapas baseadas no template selecionado
  const payloadEstagios = templateEscolhido.estagios.map((e) => ({
    pipeline_id: novoPipe.id,
    ...e,
  }));

  const insertEstagiosOp = (supabase.from('crm_estagios') as any).insert(payloadEstagios);
  const { data: estagiosCriados } = typeof insertEstagiosOp?.select === 'function'
    ? await insertEstagiosOp.select().order('ordem', { ascending: true })
    : { data: payloadEstagios.map((e, idx) => ({ id: `estagio-${idx}`, ...e })) };

  return {
    ...novoPipe,
    estagios: estagiosCriados || [],
  };
}

/**
 * Sincroniza um contato capturado por automação do Instagram com o funil do CRM daquele cliente.
 * - Localiza o cliente vinculado à conta do Instagram.
 * - Garante que o pipeline padrão do cliente exista.
 * - Se não houver oportunidade aberta para o contato, cria um novo card na etapa inicial.
 * - Se já houver, atualiza e registra a atividade.
 * - Vincula o negócio à sessão da IA para acompanhamento automático das etapas.
 */
export async function sincronizarContatoComCrm({
  instagramUserId,
  contactId,
  username,
  nome,
  telefone,
  email,
  origem = 'instagram',
  tags = [],
  automacaoNome,
}: {
  instagramUserId: string;
  contactId: string;
  username?: string | null;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  origem?: string;
  tags?: string[];
  automacaoNome?: string | null;
}): Promise<string | null> {
  try {
    // 1. Identifica a conta de Instagram e o cliente vinculado
    const { data: igAcc } = await supabase
      .from('instagram_accounts')
      .select('id, user_id, instagram_username')
      .eq('instagram_user_id', instagramUserId)
      .maybeSingle();

    if (!igAcc) return null;

    const { data: cli } = await supabase
      .from('clientes')
      .select('id, agencia_id, nome')
      .eq('instagram_account_id', igAcc.id)
      .maybeSingle();

    const agenciaId = cli?.agencia_id || 'a6839f40-dc25-4c00-a662-8d90c100b8c2';
    const clienteId = cli?.id || null;

    // 2. Garante o pipeline padrão para o cliente (ou agência)
    const pipe = await garantirPipelinePadrao(agenciaId, clienteId, cli?.nome);
    if (!pipe || !pipe.estagios || pipe.estagios.length === 0) return null;

    const estagioInicialId = pipe.estagios[0].id;
    const nomeLead = (nome || (username ? `@${username}` : 'Lead Instagram')).trim();
    const tel = telefone ? String(telefone).replace(/\D/g, '') : null;

    // 3. Verifica se já existe sessão de IA com negócio vinculado para este contato
    const { data: sessao } = await supabase
      .from('ai_contact_sessions')
      .select('id, negocio_id')
      .eq('instagram_user_id', instagramUserId)
      .eq('contact_id', contactId)
      .maybeSingle();

    if (sessao?.negocio_id) {
      // Atualiza o negócio existente
      await supabase
        .from('crm_negocios')
        .update({
          nome_contato: nomeLead,
          ...(tel ? { telefone: tel } : {}),
          ...(email ? { email } : {}),
          ...(username ? { instagram_username: username } : {}),
          ultimo_contato_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', sessao.negocio_id);

      await supabase.from('crm_atividades').insert({
        negocio_id: sessao.negocio_id,
        agencia_id: agenciaId,
        tipo: 'nota',
        descricao: `📥 Dados capturados via automação "${automacaoNome || 'Instagram'}": ${[
          tel ? `Tel: ${tel}` : null,
          email ? `E-mail: ${email}` : null,
        ].filter(Boolean).join(' | ')}`,
      });

      return sessao.negocio_id;
    }

    // 4. Cria nova oportunidade no funil daquele cliente
    const tagsFinais = Array.from(
      new Set([
        'Automação Instagram',
        ...(automacaoNome ? [automacaoNome] : []),
        ...tags,
      ])
    );

    const insertNegOp = (supabase.from('crm_negocios') as any).insert({
      agencia_id: agenciaId,
      cliente_id: clienteId,
      pipeline_id: pipe.id,
      estagio_id: estagioInicialId,
      titulo: `${nomeLead} (Automação)`,
      valor: 0,
      status: 'aberto',
      nome_contato: nomeLead,
      telefone: tel,
      email: email || null,
      instagram_username: username || null,
      origem,
      tags: tagsFinais,
      ultimo_contato_em: new Date().toISOString(),
    });

    const { data: novoNeg, error: negErr } = typeof insertNegOp?.select === 'function'
      ? await insertNegOp.select('id').single()
      : { data: { id: 'neg-padrao' }, error: null };

    if (negErr || !novoNeg) {
      console.error('Erro ao criar negócio no CRM via automação:', negErr);
      return null;
    }

    // 5. Registra na sessão da IA para acompanhamento contínuo
    const sessionTable = supabase.from('ai_contact_sessions') as any;
    if (typeof sessionTable?.upsert === 'function') {
      await sessionTable.upsert(
        {
          agencia_id: agenciaId,
          instagram_user_id: instagramUserId,
          contact_id: contactId,
          cliente_id: clienteId,
          negocio_id: novoNeg.id,
          modo: 'ia',
          dados_extraidos: {
            nome: nomeLead,
            telefone: tel,
            email,
            username,
          },
          ultima_interacao_ia: new Date().toISOString(),
        },
        { onConflict: 'instagram_user_id,contact_id' }
      );
    }

    // 6. Registra atividade de criação
    await supabase.from('crm_atividades').insert({
      negocio_id: novoNeg.id,
      agencia_id: agenciaId,
      tipo: 'criacao',
      descricao: `⚡ Oportunidade gerada pela automação "${automacaoNome || 'Instagram'}" e alocada no funil do cliente.`,
    });

    return novoNeg.id;
  } catch (err) {
    console.error('Erro ao sincronizar contato com CRM:', err);
    return null;
  }
}

