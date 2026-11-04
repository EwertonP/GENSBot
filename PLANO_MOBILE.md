# Plano Mobile e Design System do GENSBot

Objetivo: o GENSBot inteiro usável no celular, com o mesmo cuidado que o desktop já recebeu (sidebar em grupos, kanban novo, aprovação, Equipe, anúncios, postagem multiplataforma). Este plano também prepara o terreno para o PWA com notificações.

Atualização de 04/11/2026: entrou a **Parte B, Design system** (seção 3B), a partir da análise de `https://onovocarrossel.com/`, que você indicou como norte de cor. A análise completa está em `design/referencia-novo-carrossel/design.md` (tokens lidos direto do CSS do site, contraste medido). A Parte B e a Fase 1 mexem nos mesmos componentes base, então foram juntadas na ordem da seção 4.

Base: `main` em 04/11/2026 (commit `7baf1c7`). Os números abaixo vêm de contagem no código, não de teste em aparelho; servem para priorizar, não para sentenciar. A Fase 0 troca estimativa por medição.

---

## 1. Onde estamos

### O que já está bom (não refazer)
- Menu lateral vira gaveta com fundo escurecido, e há barra superior própria no celular (menu, busca, tema, avatar).
- `DataTable` já tem modo celular: vira lista de cartões, com `mobile: 'primary' | 'meta' | 'hidden'` por coluna.
- Esteira: colunas com rolagem em ímã (`snap`), 85vw por coluna e atalhos de etapa no topo no celular.
- Calendário: a grade mensal some no celular e entra uma lista.
- Portal de aprovação do cliente já é pensado para celular (cartões de até 420px, download direto).
- `nav-config.tsx` é a fonte única das 14 telas (menu, título, busca rápida).

### Os buracos, do mais amplo ao mais específico

| # | Problema | Evidência | Efeito no celular |
|---|---|---|---|
| 1 | Altura em `vh`, nenhuma em `dvh` | 23 usos de `h-screen`/`100vh`/`min-h-screen`, 0 de `dvh`. O shell inteiro é `h-screen overflow-hidden` | No iPhone a barra do Safari corta o rodapé e botões ficam inalcançáveis; Inbox (`100vh-140px`) e construtor de formulário (`100vh-68px`) sofrem mais |
| 2 | Sem área segura | 0 usos de `safe-area` / `env()` | Notch e barra do home cobrem conteúdo, principalmente com o app instalado (PWA) |
| 3 | Navegação só por hambúrguer | 14 telas dentro da gaveta, nada na zona do polegar | Cada troca de tela são 2 toques no topo da tela |
| 4 | Alvos de toque pequenos | ~158 usos de `size/h/w-6` e `-7` (24 a 28px); o mínimo confortável é 44px | Erra o toque em ícones, fechar, menus de card |
| 5 | Ações que só aparecem no hover | 42 usos de `group-hover` / `hover:opacity-100` | No toque, o botão nunca aparece |
| 6 | Texto muito pequeno | 180 usos de `text-[10px]` e `text-[11px]` | Ilegível no sol; vira ruído nas telas densas |
| 7 | Modal centralizado | `Dialog` é popup central com `max-h-92vh` | Em tela pequena fica apertado, rola dentro de rolagem e o teclado cobre o campo |
| 8 | Telas grandes sem adaptação | Poucas classes responsivas para o tamanho: `step-timeline` 1/882 linhas, `flow-builder/panels` 0/642, `inbox-panel` 2/775, `crm-deal-drawer` 3/806, `painel-produtividade` 4/639, `crm-tab` 6/780, `rotina-tab` 7/1206 | Prováveis telas quebradas ou só rolagem lateral |
| 9 | Módulos novos feitos pensando no desktop | Painel de anúncios: tabela com rolagem lateral, 2 classes responsivas em 298 linhas. Postagem multiplataforma: no `publish-panel` não achei seletor de plataforma (só os botões de conectar Threads e TikTok na ficha do cliente) | O que foi adicionado agora ainda não tem versão celular; a hora de pensar nisso é antes de construir |
| 10 | Arquivos gigantes | `publish-panel` 2560 linhas, `cliente-ficha` 2300, `esteira-tab` 1640, `demanda-sheet` 1561, `page.tsx` 1555 | Qualquer ajuste mobile arrisca quebrar o desktop; difícil revisar |

Ressalva: poucas classes responsivas não significa tela quebrada (código mobile-first usa poucas). É por isso que a Fase 0 mede de verdade.

---

## 2. Como saberemos que está pronto

Regras que valem para toda tela, nas larguras 360, 390 e 768:
1. Sem rolagem horizontal da página (tabela larga rola dentro do próprio bloco, com sombra de borda).
2. Alvo de toque de pelo menos 44px (área de toque, mesmo que o ícone seja menor).
3. Texto de leitura com pelo menos 14px; 12px só para rótulo e metadado.
4. Nenhuma ação depende de hover.
5. Ação principal sempre alcançável com o polegar, sem o teclado ou a barra do navegador cobrirem.
6. Funciona instalado (modo standalone), com área segura respeitada.

---

## 3. Fases

Cada fase é um PR (ou poucos), mergeado e testado antes da próxima.

### Fase 0, Medir (sem mudar nada no produto)
- Script de auditoria que abre cada uma das 14 telas e as páginas públicas (`/login`, `/aprovacao/...`, `/relatorio/...`, `/f/...`) em 360, 390 e 768 e registra: rolagem horizontal, alvos abaixo de 44px, texto abaixo de 12px, elementos cortados.
- Capturas de tela de cada combinação, guardadas num relatório.
- Saída: lista ordenada das telas piores. Ela reordena a Fase 2 e a 4 se a medição discordar das estimativas acima.

### Fase 1, Fundação do shell (o maior retorno)

> **Status 04/11/2026:** implementada na branch `feat/mobile-fundacao` (altura em `dvh`, área segura, `viewport` com tema, barra inferior com Dashboard, Demandas, Calendário, Agendar e Mais, folha de baixo no `Dialog`/`Sheet`, área de toque de 44px em botão, ícone e campo com ponteiro de toque, ações de hover visíveis no toque). Conferido em 375px só numa página de teste; **falta olhar as telas logadas**. Ficou fora: botão "Criar" no topo do celular e o comportamento do botão voltar.
Mexe em poucos lugares e melhora tudo de uma vez.
- Altura em `dvh` no shell e nas telas com `calc(100vh-...)`.
- `viewport-fit=cover`, `theme-color` e variáveis de área segura (`env(safe-area-inset-*)`) na barra superior, na barra inferior e nas folhas.
- **Barra de navegação inferior** com 4 atalhos mais "Mais" (que abre a gaveta atual). Sugestão: Dashboard, Esteira, Calendário, Agendamentos. O conjunto é decisão sua (ver seção 5).
- **Folha de baixo no lugar do modal** abaixo de `sm`: cantos arredondados em cima, alça, `max-h` em `dvh`, rodapé fixo com a ação principal, espaço do teclado. Um único componente (`ResponsiveSheet`) que o `Dialog` e o `Sheet` passam a usar.
- **Alvo de toque por regra global:** em vez de caçar 158 botões, aumentar a área de toque dos primitivos (`Button`, `IconButton`, `Select`, chips) com a variante `pointer-coarse:` do Tailwind (confirmar a versão do Tailwind) e um pseudo-elemento que amplia só a área clicável.
- **Hover sumindo:** regra `@media (hover: none)` para mostrar sempre o que hoje aparece só no hover.
- Piso de tamanho de texto no celular para os componentes base.
- Botão "Criar" e ações rápidas do cabeçalho do desktop ganham equivalente no celular (hoje a barra superior só tem menu, busca, tema e avatar).
- Comportamento do botão voltar do celular entre telas (a navegação é por aba dentro de `page.tsx`; conferir se o voltar sai do app em vez de voltar de tela).

### Fase 2, Telas do dia a dia
Ordem pelo uso esperado no celular (a Fase 0 pode reordenar):
1. **Esteira e demanda:** `demanda-sheet` em tela cheia no celular, com a barra de metadados em rolagem horizontal e os comentários no fim; mover etapa com um toque.
2. **Aprovação** (interna): já boa; só alinhar à folha de baixo e ao piso de toque.
3. **Calendário:** a lista do celular ganha agrupamento por dia, atalho "hoje" e criar post a partir do dia.
4. **Rotina:** lista com marcar concluído por deslizar ou um toque grande.
5. **Dashboard:** cartões em uma coluna, números grandes, "o que exige ação" no topo.
6. **Agendamentos / postagem (`publish-panel`) — desenhar já para multiplataforma:** passos em uma tela cada (mídia, legenda, plataformas, data, revisar); seletor Instagram / Threads / TikTok em chips com o que cada uma aceita; prévia dentro de uma folha em vez de empilhar no fim; botão fixo "Agendar" no rodapé. Aqui vale quebrar o arquivo em partes (passos), porque o desktop usa o mesmo conteúdo.
7. **Inbox:** duas telas (lista de conversas, depois a conversa), campo de mensagem acima do teclado.
8. **Clientes e ficha:** abas roláveis, seções em sanfona, conectar contas (Instagram, Threads, TikTok) em cartões de toque.

### Fase 3, Relatórios e anúncios
- **Relatório público (`/relatorio/[token]`):** o cliente abre pelo celular, provavelmente por link no WhatsApp. É a tela de maior impacto externo; revisar primeiro nela: cartões de número em 2 colunas, gráficos que se ajustam à largura, leitura em uma coluna, carregamento rápido.
- **Painel de anúncios:** trocar a tabela por `DataTable` com modo celular (campanha como título, gasto e resultado como metadado), filtro de período numa folha, controle de campanha (pausar/ativar) com confirmação.
- Quando houver métricas por plataforma (Instagram, Threads, TikTok), abas com o mesmo padrão nas três.

### Fase 4, Telas densas (decidir tela a tela)
- **CRM:** funil no mesmo padrão da esteira (colunas em ímã); `crm-deal-drawer` em tela cheia; `crm-tabela` pelo `DataTable`.
- **Equipe / produtividade:** tabela para cartões; filtros numa folha.
- **Automações e `step-timeline`:** lista adaptada, edição de passo em tela cheia.
- **Contatos, UTM, Formulários:** listas por `DataTable`; criar e editar em folha.
- **Construtor de fluxo (canvas) e construtor de formulário:** são ferramentas de mesa. No celular, abrir em modo leitura com prévia e aviso "editar no computador". Não vale tentar um canvas de arrastar em tela de 6 polegadas.

### Fase 5, PWA (depende da Fase 1)
Manifest, ícones, service worker, push e central de notificações, conforme conversamos. Pode rodar em paralelo à Fase 2, pois mexe em arquivos diferentes. Sem a Fase 1 (área segura, `dvh`, barra inferior) o app instalado parece um site dentro de uma moldura.

### Fase 6, Manter assim
- Teste automático em 360px das telas-chave que falha se aparecer rolagem horizontal.
- Checklist de celular no modelo de PR.
- Componentes compartilhados (`ResponsiveSheet`, `PageHeader`, `FilterBar` que vira folha no celular, `StatGrid`) para a tela nova já nascer certa.
- Ao tocar num arquivo gigante, extrair uma parte; sem refatoração solta.

---

## 3B. Parte B, Design system (a partir do site de referência)

### O que a referência faz e vale entender

O site usa verde-floresta profundo (`#00251D`) como fundo, **um único verde-menta de ação** (`#00D898`, com texto escuro `#00281E` a 8,5:1) e faixas de papel claro (`#EEF2EC`) que alternam com o escuro. O que o torna coeso não é o verde em si, e sim quatro disciplinas:

1. **Cada tom tem um papel nomeado:** fundo, superfície, preenchimento, linha, tinta, tinta 2, ação. Nada de cor solta.
2. **Todo neutro tem o mesmo matiz da marca** (esverdeado), então a paleta parece uma só.
3. **Uma cor de ação por tela.** O amarelo (`#F0D100`) só aparece no hover do botão e o vermelho só na faixa de oferta.
4. **Escada curta e fixa:** raios 9/11/15/20 (botão 14, pill), sombras sempre em duas camadas, botão de 52px e de 40px, grade de pontos a 3% de opacidade.

Dentro do app que o site mostra, a interface é clara, com botão primário verde-escuro, status em pílula suave e **cor usada para organizar** (pastas verde, azul e laranja).

### Onde o GENSBot está (medido no código da `main`)

| O que | Medida | Efeito |
|---|---|---|
| Cores `#hex` escritas direto em componentes | ~186 | O `DESIGN.md` diz que isso não existe mais; o tema não consegue trocar essas cores |
| Cores cruas do Tailwind (`emerald-*`, `amber-*`...) em telas | ~190 (inclui a paleta de tags em `tag-colors.ts`, que é intencional) | Mesmo problema, em parte |
| Texto de 9, 10 e 11px | ~200 usos (`text-[11px]` 95, `text-[10px]` 85, `text-[9px]` 16) | O piso de 12px da v6 não está valendo |
| Escala de raios | 6 degraus em uso (`md` 67, `lg` 190, `xl` 385, `2xl` 222, `3xl` 40, `full` 215) mais 4 arbitrários (32, 38, 40, 48px) | Cartão, botão e controle sem papel definido |
| Botão | `sm`/`md`/`lg` definidos por padding, sem altura | Botão pequeno fica perto de 28px, abaixo do mínimo de toque |
| Dark mode | Preto neutro `#09090b` + lima `#d8ff3c` como único acento; claro em papel `#f7f8f2` com tinta `#192313` | Contraste já medido e bom (lima 17,3:1 no escuro, 15,7:1 no botão) |

### Decisão tomada em 04/11/2026: Floresta vira a marca do app

Você mandou os logos novos do GENSBot e escolheu usar os tons florestas como fundo, mantendo um tema claro com as mesmas cores. Isso **substitui** a decisão de 10/09 e 26/09 (preto neutro + lima) e a opção A abaixo. As três cores vêm dos próprios logos, lidas pixel a pixel:

| Cor | Hex | Onde |
|---|---|---|
| Floresta | `#014130` | Fundo dos logos; no escuro, a superfície de marca (menus, popover); no claro, o botão primário e o texto de marca |
| Menta | `#00DC94` | Ação no escuro (botão, estado ativo, foco, gráfico). **Nunca como texto no claro** (1,8:1) |
| Verde médio | `#018B61` | Barra do item ativo, ícones e preenchimentos. Não serve como texto em fundo branco (4,3:1); para texto no claro vira `#016D4B` (6,4:1) |

Os degraus escuros são o mesmo verde (matiz 164°) em brilhos crescentes, como o Linear faz com o cinza: fundo `#02241B`, menu lateral `#021D16`, cartão `#042F24`, popover `#014130`, hover `#084535`, borda `#114537`. O tema claro é papel esverdeado `#F2F8F6` com cartão branco, tinta `#02261D` e texto secundário `#4B6B60`. Todos os pares de texto passam de 4,5:1 nos dois temas (medido: texto principal 14,7:1 no escuro e 15,1:1 no claro; menta sobre o fundo 9,2:1; texto do botão menta 8,6:1; botão primário claro 11,7:1).

A prévia lado a lado está em `design/previa-floresta.html` (dois temas, mesmos componentes, mais as telas de celular com a barra inferior).

Pontos de atenção que a mudança traz:
- **Sucesso e ação agora são os dois verdes.** Para não confundir, ação é sempre botão cheio ou estado ativo, e sucesso é sempre pílula suave com ícone e texto. No escuro o sucesso fica em `#4ADE80` (mais amarelado que o menta); no claro, em `#047857`.
- **Gráficos precisam de matizes diferentes.** Série 1 menta, depois azul, âmbar, violeta e rosa. Comparação de períodos usa o mesmo verde apagado e forte.
- **Contorno de campo** mede 3,9:1 no escuro (`#4F8F7C`) e 3,5:1 no claro (`#6F8F84`), acima do mínimo de 3:1 para controles.
- **Usar `#014130` nos dois lados:** é a superfície de marca no escuro e o botão no claro, o que mantém a identidade igual nos dois temas.
- A diferença entre o lima do código (`#d8ff3c`) e o da paleta antiga (`#DBFF69`) deixa de importar: o lima sai do produto.

### Atualização: tema escuro da proposta 2 e layout da esteira

Você preferiu o tema escuro da proposta 2 (`design/previa-floresta-v2.html`), que **substitui os degraus escuros citados acima**: fundo `#00140F`, trilho e cartão `#04221A`, popover `#083026`, hover `#0B3A2E`, borda `#12392E`, mais as cores de papel sol `#FFD84D`, coral `#FF8A70`, céu `#6CC9FF` e lilás `#B9A5FF`. O claro continua existindo, ainda sem aprovação final.

A imagem do Orkestrya trouxe ideias de layout, aplicadas em `design/previa-floresta-v3-esteira.html`. A análise veio de uma foto em ângulo, então vale para a estrutura, sem valores exatos de cor ou tamanho.

| Levar | Como entra no GENSBot |
|---|---|
| Menu em trilho de ícones | Trilho flutuante no desktop, ampliando o modo recolhido que já existe, com o nome da tela no tooltip. No celular continua a barra inferior |
| Coluna com cor própria | Tinta de 10% da cor da etapa (títulos ≥ 7,2:1) |
| Miniatura da arte no cartão | Usa a primeira mídia da demanda (`arquivos`) |
| Filtros em pílula com contadores | Mês, cliente, busca e contador de atrasadas em coral |
| Dados por cartão | Tipo, status, cliente com cor própria, checklist, anexos e responsável |
| Textura de fundo | Curvas de nível a 5%, só no fundo da tela |

| Não levar | Por quê |
|---|---|
| Botão saturado em toda coluna | Compete com a ação principal; no GENSBot fica em tom suave |
| Fundo claro translúcido | O tema escolhido é o escuro, e transparência prejudica a leitura |

Decidido em 04/11/2026: a esteira **mantém as 13 etapas como colunas**, com rolagem lateral no desktop e uma coluna por vez no celular (a prévia mostra só 4 colunas como amostra). As cores são agrupadas, para o quadro não virar 13 cores: Planejar em céu (planejamento, copy), Produzir em lilás (criação da arte, gravação, edição), Revisar em sol (revisões de arte, interna, do cliente e de agendamento), Agendar em menta (agendamento, pronto para publicar, publicado) e Travado em coral.

### (Superada) Opções de cor que estavam em aberto

Aqui havia um conflito que precisava ficar explícito. A referência é **verde-floresta no fundo**. Em 10/09 e de novo em 26/09 você escolheu o escuro **preto neutro com lima só como destaque** e recusou o fundo esverdeado ("obsidian forest"). Além disso, a paleta oficial da agência (IDV) é `#0F0F0F`, `#304000`, `#4D8300`, `#DBFF69`, `#EBFFAD`, `#F9FFE8`, e o código usa `#d8ff3c` para o lima (vale conferir se essa diferença para `#DBFF69` é intencional).

| Opção | O que muda | Prós | Contras |
|---|---|---|---|
| **A. Tema "Floresta" opcional, e só nas telas do cliente (recomendada)** | O app interno continua preto + lima. Entra um tema novo `data-theme="floresta"` (fundo `#00251D`, ação `#00D898`) usado em relatório, aprovação, formulários públicos, login e tela de abertura do PWA | Usa a cor de que você gostou onde ela dá mais efeito (a primeira impressão do cliente), sem refazer o app nem contrariar a decisão da v5 e da v6. O tema pode ser comparado nas telas reais antes de virar padrão | Duas linguagens de cor convivem. Precisa de regra clara de quando usar cada uma |
| **B. Trocar o app todo para Floresta** | Reescreve os tokens escuros e claros | Identidade única | Repete o que foi rejeitado duas vezes; sai da paleta IDV; mexe em tudo de uma vez |
| **C. Só a estrutura, sem cor nova** | Adota as 4 disciplinas acima com a paleta atual | Sem risco de cor | Você não vê a cor que gostou |

Recomendo A. Antes de qualquer código, a Fase D0 monta uma **prévia lado a lado** (as mesmas 3 telas em preto+lima e em Floresta) para a decisão sair do olho, não da descrição.

### Fases do design system

**D0, Aprovar a prévia (sem código de produto).** A decisão de cor está tomada (Floresta). Falta você aprovar os degraus em `design/previa-floresta.html` (fundo, cartão, hover, bordas) e as cores de estado. Só depois disso `globals.css` muda.

**D0b, Trocar a marca (primeira entrega de código).** Reescrever os tokens de `:root` e `.dark` em `globals.css` com os valores da prévia, trocar os logos (ícone e logotipo, versões clara e escura, ícones do PWA e favicon) e atualizar o `DESIGN.md` para a v7. Como o app já usa tokens, a troca atinge as telas de uma vez; o que está com `#hex` ou cor crua (D1) é o que vai ficar fora do tema e precisa ser limpo em seguida. Fazer antes da Fase 1 do mobile, para os componentes novos já nascerem na marca nova.

**D1, Limpar o que já fugiu do sistema.** Trocar os `#hex` e as cores cruas por tokens, subir o texto de 9–11px para o piso de 12px (rótulo) ou 14px (leitura) e trocar raios arbitrários pela escada. Entra junto uma regra automática (script no CI, ou regra de lint) que **falha o PR** quando aparecer cor crua, texto menor que 12px ou raio fora da escada. Sem isso a limpeza volta em um mês. Fazer tela por tela, junto com a Fase 2 do mobile, para não abrir um PR gigante de visual.

**D2, Tokens estruturais (junto com a Fase 1 do mobile).**
- **Escada de raios com papel:** controle (campo, chip), botão, cartão e folha, mais `full`. Um nome por papel e nenhum valor solto.
- **Alturas de botão:** `sm` 36px, `md` 44px, `lg` 52px (a referência usa 52 e 40). No celular, nenhum botão abaixo de 44px de área de toque.
- **Estados do botão primário** documentados (hover, ativo, foco, desabilitado, carregando), no claro e no escuro.
- **Cor de foco** do anel igual à ação (como a referência faz), com offset de 2px.
- **Textura de marca:** tokens `--grid` e `--grid-strong` (3% e 5%) para fundo de login, telas vazias, páginas públicas e abertura do PWA. Nunca atrás de tabela ou formulário.
- **Comparação de períodos por saturação:** um par `--chart-prev` (apagado) e `--chart-now` (forte) na mesma matiz, para Métricas, Anúncios e Relatório (como o gráfico de 2024 contra 2025 da referência). Não depende de distinguir duas cores.
- **Movimento:** curva única e entrada em escada de 70ms por item em listas (entra na Onda 6 de movimento já prevista; respeita `prefers-reduced-motion`).

**D3, Polaridade nas páginas públicas.** O relatório do cliente e a aprovação ganham o desenho da referência: **faixa de abertura escura** com os números principais, **corpo claro** com cartões brancos e sombra leve, botão de ação no mesmo tom nas duas faixas. É onde "escuro promete, claro prova" faz sentido, e é a tela que o cliente abre no celular. Se a decisão for A, aqui entra o tema Floresta.

**D4, Cor para organizar, não para enfeitar.** Dar a cada cliente uma cor fixa de um conjunto fechado de 8 matizes (já existe `tag-colors.ts` como base, com contraste verificado nos dois temas) e usá-la no calendário, nos cartões da esteira, no relatório de anúncios e nas pastas de mídia. É a mesma ideia das pastas coloridas da referência e do Notion Calendar que você já citou. Pede um campo de cor no cliente.

**D5, Documentar e travar.** Atualizar o `DESIGN.md` para v7 (a data e o conteúdo dele precisam bater com o `globals.css`), gerar `design-tokens.json` no formato DTCG a partir do `globals.css` e, se fizer sentido, sincronizar as variáveis com o Figma. A referência fica em `design/referencia-novo-carrossel/`.

### O que NÃO copiar da referência

- **Tons de texto terciário.** Dois deles reprovam: `ink-3` sobre o escuro (3,65:1) e `l-ink-2` sobre o claro (4,16:1); `l-ink-3` chega a 2,27:1. O GENSBot já exige 4,5:1 e deve continuar assim.
- **Padrões de página de venda:** o botão repetido 15 vezes, a faixa de urgência, o vídeo que retoma sozinho. São de conversão e não servem para uma ferramenta de operação.
- **A família tipográfica.** O site usa Manrope e Rubik; o GENSBot usa Sora (também a fonte do site da agência) e DM Sans. Trocar não traria ganho.
- **O amarelo de hover.** Em um produto com lima como único acento, um segundo acento quebra a hierarquia que a v6 protegeu.

---

## 4. Ordem recomendada

`D0` (aprovar a prévia) → `D0b` (trocar a marca nos tokens e logos) → `Fase 0` (medir, já na marca nova) → `Fase 1` junto com `D2` (mesmos componentes base) → (`Fase 2` com `D1` tela por tela, e `Fase 5` em paralelo) → `Fase 3` junto com `D3` (relatório e anúncios) → `D4` → `Fase 4` → `D5` e `Fase 6` contínuas.

A Fase 3 pode subir antes da 2 se os relatórios para clientes forem mais urgentes.

## 5. Decisões que dependem de você

1. **Cor: decidida** (Floresta no app inteiro, escuro e claro). Falta só aprovar a prévia (D0).
2. **Quais 4 atalhos na barra inferior?** Sugestão: Dashboard, Esteira, Calendário, Agendamentos.
3. **Quem usa no celular hoje:** só você, a equipe, ou também clientes (relatório, aprovação, formulário)? Define quanto peso dar à Fase 3 e à D3.
4. **Construtores de fluxo e de formulário:** aceitar "somente leitura no celular"?
5. **Aparelhos de teste:** iPhone, Android ou os dois? iPhone é o mais exigente (barra do Safari, área segura, push só instalado).
6. **Cor por cliente (D4):** aceita um campo de cor no cadastro do cliente?

## 6. Como verifico cada fase
- Capturas em 360, 390 e 768 antes e depois, pelo navegador do app.
- Auditoria da Fase 0 reexecutada: a lista de problemas da tela tocada tem que zerar.
- Testes existentes continuam passando; sem mudança de comportamento no desktop.
- Teste final em aparelho de verdade, por você, antes de eu seguir para a próxima fase.
