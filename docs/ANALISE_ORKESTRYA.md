# Análise do Orkestrya (2026-11-04)

Fonte: orkestrya.com.br, conta de teste, medido em ~500px de largura (layout de celular) e lendo o CSS real. Telas vistas: Início, Demandas (kanban), Social, Agenda, Aprovação, Clientes, Comercial (CRM), Financeiro, Maestro (IA), Configurações e o menu lateral. Telas internas (card de demanda aberto, cliente aberto, proposta, contrato, mapa mental, plano de mídia) ficaram de fora porque a conta está vazia.

## 1. Estrutura e fluxo

**Menu (drawer à esquerda, abre pelo ☰), em dois blocos:**
- Principal: Início, Meu Dia, Maestro (IA), Agenda, Demandas, Aprovação, Social, Clientes.
- Recolhível: Propostas, Contratos, Financeiro, Plano de Mídia, Mapa Mental, Funil, Comercial, Comunicação, Configurações.
- Topo do drawer: logo + seletor da agência ("Boa noite, Ewweton ▾").

**Rotas:** /inicio, /meu-dia, /maestro, /agenda, /kanban, /aprovacoes (abas: posts / demandas), /social (lista / calendário / grade), /clientes, /propostas, /contratos, /financeiro, /plano-de-midia, /mapa-mental, /funil, /crm (Comercial), /comunicacao, /timesheet, /desempenho, /projetos, /configuracoes/{perfil,agencia,equipe,assinatura}, /ajuda.

**Padrões de fluxo que valem copiar:**
- **Início com "Primeiros passos"** (0 de 6, barra de progresso): cada passo tem botão primário + "Como fazer" que leva ao artigo de ajuda. Estado vazio sempre ensina o próximo passo.
- **Cards de resumo clicáveis** na Início: cada número leva à tela dona do dado (Clientes ativos → /clientes, Aprovações → /aprovacoes).
- **Estado vazio padrão:** ícone num círculo cinza + frase curta + botão laranja pequeno ("+ Novo cliente").
- **Maestro (IA) como item de primeira classe** do menu e atalho "Pergunte para o Maestro" na Início. Bloqueado no teste, com botão "Assinar o Master".
- **Ajuda dentro do produto:** /ajuda com busca e "Pergunte na Central de Ajuda".
- **Cobrança visível:** faixa preta de Black Friday + faixa de teste com contagem de dias, ambas com botão laranja.
- **Integrações citadas:** Social (redes e agendamento), Financeiro (receitas/despesas), Timesheet, Plano de Mídia, assinatura/planos.

## 2. Design system (valores medidos)

**Tipografia:** Geist (texto) e Geist Mono. Corpo 16px. Título de página 36px, peso **300 (light)**, tracking −0.025em, line-height ≈1.05; os títulos finos e grandes são a assinatura visual. Botões 13px peso 600. Rótulos e metadados pequenos em cinza.

**Cores (tema claro, padrão):**
| Papel | Valor |
|---|---|
| fundo | #f0f0f2 |
| superfície (cards) | #ffffff |
| superfície 2 / 3 | #f1f1f3 / #e6e6e9 |
| borda | #e2e2e6 / #d1d1d6 |
| texto | #18181b |
| texto fraco | #63636b / #97979f |
| **acento (laranja)** | #faa422 (texto sobre ele: #111) |
| acento claro / suave | #e8850a / #ffe4b8 |
| perigo / sucesso | #d0342c / #2f9155 |
| painel escuro (faixas, resumo) | #16171b, 2º tom #26272e |
| gráficos | #2a78d6, #eb6834, #1baf7a, #eda100 |

Tema escuro disponível: fundo #0a0a0a, superfície #141414, mesmas semânticas. Sidebar tem tokens próprios (#eceef3 claro / #0e0f13 escuro).

**Forma e profundidade:**
- Cards e faixas: raio 24px, fundo branco, **sem borda e sem sombra** (separação só pelo contraste #fff sobre #f0f0f2).
- Botões e chips: **pílula total** (raio 9999px). Botão-ícone 40x40 branco circular.
- Inputs: pílula cinza clara, sem borda visível.
- Barra de ação de formulário fixa embaixo, em card branco ("Suas alterações só valem depois de salvar" + botão laranja largo).
- Margem lateral da página fluida: `clamp(1rem, 5.09vw − 3px, 2.25rem)`. Cabeçalho fixo de 73px branco.

**Ícones:** traço fino, `stroke-width 1.5`, viewBox 24, estilo Lucide/Heroicons outline. Ícone do título da página em laranja, pequeno, à esquerda do H1. Ícone dentro de círculo (laranja suave ou cinza) nos cards e estados vazios.

**Componentes recorrentes:**
- **Abas em pílula** dentro de um trilho branco; aba ativa laranja (#faa422) com texto escuro, inativas texto cinza. Quando não cabem, "Mais ▾".
- **Troca de visualização** (lista/calendário/grade) como grupo de ícones em pílula, o ativo em laranja.
- **Filtros** como botões-ícone circulares (busca, ajustes, paleta, "⋯"), nunca barra de filtros aberta no celular.
- **Cartão escuro de destaque** (Resumo do mês, faixas) em #18181b com texto branco e número grande.
- **Meta com barra de progresso** em pílula, preenchimento laranja.
- Botões de ação financeira em verde/vermelho cheios (Recebimento / Despesa), largos e lado a lado.
- Calendário mensal em células com raio, dia atual com anel laranja, pontos rosa para itens.
- Badge "BETA" e "Myra" no cabeçalho do Comercial (IA como botão preto).

## 3. Comparação com o GENSBot (Floresta)

| Aspecto | Orkestrya | GENSBot hoje |
|---|---|---|
| Identidade | claro, neutro, um acento laranja | verde-floresta escuro, menta |
| Título de página | 36px light, ícone laranja | títulos mais pesados, sem ícone |
| Cards | 24px, sem borda/sombra | cards com borda |
| Botões | pílula total | raios menores |
| Navegação mobile | drawer + cabeçalho simples | barra inferior flutuante + "+" (já melhor para uso rápido) |
| Filtros mobile | ícones circulares | FilterBar com "Filtros n" (equivalente) |
| Onboarding | checklist "Primeiros passos" | não tem |
| Estado vazio | ícone + frase + 1 botão | varia por tela |
| Ajuda | /ajuda + "Como fazer" por passo | não tem |

O que o GENSBot já faz melhor: barra inferior com criação central, esteira com seletor de etapa, push, MCP. O que o Orkestrya faz melhor: consistência de forma (tudo pílula/24px), tipografia leve em escala grande, onboarding e estados vazios.

## 4. O que vale implementar (proposta, em ordem)

1. **Tema claro "estilo Orkestrya" opcional** só se você quiser; o escuro Floresta fica como padrão. Não troca a marca, só adota a gramática de forma.
2. **Forma:** botões e chips em pílula total, cards em 24px sem borda no claro, inputs em pílula cinza. Mexe em `Button`, `Card`, `Input` e tokens de raio.
3. **Tipografia:** títulos de página 36px/300 com tracking negativo + ícone do módulo ao lado (componente `PageHeader`, que já estava pendente na Fase C).
4. **Estado vazio padrão** (`EmptyState`): ícone em círculo + frase + 1 botão, aplicado em todas as listas.
5. **Primeiros passos no Início:** checklist com progresso e "Como fazer".
6. **Abas em pílula e troca de visualização** como componentes (`PillTabs`, `ViewSwitch`) substituindo as abas atuais.
7. **Cards de resumo clicáveis** na Início levando às telas.
8. **Barra de salvar fixa** nos formulários longos (Equipe, Configurações, editor de automação). Resolve "Salvar Fluxo" órfão da auditoria.
9. **Central de ajuda** curta (opcional, depende de conteúdo).

Itens 3, 4, 6 e 8 se encaixam direto nas correções da auditoria (PageHeader, botões órfãos, selects fora do padrão).

## 5. Pendências da análise

- Telas internas não vistas (conta vazia): card de demanda aberto, ficha de cliente, proposta, contrato, plano de mídia, mapa mental, Comunicação.
- Tema escuro do Orkestrya só lido pelos tokens, não visto em tela.
- Largura desktop (>1024px) não analisada; tudo foi medido em ~500px.

---

# Parte 2: módulos de negócio e Configurações (visto com a conta configurada)

O app também tem tema escuro (preto neutro com laranja), na mesma estrutura. Tudo abaixo foi lido em tela ou no texto da página.

## 6. Demandas (kanban)

- **Quadros:** seletor de quadro no topo ("Aprovacoes") + busca, filtros, paleta de cor do quadro e menu "⋯". Colunas (7 aqui): Pauta, Roteiro e Copy, Produção (Arte/Vídeo), Aprovação do Cliente, Agendado, Publicado, Métricas, com "Nova coluna" no fim.
- **Mobile:** uma coluna por vez, com seletor "Coluna 1 de 7 ▾" e pontos de paginação; cada coluna tem botão "Nova demanda" colorido na cor da coluna, contador no título e alça para reordenar. Coluna vazia mostra faixa listrada e "Nova demanda" tracejado.
- **Card:** título, responsável (avatar + "Eu mesmo"), etiqueta de tipo (Post, REELS), datas (05/11, 06/11), contadores.
- **Demanda aberta (bottom sheet com alça):**
  - Cabeçalho: "DEMANDA · PAUTA" + ações (aprovar ✓, anexo, ⋯, raio de automação, fechar). Excluir (vermelho), Cancelar, **Salvar** (laranja) sempre visíveis.
  - Título grande editável; chips: tipo (Post), Demanda, responsável, etiqueta.
  - **Descrição** com editor rico (H2, H3, negrito, lista, citação, "--" cria divisória).
  - **Legenda** do post com editor próprio, hashtags, emoji, contador por rede (Instagram 0/2200), "Salvar como padrão" e aviso de que aquilo vale para aprovação e agendamento.
  - Comentários, **"Enviar post para aprovação"** (botão largo), **cronômetro "Tempo na demanda"** (alimenta o Timesheet), lista de propriedades (Coluna, Prioridade, Tipo, Datas, Postagem).
  - **"Visível para o cliente"** (toggle): o cliente vê um resumo no painel dele; **"Aguardando informação do cliente"**: pede algo ao cliente e ele é notificado.

## 7. Clientes

- Lista em **grade de cards pequenos**: avatar grande, nome, selo "Ativo", e rodapé com **Atrasadas** e **Saúde** (índice 0–100). Alça para reordenar, fixar e menu ⋯. Botões: busca, filtros, **"Painel do Cliente"** (modo de visualização), Novo.
- **Ficha do cliente:** capa colorida + avatar + "Editar cliente". Bloco "Ficha": cliente desde, **mensalidade**, **dia de cobrança**. Cartões de visão geral (Projetos, Conteúdos pendentes, Demandas ativas).
- **Central Estratégica** (card de destaque): persona, raio-x do perfil, concorrentes, posicionamento de marca e identidade visual, com **"Compartilhar central"**.
- Abas internas: Visão geral, Conteúdo, Métricas, Financeiro, Arquivos, Anotações, Acessos. A visão geral resume Conteúdo (aguardando aprovação / aprovados / agendados), Métricas, Demandas, Projetos, **Valores e contrato** (por mês, serviços contratados, próxima renovação, lançamentos).

## 8. Propostas e Contratos

- **Propostas:** cartão de destaque com "Valor em aberto" + grade 2 colunas de KPIs (Aceitas, Em andamento, Enviadas, Vencem em 7 dias, Recusadas, Vencidas); **11 modelos de proposta**; lista de propostas.
- **Contratos:** mesmo layout. KPIs: Assinados, Aguardando cliente, **Sua assinatura**, Rascunhos, **Renovam em 30 dias**, **Renovação vencida**; "clientes com contrato" e valor em contratos assinados. **9 modelos** prontos (Gestão de Redes Sociais, Tráfego Pago, Instagram, Redes + Tráfego, Marketing 360, Criação de Conteúdo, Produção Audiovisual, Identidade Visual e Branding, Site e Landing Page), cada um com **"Usar modelo"** e **"Personalizar"**. Também há **Manual do Cliente**.
- Os dados da agência (CNPJ, endereço, e-mail, telefone, PIX) entram como **CONTRATADA** em todos os contratos; o sistema avisa quando faltam.

## 9. Financeiro

- Abas: Visão geral, Lançamentos, Mais áreas; atalhos fixos **+ Recebimento** (verde) e **+ Despesa** (vermelho).
- Visão geral em blocos: saldo geral, receitas/despesas/resultado do mês (com comparação ao mês anterior), **resultado previsto**, recebido × falta × previsto, **fluxo de caixa com projeção**, **previsão de fechamento**, minhas contas, despesas por categoria ("onde mais gastei"), tendência das maiores despesas, "o que mudou vs. mês passado", "de onde veio a receita", próximas contas (atrasadas / a vencer), **metas por categoria**, últimas transações, **gastos por pessoa (folha da equipe)** e **renovações próximas**.
- Cabeçalho acolhedor com saudação, nome da agência e botão de ocultar valores (olho).

## 10. Plano de Mídia, Mapa Mental, Funil

- **Plano de Mídia:** KPIs Em aberto / Aprovados / **Comissão faturada**; abas **Pedidos de inserção** e **Planos de produção**.
- **Mapa Mental:** pastas + mapas, criar primeiro mapa.
- **Funil:** criador de funis (de marketing) com pastas e lixeira.

## 11. Comercial (CRM)

- Abas **Funil** e "Mais"; botão **Myra (BETA)**, IA comercial; **Nova**.
- **Meta de novos clientes do mês** com barra de progresso e "Editar meta".
- **Resumo do mês** em cartão escuro: R$ em novas contas, Pipeline, Vendas perdidas, Total de leads.
- Kanban de 7 etapas: Novo Lead, Contato Feito, **Orçamento**, **Proposta**, Negociação, Fechado, Perdido. Etapas "Orçamento" e "Proposta" têm gatilho ("Proposta ao entrar"): entrar nelas cria a proposta.

## 12. Outros módulos

- **Meu Dia:** hoje, próximos 7 dias, demandas, agenda, checklist, ajustes e aprovações da pessoa.
- **Comunicação:** chat interno (conversas diretas e grupos) e chat com clientes.
- **Timesheet** (horas em novembro), **Desempenho da equipe**, **Projetos** (prazo de entrega).
- **Social:** agendamentos em lista, calendário e grade, filtro por rede e por tipo de tela.
- **Aprovação:** abas "Aprovação de posts" e "Aprovação de demandas".

## 13. Configurações

Abas: **Perfil, Agência, Assinatura, Equipe, Modelos, Integrações, Histórico** (as últimas dentro de "Mais ▾").

- **Equipe** (sub-abas: Usuários, Setores e cargos, Squads, Mapa, Clientes, Projetos, Recompensas): indicadores (total, ativos, administradores, online agora); cada pessoa com setor, cargo, tempo de casa, aniversário, **permissão** ("Administrador · todas as funções"), status e último acesso.
- **Modelos:** Prestador / Modelo guiado; contratos, propostas, manual do cliente e **quadros** (modelos de kanban); botão "Novo modelo".
- **Integrações:** busca + filtro por categoria. Google Agenda (conectar), Google Drive (anexar como link), **Maestro** (IA que lê o sistema), **Conexão com outras IAs via MCP** (Claude, Cursor agindo como o usuário).
- **Histórico de atividades:** linha do tempo agrupada por dia, com ação, módulo (Acessos, Clientes…), pessoa e hora; busca e filtros; "5 de 5 registros". Também "Ver histórico de acessos" no perfil.
- **Perfil:** barra de salvar fixa com aviso "Suas alterações só valem depois de salvar".

---

# Roadmap sugerido para o GENSBot

O que o GENSBot **já tem** e não precisa copiar: kanban de demandas com aprovação por WhatsApp, calendário, agendamento Instagram, automações de Direct, CRM, equipe, MCP (GENSBot já é "conectável a IAs").

## Alto valor, encaixa direto (ordem sugerida)
1. **Financeiro** (receitas, despesas, contas, categorias, previsão, fluxo de caixa, "falta receber/pagar", mensalidade por cliente). É o módulo que você mais elogiou e o GENSBot não tem. Dá para ligar à mensalidade e ao dia de cobrança de cada cliente.
2. **Propostas e Contratos com modelos**: biblioteca de modelos por serviço (os 9 acima são ponto de partida para a Gens), dados da agência como CONTRATADA, status (rascunho, aguardando cliente, assinado), renovações. Ligar ao CRM: entrar em "Proposta" cria a proposta.
3. **Ficha do cliente com Central Estratégica** (persona, concorrentes, posicionamento, identidade) e **índice de Saúde** do cliente. O GENSBot já tem dossiê; falta o resumo por abas e o painel compartilhável.
4. **Meu Dia** (tarefas, agenda, aprovações da pessoa) como tela inicial do membro.
5. **Cronômetro por demanda** (Timesheet) e **Desempenho da equipe**; alimenta o Financeiro (custo por cliente).
6. **Histórico de atividades** (auditoria): quem fez o quê e quando, com filtro. Já existe base de eventos em notificações.
7. **Setores/cargos/permissões por função** na Equipe (hoje só papel master/membro).

## Médio prazo
8. **Portal do cliente com "Visível para o cliente" e "Aguardando informação"** por demanda (GENSBot tem aprovação pública; falta o painel contínuo).
9. **Metas do mês** no Comercial (meta de novos clientes + barra) e etapas Orçamento/Proposta com gatilho.
10. **Plano de Mídia** (pedidos de inserção, comissão) só se a agência trabalhar com compra de mídia.
11. **Chat interno** e chat com clientes (hoje a comunicação passa pelo WhatsApp via Kapso).
12. **Mapa Mental** e **Funil** (ferramentas de planejamento) — baixa prioridade.

## Padrões de interface a adotar já
- Cartão de destaque com número grande + grade 2 colunas de KPIs (Propostas, Contratos, Plano de Mídia).
- Bottom sheet com alça e barra fixa **Excluir / Cancelar / Salvar** (demanda aberta).
- Kanban mobile com **seletor "Coluna n de N"** + pontos de paginação.
- Modelos com **"Usar modelo" / "Personalizar"**.
- Aviso de dado faltante que bloqueia qualidade ("faltam CNPJ, endereço…") com botão "Completar agora".

## Pendências desta análise
- Telas que exigem dados reais (proposta e contrato abertos, financeiro com lançamentos, funil e mapa em edição, chat) não foram abertas: estavam vazias.
- Não abri o editor de modelos de contrato (conteúdo das cláusulas), que vale ler antes de montar os modelos da Gens.

---

# Parte 3: tela de demanda (aberta e nova) — plano de melhoria

Visto no Orkestrya (celular, tema escuro) abrindo "Pauta do mês" (existente) e "Nova demanda" (sem salvar), e comparado com `src/components/demanda-sheet.tsx` (1.571 linhas, uma só tela longa).

## O que o Orkestrya faz

**Estrutura (de cima para baixo), nos dois casos usa bottom sheet com alça:**
1. Rótulo "DEMANDA · ETAPA" (ou "NOVA DEMANDA") + 4 ações em círculo: **concluir** (✓ verde), **adicionar capa**, **⋯ ações**, **power-ups** (automações da demanda), fechar.
2. **Barra de comandos sempre no topo**: Excluir (vermelho, só ícone), Cancelar, **Salvar** (laranja). Não se perde ao rolar.
3. **Título grande** editável (placeholder "Título da demanda").
4. **Chips de contexto em uma linha**, rolável: formato (Post), tipo (Demanda), **Cliente** (só ao criar; "Cliente: Eu mesmo. Trocar" ao editar), responsável, Etiqueta.
5. **Descrição** (briefing) com editor rico: desfazer/refazer, H2/H3, negrito, itálico, sublinhado, tachado, destaque, listas, citação, "--" vira divisória.
6. **Legenda** do post com editor próprio: emoji, lista, #, negrito/itálico, contador **por rede (Instagram 0/2200)**, **"Salvar como padrão"** (legenda-base do cliente) e aviso de que o texto vale para aprovação e agendamento. Mídia enviada vai para os Anexos, não para a legenda.
7. Comentários (emoji, anexo, enviar).
8. **Card de ação e propriedades**: botão largo **"Enviar post para aprovação"**, cronômetro **"Tempo na demanda"** (play), e lista de linhas **Coluna / Prioridade / Tipo / Datas / Postagem**, cada uma tocável.
9. Dois interruptores explicados em texto: **"Visível para o cliente"** e **"Aguardando informação do cliente"**.

**Menu ⋯:** Duplicar, Mover para outro quadro, Enviar para Conversas, **Repetir demanda** (recorrência), **Tempo estimado**, Mudar de projeto, **Não esquecer** (lembrete), Copiar link, Arquivar, Excluir, e "Criada em dd/mm/aaaa às hh:mm".

**Criar vs. editar:** criar mostra só o essencial (título, chips, descrição, legenda). Concluir, capa, automações, cronômetro e propriedades só aparecem depois de salvar.

## Onde o GENSBot pode melhorar

O sheet do GENSBot é completo (breadcrumb cliente > etapa, seletor de etapa, copiar link de aprovação, agendar, abas Roteiro/Legenda, anexos, formato, responsáveis, designer, prazos, checklist com progresso, ajustes do cliente, comentários internos). A diferença é de **organização**, não de recurso:

1. **Barra de comandos fixa no topo** (Excluir / Cancelar / Salvar). Hoje Cancelar e Salvar ficam no rodapé de uma tela muito longa; no celular o teclado os empurra.
2. **Chips de contexto numa linha só** (formato, tipo, cliente, responsável, etiqueta). Hoje Cliente, Formato, Prioridade e Responsáveis são blocos separados e grandes.
3. **Propriedades em lista** num card único (Etapa, Prioridade, Prazo interno, Data de postagem), cada linha abrindo um seletor. Substitui os blocos de Prazo/Prioridade duplicados (o código repete Prazo e Prioridade em duas seções, linhas ~773 e ~1173).
4. **Ação principal destacada**: um botão largo "Enviar para aprovação" no lugar de ícones soltos no cabeçalho (copiar link, agendar).
5. **Menu ⋯ completo**: Duplicar, Mover de quadro/cliente, Repetir demanda, Tempo estimado, Copiar link, Arquivar, Excluir, "Criada em…". Hoje só há Excluir.
6. **Cronômetro por demanda** e **tempo estimado** (base do Timesheet e do custo por cliente no Financeiro).
7. **Interruptores do cliente** ("Visível para o cliente" e "Aguardando informação"), com a explicação de uma linha embaixo. Serve ao portal do cliente do item 8 do roadmap.
8. **Legenda**: contador por rede, "Salvar como padrão" por cliente e aviso de onde o texto é usado.
9. **Criar enxuto**: ao criar, mostrar só título, chips, descrição/legenda e anexos; checklist, comentários, ajustes do cliente e propriedades só ao editar.
10. **Seções recolhíveis** no celular (Checklist, Comentários, Ajustes) com contador no título, para a tela não virar uma coluna infinita.
11. **Capa** opcional da demanda (imagem de referência no card do kanban).

## Ordem de implementação sugerida
1. Barra de comandos fixa + chips numa linha (itens 1–2): ganho imediato no celular.
2. Propriedades em lista + remover duplicidades + botão "Enviar para aprovação" (3–4).
3. Menu ⋯ completo (5): duplicar, mover, repetir, arquivar são só lógica sobre dados existentes.
4. Criar enxuto + seções recolhíveis (9–10).
5. Cronômetro/tempo estimado (6) junto do Financeiro; interruptores do cliente (7) junto do portal do cliente; legenda padrão (8) e capa (11) depois.

## Pendências
- Não abri os seletores dos chips nem o painel "Power-ups", para não alterar dados da conta de teste.
- Não vi a demanda com comentários, anexos e checklist preenchidos (estava vazia).

---

# Parte 4: fluxos testados de ponta a ponta (cliente, demanda, aprovação, financeiro)

Testado na conta de teste do Orkestrya, com o cliente "Cliente Teste GENSBot" e a demanda "Post de teste Black Friday" criados por mim.

## Novo cliente (bottom sheet com Salvar/Cancelar fixos embaixo)
Campos: **foto em modo claro e modo escuro** (com prévia dos dois temas), **foto de capa** (1600x400) e **cor de capa**, nome, status (Ativo/Pausado/Inativo/Arquivado), cliente desde, observações, **lembretes automáticos por e-mail** (aprovação parada), contato (pessoa, telefone, e-mail), documento (CNPJ/CPF), endereço, **mensalidade** e **dia de cobrança** ("Gera a mensalidade todo mês em Financeiro, no dia de cobrança") e o interruptor **Acesso ao Portal do Cliente**.
- Só o nome é obrigatório. Depois de salvar, o card aparece na grade com Saúde "–" até haver dados.
- **Efeito em cadeia:** ao salvar R$ 1.500 de mensalidade, o Financeiro mostrou na hora a receita do mês, "Falta receber", resultado previsto e a **projeção** de dezembro e janeiro (barras riscadas). Em Lançamentos apareceu "Mensalidade: Cliente Teste GENSBot", categoria Mensalidades, dia 5, com o interruptor "Recebido?".

## Nova demanda e envio para aprovação
- Criar: título + chips; **Cliente** num menu; legenda; Salvar. O card entra na coluna Pauta com avatar do cliente.
- **"Enviar post para aprovação"** abre um sheet próprio: **Anexos** (mídia ou Google Drive), Cliente, **Projeto**, **Legenda** (com "Legendas padrão"), **Programação da publicação** ("Não programar" por padrão) e **"Depois da resposta do cliente"**: para **Aprovado / Alteração pedida / Reprovado** escolhe-se a coluna de destino do quadro ("Não mover" por padrão) e se marca com etiquetas.
- **Validação:** sem mídia o botão Enviar recusa ("Envie ao menos uma imagem, um vídeo ou um link do Drive"). Não consegui anexar arquivo, então o envio em si não foi concluído.

## Agendar post (Social)
Página própria "Novo agendamento" (sem passar pelo quadro): **Cliente e rede**, **Conteúdo** (título opcional, legenda, legendas padrão, emoji, mídia), **Quando publicar** (atalhos "Daqui a 1 hora / Hoje às 18h / Amanhã às 9h / Amanhã às 18h" + calendário). Barra fixa: Confirmar agendamento / Cancelar. Não concluí porque não há rede social conectada.

## Financeiro: Novo lançamento
Alternador **Despesa | Receita**, valor, descrição, **conta**, **categoria**, data com atalho "Já foi recebido/pago", **repetição**, e "Mais opções": vínculo (cliente/projeto), etiquetas, status, data do recebimento, **competência**, moeda, pessoa ligada, serviço, nota fiscal, observações.
- Lançamentos: filtro por mês, abas por tipo (Todas, Recebimentos, Despesas Fixas, Variáveis, Impostos, Pessoas, Transferências), totais e lista por mês com ações por linha.
- **Mais áreas:** A pagar e receber, Agenda, Contas, Cartões, Conciliação, Relatórios, **Cobranças**, Folha da equipe; Cadastros: Categorias, Contatos, Integrações.

## Lições para o GENSBot
1. **Cliente → Financeiro:** mensalidade e dia de cobrança geram receita recorrente e projeção sozinhos. É o coração do módulo.
2. **Sheet de aprovação separado**, com mídia obrigatória, programação opcional e **regras pós-resposta** (mover a demanda de coluna conforme a resposta do cliente).
3. **Página de agendamento própria** com atalhos de horário.
4. **Validação clara antes de enviar.**
5. Foto do cliente em **dois temas**, útil porque o GENSBot também tem claro e escuro.
