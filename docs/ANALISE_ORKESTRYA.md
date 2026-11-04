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

# Parte 4: fluxos testados de ponta a ponta (cliente, demanda, aprovação, financeiro)

Testado na conta de teste do Orkestrya, com o cliente "Cliente Teste GENSBot" e a demanda "Post de teste Black Friday" criados por mim.

## Novo cliente (bottom sheet com Salvar/Cancelar fixos embaixo)
Campos: **foto em modo claro e modo escuro** (com prévia dos dois temas lado a lado), **foto de capa** (1600x400) e **cor de capa**, nome, status (Ativo/Pausado/Inativo/Arquivado), cliente desde, observações, **lembretes automáticos por e-mail** (aprovação parada), contato (pessoa, telefone, e-mail), documento (CNPJ/CPF), endereço, **mensalidade** e **dia de cobrança** ("Gera a mensalidade todo mês em Financeiro, no dia de cobrança"), e o interruptor **Acesso ao Portal do Cliente**.
- Só o nome é obrigatório. Depois de salvar, o card aparece na grade com Saúde "–" até haver dados.
- **Efeito em cadeia:** ao salvar R$ 1.500 de mensalidade, o Financeiro passou a mostrar na hora a receita do mês, "Falta receber", resultado previsto e, em dezembro/janeiro, a **projeção** (barras riscadas). Em Lançamentos apareceu "Mensalidade: Cliente Teste GENSBot", categoria Mensalidades, dia 5, com o interruptor "Recebido?".

## Nova demanda e envio para aprovação
- Criar: título + chips; escolher **Cliente** num menu (Nenhum / clientes); legenda; Salvar. O card entra na coluna Pauta com avatar do cliente.
- **"Enviar post para aprovação"** abre um sheet próprio: **Anexos** (mídia ou Google Drive), Cliente, **Projeto**, **Legenda** (com "Legendas padrão"), **Programação da publicação** ("Não programar" por padrão: o cliente só aprova; a publicação é agendada depois), e **"Depois da resposta do cliente"**: para cada resposta (**Aprovado / Alteração pedida / Reprovado**) escolhe-se a coluna de destino do quadro ("Não mover" por padrão) e se marca com etiquetas.
- **Validação:** sem mídia o botão Enviar recusa com "Envie ao menos uma imagem, um vídeo ou um link do Drive". Não consegui anexar arquivo, então o envio em si não foi concluído.

## Agendar post (Social)
Página própria "Novo agendamento" ("sem passar pelo quadro de demandas"), com blocos: **Cliente e rede**, **Conteúdo** (título opcional, legenda, legendas padrão, emoji, mídia), **Quando publicar** (atalhos "Daqui a 1 hora / Hoje às 18h / Amanhã às 9h / Amanhã às 18h" + calendário). Barra fixa: Confirmar agendamento / Cancelar. Não concluí porque não há rede social conectada na conta.

## Financeiro: Novo lançamento
Alternador **Despesa | Receita**, valor grande, descrição, **conta** e **categoria**, data com atalho **"Já foi recebido/pago"**, **repetição** (não repete e recorrências), e "Mais opções": vínculo (cliente/projeto), etiquetas, status, data do recebimento, **competência**, moeda, pessoa ligada, serviço, nota fiscal, observações.
- Lançamentos: filtro por mês, abas por tipo (Todas, Recebimentos, Despesas Fixas, Variáveis, Impostos, Pessoas, Transferências), totais (Receitas, Despesas, Saldo), lista agrupada por mês com ações por linha.
- **Mais áreas:** A pagar e receber, Agenda, Contas, Cartões, Conciliação, Relatórios, **Cobranças**, Folha da equipe; Cadastros: Categorias, Contatos, Integrações.

## Lições para o GENSBot
1. **Ligar cliente → Financeiro**: mensalidade e dia de cobrança geram receita recorrente e projeção automaticamente. É o coração do módulo e o que torna o Financeiro útil sem digitação.
2. **Sheet de aprovação separado** da demanda: anexos obrigatórios, programação opcional e **regras pós-resposta** (mover a demanda de coluna conforme Aprovado / Alteração / Reprovado). O GENSBot já tem aprovação pelo WhatsApp; falta a regra de movimento automático configurável.
3. **Página de agendamento própria** com atalhos de horário.
4. **Validação clara antes de enviar** (mídia obrigatória).
5. Foto do cliente em **dois temas** (claro e escuro), útil porque o GENSBot tem os dois.
