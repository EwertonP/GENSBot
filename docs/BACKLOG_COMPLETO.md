# GENSBot: tudo o que falta fazer

Atualizado em 05/11/2026. Este é o documento-mestre do que ainda não foi feito, em ordem de prioridade, com o porquê, o que entregar, como construir e como saber que ficou pronto. Documentos de apoio: `AUDITORIA_MOBILE.md`, `ANALISE_ORKESTRYA.md` (referência de design e fluxo), `PLANO_PROXIMOS_PASSOS.md` (cronograma original) e `PLANO_ONBOARDING_CLIENTE.md` (link de conexão das redes).

**Regras de trabalho (valem para tudo abaixo)**
- Cada item entra no **celular e no desktop juntos**.
- Antes de começar, abrir uma branch nova a partir da `main` atualizada. Se um PR já estiver aberto, **não empurrar commit novo nele** sem avisar (isso já fez uma mudança ficar de fora do merge).
- Migrations do banco: escrever o arquivo em `supabase/migrations/`, aplicar só com autorização, e sempre aditivas (`create table if not exists`, `add column if not exists`).
- Todo item termina com: `tsc` limpo, testes passando (o `r2.test` já falhava antes e é ignorado), conferência na tela real depois do deploy e atualização deste documento.
- Verificação na tela: páginas de teste em `src/app/f/preview-*` com `fetch` simulado, sempre apagadas depois; produção só com login do usuário.

## Já entregue (para contexto)

Logo e ícone novos (fundo branco e versão escura), forma em pílula e `PageHeader`, dark mode em preto neutro, demanda aberta no layout do Orkestrya (editor rico, legenda com ferramentas, duas colunas, cartão escuro de ação, etiquetas, abas de comentários), tela de Demandas em largura total, Financeiro MVP (receitas, despesas, mensalidades dos clientes com projeção), botão Atualizar. Migrations aplicadas: `briefing_html`, `etiquetas`, `lancamentos`. Em PR aberto: cores das colunas do kanban (#217) e botão Atualizar (#218).

---

## 1. Correções da auditoria mobile (dívida mais antiga) — [Concluído em 05/11/2026]

**Entregue:**
- **CRM:** Eliminado overflow horizontal com `min-w-0 max-w-full` nos containers, `flex-wrap` no header, e unificação dos 3 seletores em `FilterBar` oficial (desktop inline, mobile Sheet com 44px de toque e badge de filtros ativos). Pipeline selector padronizado para 40px/44px.
- **Automação aberta:** Campo "Nome do Fluxo" com altura mínima de 44px (`h-11`); botão "Adicionar" empilhado no mobile evitando cortes; botões de controle responsivos com "Salvar Fluxo" em largura total no mobile; seletor de correspondência padronizado para `h-11 sm:h-10`; textarea da mensagem inicial expandido com `rows={4}` e `min-h-[110px]`.
- **Audiência e leads:** `DataTable` mobile agora omite automaticamente campos vazios (`isEmpty`); campo de busca e filtro de tags padronizados para `h-11 sm:h-9` (44px mobile / 36px desktop) com alinhamento do botão "Exportar CSV".
- **Automações (lista):** Cabeçalho responsivo com botão "Criar Novo Fluxo" full-width no mobile e sem quebra feia; nomes longos de fluxos com `flex-1 min-w-0 max-w-full` para não truncar precocemente.
- **Equipe:** Botões "Copiar Link de Convite" e "Cadastrar Membro" com largura total no mobile (`h-11`); ações do cartão padronizadas com `IconButton` (Editar, Ativar/Desativar, Excluir) garantindo mesmo peso visual, 40px/44px de toque e tooltips acessíveis; e-mails protegidos com `truncate`.
- **Placeholders e Skeletons:** Substituídos falsos "0 demandas" e "Selecione uma conta" por skeletons animados durante o carregamento inicial no Dashboard, Automações e Equipe.
- **Dashboard:** Seletor de modo ("Minhas Demandas" vs "Painel Profissional") e seletor "Ver como" padronizados na mesma altura (`h-10 sm:h-9`).

**Telas que a auditoria ainda não cobriu (auditar e corrigir):** modal do item do calendário, Agendamentos passos 2 a 4, ficha do lead, drawer de negócio do CRM, edição de membro e aba Produtividade, drawer "Mais", sheet de notificações, popover de perfil, paleta de comandos, sheets Criar e de filtros, formulário de nova demanda, páginas públicas (login, aprovação, relatório, formulário `/f/[slug]`).

**Como:** usar os componentes que já existem (`Button`, `ActionBar`, `FilterBar`, `Select`, `PageHeader`). Reutilizar a sonda de medição (overflow, alturas dos controles, alvos menores que 40px, texto menor que 12px) em produção a 375px antes e depois.

**Pronto quando:** nenhuma das telas acima tem scroll horizontal, nenhum controle tem menos de 40px de altura (44 no toque), nenhum botão de ação principal fica solto em largura parcial, e a sonda não aponta irmãos com altura diferente.

---

## 2. Resto da tela de demanda

### 2.1 Criar enxuto e editar completo — [Concluído em 05/11/2026]
Ao **criar**, mostra só o essencial: título, chips (formato, cliente, responsável, etiqueta), descrição, legenda e anexos. Checklist, comentários, propriedades avançadas e ajustes do cliente ficam ocultos na criação e aparecem no modo de edição (após salvar), acelerando o cadastro.

### 2.2 Menu "⋯" completo — [Concluído em 05/11/2026]
Menu expandido com: **Copiar link da demanda**, **Copiar ID**, **Duplicar demanda**, **Mover para outro cliente**, **Arquivar demanda** (coluna `arquivada_em`, com filtro e restauração na esteira), **Excluir**, e o rodapé "Criada em dd/mm/aaaa às hh:mm".

### 2.3 "Salvar como padrão" e "Legendas padrão" — [Concluído em 05/11/2026]
Tabela `legendas_padrao` criada, rotas de API `/api/legendas-padrao` implementadas e seletor "Modelos (N)" integrado diretamente na barra de formatação da legenda com inserção em um clique, exclusão e botão "Salvar como padrão".

### 2.4 Cronômetro e tempo estimado — [Concluído em 05/11/2026]
"Tempo na demanda" com play/pausa em tempo real no cartão escuro; soma total de tempo por demanda; modal de apontamento manual (+ minutos trabalhados); barra de progresso visual de tempo gasto vs estimado; e opção "Tempo estimado" no menu 3 pontinhos. Tabela `tempos_demanda` e endpoints `/api/conteudo/[id]/tempo` criados com suporte a RLS.

### 2.5 Interruptores do cliente — [Concluído em 05/11/2026]
Interruptor "Portal do cliente" (Visível/Oculto) integrado no cartão escuro; modal "Pedir informação ao cliente" no menu 3 pontinhos com alerta contextual e resposta integrada; colunas aditivas em `conteudo_items`.

### 2.6 Itens menores da demanda — [Concluído em 05/11/2026]
Botão de concluir demanda no cartão escuro e círculo de concluir no topo do card do kanban sem mover de coluna (título tachado, persistência via `concluida: boolean`).

---

## 3. Kanban de Demandas

### 3.1 Barra de filtros no estilo do Orkestrya — [Concluído em 05/11/2026]
Barra em linha única: busca em pílula (`rounded-full`), seleção de cliente, seleção de equipe, alternador de visão em pílula, menu de ferramentas "⋯" (Sincronizar Notion e Duplicar demandas do mês), botões de alternância de Publicados e Arquivados, e botão "Nova Demanda" fixo à direita. No celular, preserva busca + botão compacto "Filtros n".

### 3.2 Card com capa em miniatura — [Concluído em 05/11/2026]
Círculo de conclusão interativo, badges de prioridade, pílula de formato, miniatura de mídia padronizada em 16:9, indicador de pedido de informação pendente, indicador de demanda oculta do portal e menu rápido de 3 pontinhos.

### 3.3 Detalhes
- Reordenar colunas por arrastar, renomear e **cor da coluna** editável; **power-ups da coluna**.
- "Nova coluna" no fim do quadro e quadros por cliente (seletor de quadro).
- Etiquetas filtráveis na barra.

---

## 4. Financeiro, segunda rodada — [Entregue em 05/11/2026]

O Financeiro foi expandido para uma gestão de tesouraria profissional e completa:

- **Contas bancárias e saldo geral:** Tabela `contas_bancarias`, saldo individual calculado em tempo real com base no saldo inicial, receitas e despesas pagas e transferências. Widget com saldo total geral em contas e botão "+ Nova Conta".
- **Transferências entre contas:** Tabela `transferencias_contas`, endpoint `/api/financeiro/transferencias` e modal para transferir saldo entre contas com data e descrição.
- **Categorias editáveis com metas mensais:** Tabela `categorias_financeiro`, endpoint `/api/financeiro/categorias`, modal de criação de categoria com teto/meta mensal e barras de progresso de orçamento na visão geral (alertando em vermelho quando estourado).
- **Despesas recorrentes:** Flag `recorrente` nos lançamentos com projeção automática nos meses futuros (`despesasRecorrentesVirtuais`), gerando previsibilidade junto às mensalidades.
- **Editar lançamento completo:** Suporte a edição de qualquer lançamento (valor, descrição, data, conta, categoria e observações) via Sheet completo.
- **A pagar e A receber:** Filtros dedicados "A Receber" e "A Pagar" separando o que já foi liquidado do que está pendente, com alerta visual de atraso.
- **Cobrança amigável via WhatsApp:** Botão de cobrança direta via WhatsApp com mensagem formatada para lançamentos em atraso com cliente vinculado.

---

## 5. Propostas e Contratos — [Entregue em 05/11/2026]

O ciclo comercial e jurídico completo foi entregue com fidelidade ao design system GENSBot e integração nativa com o CRM e Financeiro:

- **Biblioteca completa de modelos:** 11 modelos de proposta e 9 de contrato padrão cobrindo Social Media, Tráfego Pago, Combo, Marketing 360, Conteúdo, Audiovisual, Branding, Sites/Landing Pages e Consultoria, com interpolação dinâmica de variáveis (`{{agencia_nome}}`, `{{cliente_doc}}`, etc.) e editor rico.
- **Dados da agência como CONTRATADA:** Cadastro completo da agência com validação de dados obrigatórios (CNPJ, Razão Social, Endereço, Cidade/Foro, Chave PIX, Telefone e E-mail), com banner de alerta em caso de pendências e botão "Completar agora".
- **Propostas comerciais:** Criação de proposta vinculada a clientes ou leads do CRM, definição de honorários mensais e setup, prazo de validade e link público (`/proposta/[token]`).
- **Página pública da proposta:** Visualização responsiva (mobile e desktop) com ações interativas de aprovação pelo cliente em 1 clique ou solicitação de ajustes com feedback, além de geração automática do contrato.
- **Contratos e Assinatura Digital:** Contratos jurídicos completos com link público de assinatura (`/contrato/[token]`), opção de digitação estilizada ou desenho de rubrica em canvas, captura do endereço IP, data/hora UTC e certificado de validade jurídica conforme MP 2.200-2/2001.
- **Integração CRM & Financeiro:** Negócios no CRM possuem botão de geração rápida de proposta; a assinatura digital do contrato marca a oportunidade como "ganho", atualiza os dados contratuais do cliente e registra automaticamente o lançamento de receita recorrente no Financeiro.
- **Gestão no painel:** Aba dedicada "Propostas & Contratos" no grupo Comercial com KPIs em tempo real, filtros de status, busca rápida, cópia de links e disparo amigável via WhatsApp.

---

## 6. Cliente e portal — [Entregue em 05/11/2026]

A experiência completa de acompanhamento e relacionamento com o cliente foi entregue:

- **Índice de Saúde Operacional (0 a 100):** Fórmula documentada e testada baseada em 100 pontos, penalizando atrasos de demandas (-15 pts cada), aprovações paradas há mais de 48h (-10 pts cada), mensalidades em atraso no Financeiro (-25 pts) e estagnação de postagens (-15 pts), com bonificação por meta mensal atingida (+5 pts). Exibição em badges coloridos no card do cliente e diagnóstico detalhado na ficha.
- **Ficha do cliente enriquecida por abas:** Visão Geral com widget de saúde e diagnóstico, Central Estratégica, Portal do Cliente & Regras, Integrações & Conexões, Contatos & Acessos, e Meta Ads.
- **Central Estratégica & Dossiê de Marca:** Campos estruturados para Persona, Raio-X do perfil, Posicionamento, Tom de voz, Concorrentes e cor de capa, com **link público compartilhável** (`/estrategia/[token]`) estilizado no design system GENSBot e pronto para impressão ou leitura externa.
- **Fotos em dois temas e capa colorida:** Suporte a foto para tema claro e tema escuro (`foto_url_dark`), além de cor de capa personalizada (`cor_capa`).
- **Regras de aprovação configuráveis:** Seletor de colunas de destino automático para Aprovado (ex: Agendar), Alteração solicitada (ex: Ajustes) e Reprovado (ex: Ideias).
- **Portal do Cliente (`/portal/[token]`):** Link público sem senha para o cliente final aprovar posts em 1 clique, solicitar ajustes detalhados, responder pedidos de informação enviados pela agência e visualizar o contrato ativo.

---

## 7. Onboarding do cliente com conexão das redes — [Entregue em 05/11/2026]

O ciclo de conexão autônoma de redes sociais pelo cliente final foi entregue com segurança criptográfica e integração com a esteira da agência:

- **Link público por cliente (`/conectar/[token]`):** Interface responsiva no design system GENSBot com boas-vindas da agência, dica de uso no computador, progresso de redes vinculadas e formulário de perfis (`@`).
- **Bypass seguro de login via HMAC:** Helper `onboarding-state.ts` com assinatura SHA-256 e validade temporal no parâmetro `state` do OAuth. Os callbacks de Instagram (`/api/oauth/callback`), Threads (`/api/integrations/threads/callback`) e TikTok (`/api/integrations/tiktok/callback`) autenticam o fluxo público sem exigir sessão interna da agência, vinculando a conta diretamente ao cliente e atualizando o link de onboarding.
- **Guia de convites de testador da Meta:** Passo a passo com links diretos para as telas oficiais de aceite de convites de testador no Instagram e no Threads, com indicação visual de envio pela agência.
- **Card de Onboarding na Ficha do Cliente:** Na aba "Integrações & Conexões", exibe a URL completa do onboarding, botões de 1 clique "Copiar Link" e "Enviar no WhatsApp", visualização dos @ perfis digitados pelo cliente, checkboxes para registrar o envio dos convites no Meta Developers e status em tempo real das conexões.
- **Conclusão e transição ao Portal:** Botão de finalização no onboarding marca automaticamente a etapa "Acessos das redes coletados" no checklist operacional do cliente (`onboarding_etapas`) e redireciona de imediato para o Portal do Cliente (`/portal/[token]`).

---

## 8. Backlog (depois dos itens acima)

- **Meu Dia:** tarefas de hoje e dos próximos 7 dias, demandas, agenda, checklist e aprovações da pessoa; tela inicial do membro.
- **Histórico de atividades (auditoria):** linha do tempo por dia com ação, módulo, pessoa e hora, com busca e filtros. Já existe base de eventos em `notificacoes`.
- **Setores, cargos e permissões por função:** hoje só há papel master, membro e cliente; separar por função (ex.: designer vê só produção, financeiro vê só Financeiro). Inclui squads e aniversário/tempo de casa.
- **Metas do Comercial:** meta de novos clientes por mês com barra de progresso; etapas Orçamento e Proposta com gatilho que cria o documento.
- **Chat interno** (conversas e grupos) e chat com clientes; hoje a comunicação passa pelo WhatsApp via Kapso.
- **Plano de Mídia** (pedidos de inserção, comissão), **Mapa Mental** e **Funil** (planejamento): só se fizerem sentido para a operação.
- **Central de Ajuda** com "Como fazer" ligado a cada passo do onboarding.
- **Notificações:** migration `20261104_notificacoes.sql` do sino ainda não foi aplicada; aplicar e testar push em uso real.
- **Limpeza técnica:** ~186 hex e ~190 cores Tailwind cruas espalhados no código (trocar por tokens); renomear o token `--lime` (hoje é a menta da marca) para um nome neutro; regra de lint para componentes de tela; os 13 erros de lint de `page.tsx` e os de `esteira-tab.tsx` (`setState` em effect, `any`).
- **Ícone e logo escura:** refazer o ícone do app sobre fundo preto, se quiser uma versão escura.
- **Sessões de teste:** apagar o cliente "Cliente Teste GENSBot" e a demanda de teste que ficaram na conta do Orkestrya.

---

## Ordem sugerida

1. **Correções da auditoria** (item 1): celular redondo, 1 a 2 rodadas.
2. **Resto da demanda, parte barata** (2.1, 2.2, 2.3) e **kanban** (item 3).
3. **Financeiro, segunda rodada** (item 4) em paralelo com **cronômetro** (2.4).
4. **Propostas e Contratos** (item 5) e **onboarding com link** (item 7, fase 1), porque os dois se conectam ao CRM e ao Financeiro.
5. **Cliente e portal** (item 6) e **interruptores do cliente** (2.5), que dependem do painel do cliente.
6. Backlog (item 8) conforme a necessidade.

## Decisões que dependem do Ewerton

- **TikTok:** pedir auditoria, operar só com post privado ou deixar manual (recomendação: manual agora).
- **Convite de testador:** manter manual ou pedir os @ no link para a agência só clicar em "adicionar".
- **Plano de Mídia, Mapa Mental e Funil:** entram ou ficam de fora.
- **Assinatura de contrato:** assinatura simples por link (aceite com registro de IP e data) ou integração com um provedor de assinatura eletrônica.
- **Fórmula do índice de Saúde:** validar os critérios antes de implementar.
