import type { ModeloDocumento, TipoDocumento, VariavelDocumento } from '@/types/documentos';

export const VARIAVEIS_DISPONIVEIS: VariavelDocumento[] = [
  { chave: 'agencia_nome', label: 'Nome da Agência', exemplo: 'GENS Agência Digital' },
  { chave: 'agencia_razao_social', label: 'Razão Social da Agência', exemplo: 'GENS Soluções Criativas LTDA' },
  { chave: 'agencia_cnpj', label: 'CNPJ da Agência', exemplo: '00.000.000/0001-00' },
  { chave: 'agencia_endereco', label: 'Endereço da Agência', exemplo: 'Av. Paulista, 1000 - Bela Vista' },
  { chave: 'agencia_cidade_estado', label: 'Cidade/UF da Agência', exemplo: 'São Paulo - SP' },
  { chave: 'agencia_email', label: 'E-mail da Agência', exemplo: 'contato@gens.com.br' },
  { chave: 'agencia_telefone', label: 'Telefone da Agência', exemplo: '(11) 99999-9999' },
  { chave: 'agencia_pix', label: 'Chave PIX da Agência', exemplo: 'financeiro@gens.com.br' },
  { chave: 'cliente_nome', label: 'Nome do Cliente / Empresa', exemplo: 'Empresa Exemplo LTDA' },
  { chave: 'cliente_doc', label: 'CNPJ ou CPF do Cliente', exemplo: '12.345.678/0001-90' },
  { chave: 'cliente_responsavel', label: 'Responsável pelo Cliente', exemplo: 'João Silva' },
  { chave: 'cliente_endereco', label: 'Endereço do Cliente', exemplo: 'Rua das Flores, 123' },
  { chave: 'cliente_email', label: 'E-mail do Cliente', exemplo: 'joao@empresa.com.br' },
  { chave: 'cliente_telefone', label: 'Telefone do Cliente', exemplo: '(11) 98888-8888' },
  { chave: 'valor_mensal', label: 'Valor Mensal (Fee)', exemplo: 'R$ 2.500,00' },
  { chave: 'valor_setup', label: 'Valor de Implantação / Setup', exemplo: 'R$ 1.000,00' },
  { chave: 'dia_vencimento', label: 'Dia do Vencimento', exemplo: '10' },
  { chave: 'data_inicio', label: 'Data de Início', exemplo: '01/12/2026' },
  { chave: 'data_termino', label: 'Data de Término', exemplo: '01/12/2027' },
  { chave: 'vigencia', label: 'Vigência do Contrato', exemplo: '12 meses' },
  { chave: 'validade_proposta', label: 'Validade da Proposta', exemplo: '15 dias' },
  { chave: 'data_hoje', label: 'Data Atual', exemplo: '05/11/2026' },
];

/** Substitui variáveis do tipo {{chave}} pelo valor fornecido */
export function interpolarVariaveis(
  template: string,
  dados: Record<string, string | number | null | undefined>
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = dados[key];
    if (val === undefined || val === null || val === '') {
      return `[${key}]`;
    }
    return String(val);
  });
}

/** Gera um token seguro de 32 caracteres para visualização pública */
export function gerarTokenPublico(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    token = Array.from(arr, (b) => chars[b % chars.length]).join('');
  } else {
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return token;
}

// -------------------------------------------------------------
// 11 MODELOS PADRÃO DE PROPOSTA
// -------------------------------------------------------------
export const MODELOS_PROPOSTAS_PADRAO: Omit<ModeloDocumento, 'id'>[] = [
  {
    tipo: 'proposta',
    categoria: 'social_media',
    titulo: 'Proposta Comercial - Gestão de Redes Sociais',
    descricao: 'Estratégia completa de posicionamento, design, reels e gestão de comunidade no Instagram e TikTok.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Gestão Estratégica de Redes Sociais</h1>
  <p><strong>Apresentado para:</strong> {{cliente_nome}} (A/C {{cliente_responsavel}})</p>
  <p><strong>Elaborado por:</strong> {{agencia_nome}} | Data: {{data_hoje}} | Validade: {{validade_proposta}}</p>
  
  <hr />

  <h2>1. Diagnóstico e Objetivo</h2>
  <p>Identificamos a oportunidade de transformar os canais digitais da <strong>{{cliente_nome}}</strong> em fontes consistentes de autoridade, engajamento e geração de novas oportunidades de negócios através de conteúdo de alto valor percebido e alinhamento visual moderno.</p>

  <h2>2. Escopo dos Serviços Mensais</h2>
  <ul>
    <li><strong>Planejamento Editorial:</strong> Matriz de conteúdo mensal com linhas editoriais focadas em topo, meio e fundo de funil.</li>
    <li><strong>Volume de Publicações:</strong> 12 posts no feed (design carrossel / estático) + 8 Reels roteirizados e editados por mês.</li>
    <li><strong>Stories Semanais:</strong> Sequências estratégicas para conversão e engajamento 3x por semana.</li>
    <li><strong>Copywriting Persuasivo:</strong> Legendas orientadas a retenção, comentários e chamadas para ação (CTA).</li>
    <li><strong>Acompanhamento e SAC:</strong> Interação inicial com comentários e triagem no Direct.</li>
    <li><strong>Relatório Mensal de Performance:</strong> Reunião mensal com apresentação dos principais indicadores (alcance, taxa de engajamento, cliques e crescimento).</li>
  </ul>

  <h2>3. Fluxo de Trabalho e Prazos</h2>
  <p>Todo o conteúdo é produzido com antecedência de 7 a 10 dias úteis e submetido para validação direta pelo WhatsApp ou Portal do Cliente da {{agencia_nome}}, garantindo total controle e segurança para a {{cliente_nome}}.</p>

  <h2>4. Investimento e Condições</h2>
  <div class="quadro-investimento">
    <p><strong>Fee Mensal:</strong> {{valor_mensal}} / mês</p>
    <p><strong>Taxa de Setup e Onboarding:</strong> {{valor_setup}} (pagamento único)</p>
    <p><strong>Vencimento:</strong> Todo dia {{dia_vencimento}} de cada mês via boleto ou PIX ({{agencia_pix}}).</p>
    <p><strong>Vigência sugerida:</strong> {{vigencia}}.</p>
  </div>

  <h2>5. Próximos Passos</h2>
  <p>Ao aprovar esta proposta, nosso time entrará em contato imediatamente para agendar a reunião de Kickoff & Onboarding e início das gravações/roteiros.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'trafego_pago',
    titulo: 'Proposta Comercial - Gestão de Tráfego Pago & Performance',
    descricao: 'Gestão profissional de anúncios no Meta Ads (Instagram/Facebook) e Google Ads com foco em ROI e captação de leads.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Gestão de Tráfego Pago & Performance</h1>
  <p><strong>Cliente:</strong> {{cliente_nome}} | <strong>Agência:</strong> {{agencia_nome}} | <strong>Data:</strong> {{data_hoje}}</p>
  
  <hr />

  <h2>1. Objetivo da Campanha</h2>
  <p>Estruturar, otimizar e escalar campanhas de anúncios digitais para geração de leads qualificados, mensagens no WhatsApp e aquisição de clientes com o menor custo por aquisição (CPA) possível.</p>

  <h2>2. Escopo da Gestão de Tráfego</h2>
  <ul>
    <li>Configuração avançada de Business Manager, Pixel da Meta, Conversions API e Google Analytics 4.</li>
    <li>Pesquisa de público-alvo, segmentações comportamentais e criação de públicos personalizados/semelhantes (Lookalike).</li>
    <li>Criação de copys para anúncios e testes A/B contínuos de criativos.</li>
    <li>Otimização diária de orçamento, lances e distribuição entre campanhas de topo, meio e remarketing.</li>
    <li>Dashboard de métricas em tempo real para acompanhamento de leads, CPL e investimento.</li>
  </ul>

  <h2>3. Investimento</h2>
  <div class="quadro-investimento">
    <p><strong>Honorários da Gestão (Fee Mensal):</strong> {{valor_mensal}}</p>
    <p><strong>Setup e Auditoria Técnica:</strong> {{valor_setup}}</p>
    <p><em>*O orçamento de mídia veiculado nas plataformas é pago diretamente pelo cliente às plataformas de anúncios (Meta / Google).</em></p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'combo',
    titulo: 'Proposta Comercial - Combo Redes Sociais + Tráfego Pago',
    descricao: 'Acelerador completo: produção de conteúdo de alta autoridade combinada com distribuição paga inteligente.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Integrada: Social Media + Tráfego Pago de Performance</h1>
  <p><strong>Para:</strong> {{cliente_nome}} | <strong>Validade:</strong> {{validade_proposta}} | <strong>Data:</strong> {{data_hoje}}</p>
  
  <hr />

  <h2>1. Visão Estratégica</h2>
  <p>Conteúdo orgânico constrói autoridade e relacionamento; o tráfego pago traz escala e velocidade. O combo une o melhor dos dois mundos para maximizar as conversões da <strong>{{cliente_nome}}</strong>.</p>

  <h2>2. Entregáveis Inclusos</h2>
  <ul>
    <li>16 peças de conteúdo mensal no feed e Reels (design + edição profissional de vídeo).</li>
    <li>Roteirização completa de vídeos curtos orientados a conversão.</li>
    <li>Gestão e execução de campanhas de tráfego pago no Meta Ads (Instagram/Facebook).</li>
    <li>Testes de criativos com as melhores publicações orgânicas como dark posts.</li>
    <li>Reunião quinzenal de alinhamento e reporte consolidado de resultados.</li>
  </ul>

  <h2>3. Investimento Mensal</h2>
  <div class="quadro-investimento">
    <p><strong>Investimento Total:</strong> {{valor_mensal}} / mês</p>
    <p><strong>Setup Inicial de Contas:</strong> {{valor_setup}}</p>
    <p><strong>Vencimento:</strong> Todo dia {{dia_vencimento}}.</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'marketing_360',
    titulo: 'Proposta Comercial - Marketing 360 Full Service',
    descricao: 'Assessoria completa de marketing: branding, redes sociais, performance, landing pages, CRM e automações.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Marketing 360 Full Service</h1>
  <p><strong>Cliente:</strong> {{cliente_nome}} | <strong>Responsável:</strong> {{cliente_responsavel}}</p>
  <p><strong>Agência:</strong> {{agencia_nome}} | <strong>Data:</strong> {{data_hoje}}</p>
  
  <hr />

  <h2>1. Escopo Abrangente 360</h2>
  <ul>
    <li><strong>Gestão de Mídias Sociais:</strong> Produção diária de conteúdo, design e vídeo em múltiplos canais.</li>
    <li><strong>Tráfego Pago & Mídia de Performance:</strong> Meta Ads, Google Ads e remarketing omnichannel.</li>
    <li><strong>Automações de Vendas & CRM:</strong> Estruturação de fluxos conversacionais automáticos no WhatsApp e Instagram.</li>
    <li><strong>Design Gráfico & Suporte Institucional:</strong> Criação de materiais institucionais, apresentações e criativos sob demanda.</li>
    <li><strong>Consultoria Estratégica Quinzenal:</strong> Direção criativa e alinhamento de metas comerciais.</li>
  </ul>

  <h2>2. Investimento e Contrato</h2>
  <div class="quadro-investimento">
    <p><strong>Fee Mensal Full Service:</strong> {{valor_mensal}} / mês</p>
    <p><strong>Setup e Integração Tecnológica:</strong> {{valor_setup}}</p>
    <p><strong>Vigência:</strong> {{vigencia}}.</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'conteudo',
    titulo: 'Proposta Comercial - Produção de Conteúdo & Copywriting',
    descricao: 'Redação estratégica, roteiros envolventes para Reels, carrosséis educativos e newsletters.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Produção de Conteúdo & Copywriting Estratégico</h1>
  <p><strong>Apresentado a:</strong> {{cliente_nome}} | <strong>Data:</strong> {{data_hoje}}</p>
  
  <hr />

  <h2>1. Objetivo</h2>
  <p>Posicionar a <strong>{{cliente_nome}}</strong> como referência absoluta em seu segmento através de narrativas convincentes, copywriting de conversão e didática moderna.</p>

  <h2>2. Entregáveis</h2>
  <ul>
    <li>Pesquisa e elaboração de 12 roteiros detalhados para Reels/TikTok com ganchos de alta retenção.</li>
    <li>Redação de 8 carrosséis técnicos com títulos magnéticos.</li>
    <li>2 Newsletters ou artigos de blog para retenção e autoridade de marca.</li>
  </ul>

  <h2>3. Investimento</h2>
  <div class="quadro-investimento">
    <p><strong>Valor Mensal:</strong> {{valor_mensal}}</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'audiovisual',
    titulo: 'Proposta Comercial - Produção Audiovisual & Captação',
    descricao: 'Diárias de captação presencial com câmera profissional, iluminação de cinema e edição dinâmica de Reels.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta de Produção Audiovisual & Captação</h1>
  <p><strong>Cliente:</strong> {{cliente_nome}} | <strong>Agência:</strong> {{agencia_nome}}</p>
  
  <hr />

  <h2>1. Escopo de Produção</h2>
  <ul>
    <li>1 a 2 diárias de captação presencial no local com equipamentos 4K, microfone sem fio e iluminação profissional.</li>
    <li>Direção de cena e auxílio ao apresentador na dicção e desenvoltura em frente à câmera.</li>
    <li>Edição dinâmica com legendas animadas, trilha sonora licenciada, sound design e correção de cores.</li>
    <li>Entrega de 15 a 20 vídeos finalizados em formato vertical 9:16.</li>
  </ul>

  <h2>2. Investimento</h2>
  <div class="quadro-investimento">
    <p><strong>Valor por Diária / Mensal:</strong> {{valor_mensal}}</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'branding',
    titulo: 'Proposta Comercial - Identidade Visual & Branding',
    descricao: 'Construção completa de marca: logotipo, paleta cromática, tipografia, aplicações e manual de identidade visual.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Identidade Visual & Branding</h1>
  <p><strong>Cliente:</strong> {{cliente_nome}} | <strong>Elaborado por:</strong> {{agencia_nome}}</p>
  
  <hr />

  <h2>1. Etapas do Projeto</h2>
  <ol>
    <li><strong>Briefing e Imersão:</strong> Alinhamento de essência, atributos de marca e público desejado.</li>
    <li><strong>Conceituação & Moodboard:</strong> Apresentação de direção visual e universo de marca.</li>
    <li><strong>Desenvolvimento:</strong> Símbolo, tipografia institucional, paleta de cores primária e secundária.</li>
    <li><strong>Aplicações Práticas:</strong> Mockups de papelaria, uniformes, sacolas, cartões e redes sociais.</li>
    <li><strong>Entrega Final:</strong> Manual de Marca completo em PDF e arquivos vetorizados (AI, SVG, PDF, PNG).</li>
  </ol>

  <h2>2. Investimento e Prazos</h2>
  <div class="quadro-investimento">
    <p><strong>Investimento Total:</strong> {{valor_setup}} (parcelado em até 3x)</p>
    <p><strong>Prazo de Execução:</strong> 20 a 30 dias úteis.</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'sites',
    titulo: 'Proposta Comercial - Landing Page de Alta Conversão & Site Institucional',
    descricao: 'Desenvolvimento de página rápida, moderna, responsiva, com copywriting focado em conversão e integrações.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Landing Page de Alta Conversão</h1>
  <p><strong>Para:</strong> {{cliente_nome}} | <strong>Agência:</strong> {{agencia_nome}}</p>
  
  <hr />

  <h2>1. Entregáveis do Projeto</h2>
  <ul>
    <li>Design UI/UX exclusivo e responsivo para celulares e computadores.</li>
    <li>Copywriting persuasivo focado em destacar os diferenciais da {{cliente_nome}}.</li>
    <li>Integração direta com WhatsApp, CRM, Meta Pixel e Google Analytics.</li>
    <li>Otimização de velocidade de carregamento (Core Web Vitals).</li>
    <li>Certificado de segurança SSL e formulário de captação de leads.</li>
  </ul>

  <h2>2. Investimento</h2>
  <div class="quadro-investimento">
    <p><strong>Valor do Projeto:</strong> {{valor_setup}}</p>
    <p><strong>Manutenção Opcional:</strong> {{valor_mensal}} / mês</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'consultoria',
    titulo: 'Proposta Comercial - Consultoria & Diagnóstico Estratégico',
    descricao: 'Auditoria de posicionamento digital, funil de vendas e treinamento de equipe interna.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Consultoria Estratégica de Marketing</h1>
  <p><strong>Cliente:</strong> {{cliente_nome}} | <strong>Validade:</strong> {{validade_proposta}}</p>
  
  <hr />

  <h2>1. Metodologia da Consultoria</h2>
  <ul>
    <li>4 sessões de alinhamento estratégico online via Google Meet com duração de 1h30 cada.</li>
    <li>Diagnóstico aprofundado dos canais atuais e dos concorrentes diretos.</li>
    <li>Desenho de plano de ação tático para os próximos 6 meses com metas e KPIs claros.</li>
    <li>Suporte via WhatsApp ao longo de todo o período de acompanhamento.</li>
  </ul>

  <h2>2. Investimento</h2>
  <div class="quadro-investimento">
    <p><strong>Investimento Total:</strong> {{valor_setup}}</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'combo',
    titulo: 'Proposta Comercial - Lançamento Digital & Infoprodutos',
    descricao: 'Estratégia completa para lançamentos semente ou clássicos: funil de captura, CPLs, tráfego pago e automação.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Estratégia de Lançamento Digital</h1>
  <p><strong>Expert / Produto:</strong> {{cliente_nome}} | <strong>Agência:</strong> {{agencia_nome}}</p>
  
  <hr />

  <h2>1. Escopo da Operação de Lançamento</h2>
  <ul>
    <li>Desenho do funil de captura de leads e grupos VIP de WhatsApp.</li>
    <li>Copywriting para páginas de captura, obrigado e vendas.</li>
    <li>Gestão de tráfego de distribuição de conteúdo, captura, lembretes de aula e remarketing.</li>
    <li>Automações de disparo de e-mails e mensagens instantâneas.</li>
    <li>Acompanhamento da abertura de carrinho e suporte comercial.</li>
  </ul>

  <h2>2. Condições Comerciais</h2>
  <div class="quadro-investimento">
    <p><strong>Fixo de Operação:</strong> {{valor_setup}}</p>
    <p><strong>Participação no Resultado (Revenue Share):</strong> 15% do faturamento líquido do lançamento.</p>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'proposta',
    categoria: 'social_media',
    titulo: 'Proposta Comercial - Gestão de Comunidade & Atendimento 2.0',
    descricao: 'Monitoramento contínuo de Direct e comentários com resposta rápida, acolhimento e qualificação de clientes.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="proposta-container">
  <h1>Proposta Comercial: Gestão de Comunidade & SAC 2.0</h1>
  <p><strong>Cliente:</strong> {{cliente_nome}} | <strong>Agência:</strong> {{agencia_nome}}</p>
  
  <hr />

  <h2>1. Objetivo</h2>
  <p>Reduzir o tempo de resposta nas redes sociais para menos de 15 minutos em horário comercial, transformando seguidores interessados em clientes atendidos e satisfeitos.</p>

  <h2>2. Escopo</h2>
  <ul>
    <li>Respostas humanizadas a todos os comentários de posts orgânicos e anúncios pagos.</li>
    <li>Triagem e qualificação de leads no Direct com encaminhamento direto para o WhatsApp de vendas.</li>
    <li>Relatório semanal de dúvidas frequentes e feedbacks dos consumidores.</li>
  </ul>

  <h2>3. Investimento</h2>
  <div class="quadro-investimento">
    <p><strong>Fee Mensal:</strong> {{valor_mensal}} / mês</p>
  </div>
</div>
    `.trim(),
  },
];

// -------------------------------------------------------------
// 9 MODELOS PADRÃO DE CONTRATO
// -------------------------------------------------------------
export const MODELOS_CONTRATOS_PADRAO: Omit<ModeloDocumento, 'id'>[] = [
  {
    tipo: 'contrato',
    categoria: 'social_media',
    titulo: 'Contrato de Prestação de Serviços de Marketing Digital e Mídias Sociais',
    descricao: 'Contrato jurídico oficial da Agência GENS: 12 cláusulas, escopo de 12 posts/mês, postagens de urgência, aprovação tácita de 2 dias úteis, KPIs, salvaguardas e horário de atendimento.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <div class="contrato-header" style="text-align: center; margin-bottom: 24px;">
    <h1 style="font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 6px;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE MARKETING DIGITAL</h1>
    <p style="font-size: 0.85rem; color: #64748b; margin-top: 0;">Instrumento Particular de Prestação de Serviços e Gestão Estratégica de Conteúdo</p>
  </div>
  
  <p>Pelo presente instrumento particular de prestação de serviços, as partes abaixo qualificadas firmam o presente contrato, mediante as cláusulas e condições a seguir estipuladas:</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 1 — DAS PARTES</h3>
  <p><strong>1.1. CONTRATANTE:</strong> <strong>{{cliente_nome}}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº <strong>{{cliente_doc}}</strong>, com sede em {{cliente_endereco}}, neste ato representada por seu sócio-administrador, <strong>{{cliente_responsavel}}</strong>, doravante denominada simplesmente <strong>CONTRATANTE</strong>.</p>
  <p><strong>1.2. CONTRATADA:</strong> <strong>AGÊNCIA GENS</strong>, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº <strong>55.823.814/0001-18</strong>, com sede na Rua José Vicente da Cunha Gouveia, 152, Monteiro - PB, neste ato representada por seus sócios-administradores, <strong>Ewerton Phillipe Monteiro de Sousa</strong> e <strong>João Vitor Alves de Queiróz</strong>, doravante denominada simplesmente <strong>AGÊNCIA</strong>.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 2 — DO OBJETO</h3>
  <p><strong>2.1.</strong> O presente contrato tem por objeto a prestação de serviços de Marketing Digital e Gestão de Mídias Sociais pela <strong>CONTRATADA</strong> à <strong>CONTRATANTE</strong>, visando o posicionamento estratégico e a criação de conteúdo para redes sociais.</p>
  <p><strong>2.2.</strong> Os serviços contratados englobam especificamente:</p>
  <ul>
    <li>Planejamento estratégico de marketing digital e matriz de conteúdo;</li>
    <li>Criação de peças gráficas (design) e redação de legendas estratégicas (copywriting);</li>
    <li>Agendamento e publicação de conteúdos nas redes sociais acordadas;</li>
    <li>Produção de vídeos, Reels e demais formatos audiovisuais conforme pacote contratado.</li>
  </ul>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 3 — ESCOPO MENSAL DE ENTREGAS E PRODUÇÕES</h3>
  <p><strong>3.1.</strong> As entregas mensais da <strong>CONTRATADA</strong> estão definidas conforme o pacote contratado, ficando estabelecido o seguinte escopo:</p>
  
  <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 16px 0;">
    <table style="width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.85rem;">
      <thead>
        <tr style="background: rgba(255, 255, 255, 0.05); text-align: left;">
          <th style="padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.12); font-weight: 700;">Entregável</th>
          <th style="padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.12); font-weight: 700;">Quantidade Mensal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Postagens regulares (posts estáticos / carrossel)</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); font-weight: 600;">12 por mês (3 postagens por semana)</td>
        </tr>
        <tr>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Postagens de urgência (comunicados de última hora, ex.: manutenção programada, instabilidade na rede, aviso de retorno do serviço)</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); font-weight: 600;">1 por mês, contabilizadas à parte das postagens regulares</td>
        </tr>
        <tr>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Reunião de alinhamento periódico</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); font-weight: 600;">1 reunião a cada 3 meses</td>
        </tr>
        <tr>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Relatório de desempenho e métricas</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); font-weight: 600;">1 relatório / mês</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="background: rgba(34, 197, 94, 0.08); border-left: 3px solid #22c55e; padding: 12px 14px; margin: 14px 0; border-radius: 6px; font-size: 0.85rem;">
    <strong>Atenção:</strong> Os vídeos/carrosséis serão flexíveis de acordo com o tempo disponível da <strong>CONTRATANTE</strong> para gravação. Caso naquele mês seja possível gravar 8 Reels, serão feitos os 8 Reels; caso seja possível gravar apenas 4, o restante será convertido em carrosséis. A recomendação da <strong>AGÊNCIA</strong> é de um post carrossel e um Reels por semana.
  </div>

  <p><strong>3.2.</strong> As postagens de urgência atendem a fatos relevantes e datados (como avisos de manutenção ou comunicados prioritários) e são produzidas e publicadas no mesmo dia sempre que possível, dada a natureza do assunto, respeitado o horário de atendimento previsto na Cláusula 9.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 4 — DO PROCESSO DE CRIAÇÃO E FLUXO DE TRABALHO</h3>
  <p><strong>4.1. Briefing e Alinhamento:</strong> O processo se inicia com uma reunião de alinhamento (briefing) onde a <strong>CONTRATANTE</strong> deverá fornecer todas as informações, diretrizes de marca, logotipos em alta resolução, planos e preços vigentes e objetivos da campanha.</p>
  <p><strong>4.2. Criação das Peças:</strong> A <strong>CONTRATADA</strong> desenvolverá as peças gráficas e os textos baseados no cronograma mensal aprovado. Cada peça passará pelas etapas de pesquisa, layout e redação publicitária (copywriting), e será submetida para aprovação via plataforma digital acordada (WhatsApp ou sistema de aprovação da agência).</p>
  <p><strong>4.3. Aprovação e Prazo Tácito:</strong> A <strong>CONTRATANTE</strong> terá prazo de até <strong>02 (dois) dias úteis</strong> para solicitar alterações ou aprovar o material enviado, exceto nas postagens de urgência tratadas na Cláusula 3.2, cujo prazo de aprovação será reduzido em função da natureza do assunto. A ausência de resposta no prazo aplicável será considerada como aprovação tácita para cumprimento do cronograma de postagens.</p>
  <p><strong>4.4. Audiovisual:</strong> Para produções audiovisuais (Reels e vídeos), o processo inclui: roteiro, captação, edição básica com legenda e trilha sonora livre de direitos. Edições avançadas (motion graphics, vinhetas personalizadas, animações 3D) são cobradas separadamente.</p>
  <p><strong>4.5. Veracidade Comercial:</strong> As informações comerciais divulgadas nas peças (planos, velocidades, preços, condições de promoção e cobertura) são de responsabilidade da <strong>CONTRATANTE</strong>, cabendo a ela conferi-las na etapa de aprovação.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 5 — DAS METAS E INDICADORES DE DESEMPENHO (KPIs)</h3>
  <p><strong>5.1.</strong> As metas e KPIs são indicadores de referência para acompanhamento da estratégia digital, e não representam garantia de resultado financeiro ou comercial. Os valores abaixo são estimativas baseadas no histórico do mercado:</p>
  
  <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 16px 0;">
    <table style="width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.85rem;">
      <thead>
        <tr style="background: rgba(255, 255, 255, 0.05); text-align: left;">
          <th style="padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.12); font-weight: 700;">Indicador (KPI)</th>
          <th style="padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.12); font-weight: 700;">Plataforma</th>
          <th style="padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.12); font-weight: 700;">Meta Mensal de Referência</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Crescimento de seguidores qualificados</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Instagram</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); font-weight: 600;">50 / mês</td>
        </tr>
        <tr>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Alcance orgânico estimado</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08);">Instagram</td>
          <td style="padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); font-weight: 600;">5.000 semanal</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p><strong>5.2. Plano de Correção:</strong> Em caso de queda de resultados no Instagram ou demais plataformas, a <strong>CONTRATADA</strong> se compromete a: identificar as causas da queda (mudança de algoritmo, sazonalidade, qualidade do conteúdo); realizar reunião extraordinária de alinhamento para ajuste de estratégia, sem custo adicional; e ajustar o calendário editorial como medida corretiva.</p>
  <p><strong>5.3. Exclusões de Responsabilidade:</strong> A <strong>CONTRATADA</strong> NÃO se responsabiliza por quedas de desempenho causadas por: alterações nos algoritmos das plataformas, restrições ou bloqueios impostos pelo próprio Instagram/Facebook/Google, crises de imagem da marca (incluindo as decorrentes de falhas na prestação do serviço da CONTRATANTE) ou sazonalidade natural do mercado.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 6 — DOS PRAZOS E VIGÊNCIA</h3>
  <p><strong>6.1.</strong> O presente contrato tem vigência estipulada em <strong>{{vigencia}}</strong>, com início em <strong>{{data_inicio}}</strong> e término em <strong>{{data_termino}}</strong>, podendo ser renovado mediante acordo entre as partes.</p>
  <p><strong>6.2.</strong> O prazo para início das publicações é de até <strong>5 (cinco) dias úteis</strong> após a realização da reunião de briefing e entrega de todos os acessos e materiais necessários pela <strong>CONTRATANTE</strong>.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 7 — DO PAGAMENTO</h3>
  <p><strong>7.1.</strong> Pelos serviços prestados, a <strong>CONTRATANTE</strong> pagará à <strong>CONTRATADA</strong> o valor mensal de <strong>{{valor_mensal}}</strong>.</p>
  <p><strong>7.2.</strong> O pagamento deverá ser efetuado todo dia <strong>{{dia_vencimento}}</strong> de cada mês, através de Pix (Chave: <strong>{{agencia_pix}}</strong>), boleto bancário ou transferência.</p>
  <p><strong>7.3.</strong> O não pagamento na data prevista acarretará multa de 2% (dois por cento) sobre o valor devido, acrescido de juros de mora de 1% (um por cento) ao mês.</p>
  <p><strong>7.4.</strong> Em caso de atraso superior a 15 (quinze) dias, a <strong>CONTRATADA</strong> reserva-se o direito de suspender imediatamente a prestação dos serviços até a regularização integral do débito.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 8 — DA SEGURANÇA DA INFORMAÇÃO E RESPONSABILIDADES</h3>
  <p><strong>8.1. Segurança de Acessos:</strong> A <strong>CONTRATADA</strong> compromete-se a manter o sigilo das senhas e acessos fornecidos pela <strong>CONTRATANTE</strong>, utilizando-os exclusivamente para os fins deste contrato.</p>
  <p><strong>8.2. Isenção sobre Incidentes e Plataformas:</strong> A <strong>CONTRATADA NÃO SE RESPONSABILIZA</strong>, sob nenhuma hipótese e a nenhum título — civil, criminal, administrativo ou financeiro —, por invasões, hackeamentos, perda de contas, vazamento de dados, bloqueios permanentes ou temporários realizados pelas plataformas (Facebook, Instagram, Google, etc.) ou por terceiros mal-intencionados, nem por quaisquer danos, prejuízos, lucros cessantes ou perdas decorrentes de tais eventos.</p>
  <p><strong>8.3.</strong> Embora a <strong>CONTRATADA</strong> adote boas práticas de segurança digital, a segurança final da conta (autenticação de dois fatores - 2FA, segurança de e-mails vinculados e senhas fortes) é de responsabilidade integral e exclusiva da <strong>CONTRATANTE</strong>.</p>
  <p><strong>8.4. Apoio Consultivo:</strong> Em caso de incidentes de segurança, a <strong>CONTRATADA</strong> poderá prestar apoio meramente consultivo e orientativo para auxiliar a CONTRATANTE nos processos de recuperação junto às plataformas, dentro do horário de expediente, sem que isso represente obrigação de resultado.</p>
  <p><strong>8.5. Fornecimento de Credenciais:</strong> A <strong>CONTRATANTE</strong> deverá fornecer à <strong>CONTRATADA</strong> os acessos administrativos necessários (Instagram, Facebook, Meta Business Suite) dentro de até <strong>02 (dois) dias úteis</strong> após a assinatura do contrato. A ausência de fornecimento suspende os prazos acordados.</p>
  <p><strong>8.6.</strong> A <strong>CONTRATANTE</strong> compromete-se a manter os acessos ativos durante toda a vigência e a comunicar imediatamente qualquer alteração de senha.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 9 — DO HORÁRIO DE ATENDIMENTO</h3>
  <p><strong>9.1.</strong> A <strong>CONTRATADA</strong> presta atendimento à <strong>CONTRATANTE</strong> das <strong>9h às 19h, de segunda a sábado</strong>, não havendo obrigação de atendimento, resposta ou execução de serviços fora desse horário, incluindo domingos e feriados.</p>
  <p><strong>9.2.</strong> As postagens de urgência tratadas na Cláusula 3.2 seguem igualmente restritas a esse horário de atendimento: demandas recebidas fora dele serão tratadas no próximo horário de expediente disponível.</p>
  <p><strong>9.3.</strong> O suporte consultivo mencionado na Cláusula 8.4 aplica-se igualmente a este horário de expediente.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 10 — DA RESCISÃO</h3>
  <p><strong>10.1.</strong> O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito de <strong>30 (trinta) dias</strong>.</p>
  <p><strong>10.2.</strong> Em caso de rescisão antecipada por parte da <strong>CONTRATANTE</strong> sem justa causa, os valores referentes ao mês em andamento permanecem devidos integralmente.</p>
  <p><strong>10.3.</strong> Peças em produção no momento da rescisão poderão ser entregues mediante o pagamento proporcional dos serviços já executados.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 11 — DAS DISPOSIÇÕES GERAIS</h3>
  <p><strong>11.1.</strong> Este contrato não gera qualquer vínculo empregatício entre as partes, tratando-se exclusivamente de prestação de serviços de natureza civil.</p>
  <p><strong>11.2.</strong> Alterações neste contrato somente serão válidas se realizadas por escrito e assinadas por ambas as partes.</p>
  <p><strong>11.3.</strong> A tolerância quanto ao descumprimento de qualquer cláusula não implicará novação ou renúncia de direitos.</p>

  <h3 style="margin-top: 24px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">CLÁUSULA 12 — DO FORO</h3>
  <p><strong>12.1.</strong> Fica eleito o foro da Comarca de <strong>Campina Grande - PB</strong> para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

  <p style="margin-top: 32px; text-align: center; font-size: 0.9rem; color: #94a3b8;">
    E, por estarem assim justas e contratadas, as partes firmam o presente instrumento por meio de assinatura digital eletrônica certificada.
  </p>
  
  <p style="text-align: center; font-weight: 600; margin-top: 12px;">Campina Grande/PB, {{data_hoje}}.</p>

  <div style="margin-top: 36px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.15); display: flex; flex-direction: column; gap: 18px;">
    <div>
      <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">CONTRATANTE:</p>
      <p style="margin: 2px 0 0 0; font-weight: 700;">{{cliente_nome}}</p>
      <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #64748b;">CNPJ/CPF: {{cliente_doc}}</p>
      <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #64748b;">Representante: {{cliente_responsavel}}</p>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 8px;">
      <div>
        <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">CONTRATADA (Sócio-Administrador):</p>
        <p style="margin: 2px 0 0 0; font-weight: 700;">Ewerton Phillipe Monteiro de Sousa</p>
        <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #64748b;">AGÊNCIA GENS — CNPJ: 55.823.814/0001-18</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 0.85rem; color: #94a3b8;">CONTRATADA (Sócio-Administrador):</p>
        <p style="margin: 2px 0 0 0; font-weight: 700;">João Vitor Alves de Queiróz</p>
        <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #64748b;">AGÊNCIA GENS — CNPJ: 55.823.814/0001-18</p>
      </div>
    </div>
  </div>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'trafego_pago',
    titulo: 'Contrato de Prestação de Serviços de Tráfego Pago & Performance',
    descricao: 'Contrato focado em compra de mídia e gestão de anúncios no Meta Ads e Google Ads, delimitando a verba de anúncio e as obrigações das plataformas.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE GESTÃO DE TRÁFEGO PAGO E MÍDIA DIGITAL</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>CLÁUSULA 1ª - OBJETO</h3>
  <p>1.1. O objeto do presente contrato é a prestação de serviços de gestão, criação técnica de campanhas, segmentação e otimização de anúncios em plataformas de mídia paga (Meta Ads e/ou Google Ads).</p>
  <h3>CLÁUSULA 2ª - DA VERBA DE ANÚNCIOS</h3>
  <p>2.1. O valor destinado à veiculação de anúncios (créditos das plataformas) é de inteira responsabilidade da CONTRATANTE, devendo ser quitado via cartão de crédito ou boleto diretamente às empresas veiculadoras.</p>
  <h3>CLÁUSULA 3ª - REMUNERAÇÃO</h3>
  <p>3.1. A CONTRATANTE pagará à CONTRATADA o fee mensal de <strong>{{valor_mensal}}</strong>, com vencimento todo dia <strong>{{dia_vencimento}}</strong>.</p>
  <h3>CLÁUSULA 4ª - VIGÊNCIA</h3>
  <p>4.1. O contrato tem vigência de <strong>{{vigencia}}</strong> contados a partir de <strong>{{data_inicio}}</strong>.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'combo',
    titulo: 'Contrato de Serviços Integrados (Social Media + Performance)',
    descricao: 'Contrato completo cobrindo planejamento de conteúdo, design, reels e compra de mídia digital.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE SERVIÇOS INTEGRADOS DE MARKETING DIGITAL</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>1. DO OBJETO INTEGRADO</h3>
  <p>Prestação conjunta dos serviços de gestão de mídias sociais (criação e postagens) e tráfego pago (campanhas e conversões).</p>
  <h3>2. HONORÁRIOS</h3>
  <p>Fee total fixo de <strong>{{valor_mensal}}</strong> mensal com vencimento dia <strong>{{dia_vencimento}}</strong>.</p>
  <h3>3. VIGÊNCIA</h3>
  <p>Vigência de <strong>{{vigencia}}</strong> iniciando em <strong>{{data_inicio}}</strong>.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'marketing_360',
    titulo: 'Contrato de Assessoria de Marketing Digital 360 Full Service',
    descricao: 'Contrato para clientes com pacote completo envolvendo múltiplos especialistas da agência e atendimento prioritário.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE ASSESSORIA DE MARKETING DIGITAL 360º</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>CLÁUSULA 1ª - DO ESCOPO FULL SERVICE</h3>
  <p>Engloba gestão de redes sociais, mídia paga, design sob demanda, direção criativa e reuniões estratégicas quinzenais.</p>
  <h3>CLÁUSULA 2ª - DOS HONORÁRIOS</h3>
  <p>Remuneração mensal de <strong>{{valor_mensal}}</strong> vencível a cada dia <strong>{{dia_vencimento}}</strong>.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'audiovisual',
    titulo: 'Contrato de Prestação de Serviços Audiovisuais e Captação de Vídeo',
    descricao: 'Contrato para diárias de filmagem, cessão de direitos de imagem de terceiros e pós-produção.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE PRODUÇÃO AUDIOVISUAL E CAPTAÇÃO DE IMAGENS</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>CLÁUSULA 1ª - ESCOPO</h3>
  <p>Gravação presencial de vídeos e materiais brutos, direção de cena e pós-produção digital.</p>
  <h3>CLÁUSULA 2ª - VALOR</h3>
  <p>Investimento pactuado em <strong>{{valor_mensal}}</strong>.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'branding',
    titulo: 'Contrato de Desenvolvimento de Identidade Visual e Branding',
    descricao: 'Contrato com prazos de rodadas de alteração, cessão patrimonial definitiva de direitos autorais do logotipo aprovado.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE DESENVOLVIMENTO DE IDENTIDADE VISUAL</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>1. DO PROJETO E APROVAÇÃO</h3>
  <p>Criação do projeto de identidade visual, contemplando até 2 (duas) rodadas de ajustes antes da entrega final dos vetores.</p>
  <h3>2. DO VALOR DO PROJETO</h3>
  <p>Valor total de <strong>{{valor_setup}}</strong> quitado conforme estipulado no cronograma financeiro.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'sites',
    titulo: 'Contrato de Desenvolvimento e Implantação de Landing Page / Site',
    descricao: 'Desenvolvimento web, homologação, prazos de entrega e responsabilidades de hospedagem e domínio.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE DESENVOLVIMENTO DE LANDING PAGE</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>1. ESCOPO</h3>
  <p>Desenvolvimento e publicação de página única na internet responsiva e integrada a ferramentas de conversão.</p>
  <h3>2. INVESTIMENTO</h3>
  <p>Valor de implantação de <strong>{{valor_setup}}</strong>.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'consultoria',
    titulo: 'Contrato de Consultoria Estratégica e Mentoria de Marketing',
    descricao: 'Contrato de prestação de consultoria com cronograma de encontros e termos de confidencialidade mútua.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE CONSULTORIA E ORIENTAÇÃO ESTRATÉGICA</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>1. DO SERVIÇO</h3>
  <p>Sessões de consultoria técnica e plano de diretrizes estratégicas para desenvolvimento de mercado.</p>
  <h3>2. HONORÁRIOS</h3>
  <p>Remuneração no valor de <strong>{{valor_setup}}</strong>.</p>
</div>
    `.trim(),
  },
  {
    tipo: 'contrato',
    categoria: 'combo',
    titulo: 'Contrato de Lançamento Digital e Co-produção',
    descricao: 'Contrato com regras de participação percentual em vendas líquidas (revenue share) e responsabilidade operacional.',
    padrao: true,
    variaveis: VARIAVEIS_DISPONIVEIS,
    conteudo_html: `
<div class="contrato-container">
  <h1 style="text-align: center;">CONTRATO DE ESTRATÉGIA DE LANÇAMENTO E PARCERIA DIGITAL</h1>
  <p><strong>CONTRATADA:</strong> {{agencia_razao_social}} (CNPJ: {{agencia_cnpj}})</p>
  <p><strong>CONTRATANTE:</strong> {{cliente_nome}} (CNPJ/CPF: {{cliente_doc}})</p>
  <hr />
  <h3>1. DA PARCERIA</h3>
  <p>Execução estratégica, tráfego e suporte comercial durante período de captação e lançamento digital.</p>
  <h3>2. DO VALOR E PERCENTUAIS</h3>
  <p>Custo operacional de <strong>{{valor_setup}}</strong> somado ao percentual acordado sobre o faturamento do carrinho.</p>
</div>
    `.trim(),
  },
];

/** Devolve os modelos padrão do sistema gerando IDs temporários consistentes */
export function obterModelosPadrao(tipo?: TipoDocumento): ModeloDocumento[] {
  const lista: ModeloDocumento[] = [];
  if (!tipo || tipo === 'proposta') {
    MODELOS_PROPOSTAS_PADRAO.forEach((m, idx) => {
      lista.push({
        ...m,
        id: `padrao-proposta-${idx + 1}`,
        agencia_id: null,
      });
    });
  }
  if (!tipo || tipo === 'contrato') {
    MODELOS_CONTRATOS_PADRAO.forEach((m, idx) => {
      lista.push({
        ...m,
        id: `padrao-contrato-${idx + 1}`,
        agencia_id: null,
      });
    });
  }
  return lista;
}
