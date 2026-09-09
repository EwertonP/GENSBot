# GENSBot — Plano de Redesign 2.0 (Identidade Visual + Dashboard/Métricas/Publicações)

> Documento único, pra abrir numa sessão nova do Claude Code e seguir a
> partir daqui. Substitui o plano parcial que estava em
> `~/.claude/plans/moonlit-seeking-kurzweil.md` (mesmo conteúdo, só que
> completo e revisado com a paleta da agência confirmada).
>
> **O que já está pronto e mergeado, não faz parte deste plano**: Fases
> 0-3 do redesign visual anterior (tokens size-specific de tracking,
> `prefers-reduced-motion`, componentes primitivos em `src/components/ui/`,
> `motion`/`Sheet`/nav deslizante/toast, chrome translúcido, primitivos
> aplicados nas 7 telas) — PRs #58-#61, tudo em `main`. A feature de
> Publicação de Conteúdo (posts/reels/stories, agendamento, métricas por
> post) também já está em produção — PR #57.

## Contexto

Depois do redesign visual (Fases 0-3), o usuário revisou o app e decidiu
duas coisas em paralelo:

1. **Identidade visual**: trocar a paleta atual ("Oat & Clay", terracota)
   pela paleta oficial da agência GENS (fornecida pelo usuário, ver
   Parte 1) — e usar essa paleta em **todos os projetos da agência daqui
   pra frente**, não só no GENSBot (já registrado em memória de longo
   prazo).
2. **Funcionalidade**: Dashboard, Métricas e Publicações foram desenhados
   só pensando em automação de DM — precisam virar ferramentas de
   gerenciamento de conta de verdade (métricas de publicação, ranking de
   posts/stories, cliques em link de bio vs DM, período configurável,
   crescimento de seguidores, composer com preview fiel e agendamento
   decente). Contatos/Leads fica como está, só recebe o polimento visual
   dos itens 1.

Antes de desenhar a Parte 2/3 o usuário pediu pra eu estudar 3
referências de dashboards SaaS (Nexus, Corelystic, um app de logística
com "Document Automation") e extrair padrões de componente reaplicáveis
— não a estética deles (cores roxo/azul não têm relação com a marca),
mas a estrutura: como cards de KPI, gráficos e tabelas são montados.

---

## Parte 1 — Identidade visual: paleta da agência GENS

### Os 6 hex (fornecidos pelo usuário, IDV oficial da agência)

| Hex | Descrição |
|---|---|
| `#0F0F0F` | Quase-preto |
| `#304000` | Verde-oliva escuro |
| `#4D8300` | Verde-oliva médio |
| `#DBFF69` | Lima/amarelo-esverdeado vibrante |
| `#EBFFAD` | Lima muito claro |
| `#F9FFE8` | Quase-branco com leve matiz lima |

### Mapeamento pra tokens semânticos (confirmado pelo usuário)

| Token (`globals.css`) | Tema claro | Tema escuro |
|---|---|---|
| `--background` | `#F9FFE8` | `#0F0F0F` |
| `--foreground` | `#0F0F0F` | `#F9FFE8` |
| `--primary` | `#4D8300` | `#DBFF69` |
| `--primary-foreground` | `#F9FFE8` | `#0F0F0F` |
| `--accent` (fundo) | `#EBFFAD` | `#304000` |
| `--accent-foreground` | `#304000` | `#DBFF69` |
| `--card`/`--popover` | branco puro (derivado, levemente mais claro que o bg) | derivado escuro entre `#0F0F0F` e `#304000` |
| `--border`/`--input` | derivado (entre `#EBFFAD` e um cinza neutro) | derivado escuro |
| `--success`/`--warning`/`--destructive` | **mantém os tokens semânticos atuais** (verde/âmbar/vermelho já existem e não fazem parte da paleta de marca — são indicadores de status, não de identidade) | idem |

### Contraste — verificado com WCAG 2.1 real (script `check_contrast.py`), não estimado

| Par | Contraste | Resultado |
|---|---|---|
| `#0F0F0F` texto / `#F9FFE8` fundo | 18.71:1 | ✅ AAA |
| `#F9FFE8` texto / `#0F0F0F` fundo | 18.71:1 | ✅ AAA |
| `#F9FFE8` texto / `#4D8300` fundo (botão primário, tema claro) | **4.49:1** | ✅ AA texto grande · ❌ AA texto normal (falha por 0.01) |
| `#0F0F0F` texto / `#DBFF69` fundo (botão primário, tema escuro) | 16.9:1 | ✅ AAA |
| `#304000` texto / `#EBFFAD` fundo (accent, tema claro) | 10.46:1 | ✅ AAA |
| `#DBFF69` texto / `#304000` fundo (accent, tema escuro) | 9.96:1 | ✅ AAA |

**Regra prática daqui**: `#4D8300` como fundo de botão com texto
`#F9FFE8` só é seguro pra **texto grande/negrito** (≥14px bold ou ≥18px
regular) — que é exatamente o padrão que o `Button` primitivo já usa
(`font-bold`, `text-sm`/`text-xs`). **Nunca** usar essa combinação pra
texto corrido pequeno normal (parágrafo, legenda) dentro de um bloco de
fundo `#4D8300` — nesse caso, usar `#4D8300` só como texto sobre fundo
claro (`#F9FFE8`), não o inverso.

### Tipografia — **em aberto, precisa de resposta do usuário**

O usuário mencionou "até as cores e fontes" mas não especificou fontes
novas. Não vou inventar uma família tipográfica nova sem confirmação —
isso é justamente o tipo de suposição que a auditoria anterior evitou.
**Pergunta pra próxima sessão**: manter Inter (fonte atual, `--font-sans`
em `globals.css`) ou trocar por outra? Se trocar, por qual e por quê
(a paleta lima/verde-oliva/preto combina bem tanto com uma sans neutra
tipo Inter/Geist quanto com algo mais geométrico/técnico — depende do
tom que a agência quer: mais "tech/SaaS" ou mais "editorial/orgânico").

### O que muda tecnicamente

Só os **valores** dos tokens em `src/app/globals.css` (`:root` e
`.dark`) — a arquitetura de tokens (`--background`, `--primary`, etc.,
consumida via `@theme inline` e usada em todo componente com classes
Tailwind como `bg-primary`/`text-foreground`) não muda. Ou seja: trocar 2
blocos de ~15 variáveis cada é suficiente pra repintar o app inteiro,
sem tocar em nenhum componente — o sistema de tokens da Fase 0 foi
desenhado exatamente pra isso ser barato.

---

## Parte 2 — Padrões de componente das referências (não estética, estrutura)

Aprendizados das 3 imagens analisadas, mapeados pro que o GENSBot precisa:

| Padrão observado | Onde | Aplicação no GENSBot |
|---|---|---|
| Card de KPI com sparkline/delta embutido | Nexus, Corelystic, Logistics | Cards de resumo do Dashboard 2.0 — em vez de só um número, mostra a tendência do período junto |
| Gráfico de linha com tooltip no ponto (hover mostra valor+data) | Corelystic | Gráfico de alcance por período em Métricas 2.0 |
| Linha horizontal de cards roláveis, cada um com menu "⋯" (ver/baixar/editar/compartilhar) | Logistics | "Top Publicações"/"Stories em destaque" no Dashboard — cada card = 1 post publicado, com ações rápidas |
| Tabs de filtro acima de uma tabela/lista (All/Pending/Signed) | Logistics | Lista de Publicações — filtrar por Agendado/Publicado/Falhou/Cancelado em vez de só cor de badge |
| Header fixo com seletor de período + filtro + exportar sempre visíveis | Nexus, Corelystic | Cabeçalho de Métricas e Dashboard — hoje não existe período nem exportação |
| Sidebar com seções nomeadas (categorias de nav) | Nexus | Já é o padrão do GENSBot (Operações/Sistema) — confirma que está certo, não precisa mudar |
| Gradiente usado só num elemento de destaque por tela (CTA/badge), nunca no fundo | Logistics | Reservar pra 1 elemento no máximo (ex: botão "Publicar" ou badge de "sugestão de horário") — não usar a paleta em degradê espalhado |

---

## Parte 3 — Dashboard 2.0

Sem tirar nada do que já existe (funil de automação, ranking, health,
diagnóstico de falha continuam) — adiciona uma seção nova, usando o
padrão de card-com-sparkline + linha de cards roláveis da Parte 2:

1. **Cards de resumo** (com sparkline): publicações no período (post/
   reels/story separados), alcance total, taxa média de engajamento.
2. **Top Publicações** (linha horizontal rolável, card com thumbnail +
   número + menu "⋯"): as N publicações com mais alcance/interações no
   período.
3. **Stories em destaque**: mesmo padrão, filtrado a `media_type=STORIES`.
4. **Cliques em Links**: bio vs DM lado a lado (dado já existe em
   `utm_links` — `automation_id IS NULL` = bio, `IS NOT NULL` = DM).

**Endpoint novo**: `GET /api/dashboard/content-performance?account=&period=`
— agrega os 4 pontos numa chamada, reaproveitando `media-insights` e
`scheduled_posts` que já existem.

---

## Parte 4 — Métricas 2.0

1. **Seletor de período** (7d/30d/90d — 90d é o teto de retenção da
   Meta), no cabeçalho, no padrão "Nexus" (dropdown + filtro).
2. **Gráfico de alcance/visitas de verdade** — série temporal com o
   período escolhido e tooltip no ponto (padrão "Corelystic"), não a
   barra fixa de 7 dias atual.
3. **Crescimento de seguidores** — gráfico de linha usando a métrica real
   `follower_count` (`period=day`, `since`/`until`). **Contas com menos
   de 100 seguidores não recebem esse dado da própria Meta** — mostrar
   uma mensagem explicando isso, não um gráfico vazio.
4. **Crescimento de publicações** — não vem da Meta como série temporal;
   deriva de `scheduled_posts.published_at` (dado nosso, mais confiável).
5. Mantém os dois modos que já existem (grid "todas as contas" / detalhe
   de uma conta).

**Risco a verificar ao implementar, não presumir**: uma fonte secundária
aponta `profile_views` como depreciado desde a v22 da Graph API (a favor
de `views`/`reach`/`follower_count`) — mas é o metric que já funciona em
produção hoje (v25). Confirmar contra a resposta real da API antes de
trocar qualquer metric que já está funcionando.

---

## Parte 5 — Publicações 2.0

Reformula o composer pra duas colunas:

**Coluna esquerda (composer em etapas)**:
1. **Conta** — sempre visível e selecionável (chip/dropdown), nunca
   escondida mesmo com 1 conta só, pra nunca publicar "sem saber onde"
   por engano.
2. **Mídia** — upload múltiplo quando carrossel; tipo (Post/Reels/Story)
   auto-detectado ou escolhido.
3. **Legenda + hashtags**.
4. **Colaboração**:
   - Post/Reels/Carrossel: até 3 colaboradores (`collaborators` da Graph
     API — precisam aprovar dentro do próprio Instagram deles, avisar
     isso na UI).
   - Story: só marcar pessoas (`user_tags`) — **sem opção de link**,
     porque a Graph API **não suporta** link/localização/enquete em
     sticker de Story (confirmado na documentação oficial da Meta,
     `POST /{ig-user-id}/media`). Deixar isso explícito na interface em
     vez de fingir que funciona.
5. **Agendamento** — componente de calendário/hora próprio (nada de
   `<input type=datetime-local>` cru), com spring de abrir/fechar
   (`motion`, já instalado), "Publicar agora" vs "Agendar", e a
   **sugestão de melhor horário** (ver abaixo).

**Coluna direita (preview fiel, atualiza ao vivo)**:
- Post/Carrossel: moldura de post real do Instagram (header com avatar/
  username, mídia, ícones de curtir/comentar, legenda) — carrossel
  navega com seta/swipe, com pontinhos de página.
- Reels: `<video>` com controles, moldura vertical.
- Story: moldura 9:16 com barra de progresso de 15s animando no topo.

**Sugestão de melhor horário pra postar** (adicionado a pedido do
usuário, inspirado no Metricool — mas **honesto com os dados que o
GENSBot realmente tem**, sem fingir ter uma base de bilhões de contas
como o Metricool tem):
- Agrega os próprios posts já publicados da conta (`scheduled_posts` +
  `reach`/`total_interactions` via `media-insights`) por dia da semana ×
  faixa de horário, destaca os 2-3 melhores blocos como sugestão
  clicável no calendário.
- Conta nova/sem histórico suficiente (~10 posts): mostra "ainda não há
  dados suficientes pra sugerir um horário" em vez de inventar.
- Não faz chamada nova à Meta — só agregação sobre dado que já é nosso.

**Backend**: `instagram-publish.ts` ganha suporte a carrossel
(`createCarouselContainer` — N containers filhos `is_carousel_item:true`
+ 1 container pai `media_type:CAROUSEL, children:[...]`, até 10 itens,
Reels não pode entrar em carrossel) e os campos `collaborators`/
`user_tags` nas chamadas já existentes; `scheduled_posts` ganha colunas
aditivas (`collaborators jsonb`, `user_tags jsonb`) — sem quebrar nada
que já está em produção.

---

## Parte 6 — Contatos/Leads

Sem mudança de funcionalidade — já recebeu os primitivos na Fase 3, só
herda a nova paleta automaticamente (por ser via tokens).

---

## Fora de escopo (documentado, não esquecido)

- Link sticker em Story — bloqueado pela própria API da Meta.
- Snapshot histórico de métricas além dos 90 dias que a Meta retém —
  precisaria de tabela de snapshot diário + cron novo; avaliar depois se
  90 dias não for suficiente na prática.

---

## Fases de implementação sugeridas (cada uma um PR)

1. **Identidade visual** (Parte 1) — troca só os valores de token em
   `globals.css`. Baixo risco, alto impacto visual imediato, e destrava
   ver a paleta nova em produção rápido antes de construir feature nova
   em cima dela. **Fazer primeiro.**
2. **Publicações 2.0** (Parte 5) — composer 2 colunas + preview fiel +
   calendário + colaboradores/marcações + sugestão de horário.
3. **Carrossel** — pode andar junto da 2 (o preview de carrossel já pede
   a mídia múltipla existir).
4. **Métricas 2.0** (Parte 4) — período + crescimento.
5. **Dashboard 2.0** (Parte 3) — depende dos endpoints que a fase 4 já
   vai ter testado.

---

## Perguntas em aberto pra próxima sessão

1. **Tipografia** — manter Inter ou trocar? Se trocar, por qual fonte?
2. Confirmar visualmente o mapeamento de tokens da Parte 1 assim que a
   troca for aplicada (contraste foi verificado matematicamente, mas
   vale o olho humano numa tela real antes de seguir pras partes 3-5).

## Verificação

- `npx tsc --noEmit` limpo a cada fase.
- Fase 1 (cores): abrir o app logado, comparar tema claro e escuro,
  conferir que texto continua legível em todo botão/badge/card.
- Fases 2-5: sem login disponível nesta sessão de planejamento pra testar
  contra a API real — ao implementar, confirmar contra a resposta real
  da Graph API o metric ainda válido pra `profile_views`/`follower_count`
  na v25 (não supor), e testar de verdade um post com colaborador e um
  carrossel de 2-3 itens antes de considerar pronto.

## Arquivos principais

- `src/app/globals.css` (edição — Parte 1, tokens de cor)
- `src/app/api/dashboard/content-performance/route.ts` (novo — Parte 3)
- `src/app/api/instagram/insights/route.ts` (edição — período variável, Parte 4)
- `src/lib/instagram-publish.ts` (edição — carrossel, collaborators, user_tags, Parte 5)
- `src/lib/best-posting-time.ts` (novo — Parte 5)
- `supabase/migrations/<nova>_scheduled_posts_collab.sql` (novo — colunas aditivas)
- `src/components/publish-panel.tsx` (reescrita — Parte 5)
- `src/components/ui/calendar-picker.tsx` (novo — Parte 5)
- `src/components/metrics-panel.tsx` (edição — Parte 4)
- `src/app/page.tsx` (edição — Parte 3)
