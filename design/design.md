---
version: anydesign-1
name: Agência GENS — Sistema Unificado
source: https://www.agenciagens.com.br/servicos/
captured_at: 2026-09-18
description: |
  Identidade verde-oliva editorial com um único acento de alta voltagem (verde-limão
  #d8ff3c). Tipografia Sora com tracking negativo agressivo nos displays e tracking
  positivo nos eyebrows em caixa alta. A assinatura visual é a sombra dura sem blur
  (offset sólido), que dá um ar de adesivo/impressão a um sistema que, fora isso, é
  contido e arejado.

colors:
  paper: "#f7f8f2"
  hero-soft: "#edf4d8"
  ink: "#192313"
  deep: "#162d16"
  muted: "#59614f"
  lime: "#d8ff3c"
  brand: "#bada55"
  line: "#d9dfce"
  line-strong: "#bac8a1"
  line-deep: "#657e48"
  shadow-soft: "#58753515"
  shadow-ink: "#1b2b1820"
  shadow-solid: "#bdd094"

typography:
  eyebrow:
    fontFamily: "Sora, sans-serif"
    fontSize: 13px
    fontWeight: 600
    letterSpacing: 0.15em
    textTransform: uppercase
  display:
    fontFamily: "Sora, sans-serif"
    fontSize: clamp(38px, 5vw, 70px)
    fontWeight: 600
    letterSpacing: -0.055em
    lineHeight: 1.05
  h1:
    fontFamily: "Sora, sans-serif"
    fontSize: clamp(42px, 4.3vw, 64px)
    fontWeight: 600
    letterSpacing: -0.05em
    lineHeight: 1.1
  h2:
    fontFamily: "Sora, sans-serif"
    fontSize: clamp(34px, 4.1vw, 55px)
    fontWeight: 600
    letterSpacing: -0.04em
    lineHeight: 1.15
  h3:
    fontFamily: "Sora, sans-serif"
    fontSize: clamp(20px, 2.2vw, 28px)
    fontWeight: 600
    letterSpacing: -0.035em
    lineHeight: 1.3
  body:
    fontFamily: "Sora, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Sora, sans-serif"
    fontSize: 14px
    fontWeight: 500
    letterSpacing: 0.08em
    textTransform: uppercase

spacing:
  base: 4px
  scale: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128]

rounded:
  xs: 3px
  sm: 5px
  md: 8px
  lg: 12px
  xl: 20px
  bubble: 10px 10px 10px 0
  full: 50%

shadow:
  soft: "5px 5px 0 0 #58753515"
  strong: "7px 8px 0 0 #1b2b1820"
  solid: "9px 9px 0 0 #bdd094"

motion:
  ease: cubic-bezier(.16, 1, .3, 1)
  fast: 0.2s
  base: 0.25s
  slow: 0.5s

components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 18px 28px
  button-lime:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 18px 28px
  card:
    backgroundColor: "{colors.paper}"
    border: "1px solid {colors.line}"
    rounded: "{rounded.lg}"
    padding: 32px
    boxShadow: "5px 5px {colors.shadow-soft}"
  card-deep:
    backgroundColor: "{colors.deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: 32px
  badge-number:
    backgroundColor: "transparent"
    border: "1px solid {colors.line-deep}"
    rounded: "{rounded.full}"
    typography: "{typography.label}"
  chat-bubble:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
    padding: 12px 18px
  shadow-hard:
    boxShadow: "{shadow.soft}"
    boxShadowStrong: "{shadow.strong}"
    boxShadowSolid: "{shadow.solid}"
---

# Design Analysis — Agência GENS

> Análise gerada com a skill `anydesign`.
> Data: 2026-09-18
> Ênfase: design system + reconstrução (base visual do Sistema Unificado GENS)

---

## Source

- **Tipo**: URL
- **URL**: `https://www.agenciagens.com.br/servicos/`
- **Método de captura**: HTML via navegador + extração de CSS custom properties do stylesheet `servicos-DEsWTkM2.css` + leitura direta do CSS (radii, tipografia, sombras, transições)
- **Limitações detectadas**: só material desktop observado; breakpoints inferidos das funções `clamp()`, não de media queries lidas. Estados de hover/focus não capturados.

---

## TL;DR

Sistema verde-oliva editorial construído sobre 9 CSS custom properties explícitas, com um único acento de alta voltagem (`{colors.lime}` #d8ff3c). Tipografia **Sora** com tracking negativo agressivo (até -0.08em) nos títulos e tracking positivo (+0.15em) nos eyebrows em caixa alta — o contraste entre esses dois extremos é o que dá o ritmo editorial. **O traço mais distintivo é a sombra dura sem blur** (`5px 5px`, `9px 9px`), que precisa ser replicada no sistema interno ou a identidade se perde.

---

## 1. Visual identity

### 1.1 Surface description

**Personalidade**: editorial, orgânica, confiante, terrosa, levemente artesanal

**Mood**: profissionalismo sem frieza corporativa — uma agência que trabalha com tecnologia mas não se apresenta como startup de SaaS

**Referências estilísticas detectáveis**: editorial print contemporâneo com toques de neo-brutalismo suave (sombra sólida deslocada, bordas de 1px visíveis). Não é Linear/Vercel (frio, azul, neutro) nem Material. Mais próximo de estúdios de branding europeus.

**Densidade de informação**: equilibrada tendendo a arejada

**Posicionamento implícito**: fala com donos de PME — gente que decide rápido, não com times de produto. Daí a ausência de jargão visual de SaaS.

**Confiança**: ✅ alta

### 1.2 Brand voice / Atmosphere

O design acredita que o público **não quer parecer pequeno, mas também desconfia de quem parece grande demais**. Toda escolha estética se alinha a isso: a paleta é verde-oliva e bege (cores de matéria, não de interface), a tipografia é geométrica mas com desenho levemente excêntrico (Sora tem terminais e um `g` que fogem do neutro), e o logo é traçado à mão. Nada disso é acidental — é uma agência dizendo "somos sofisticados, mas você vai falar com uma pessoa".

O verde-limão é o único ponto de voltagem alta no sistema inteiro, e ele funciona justamente porque **todo o resto é contido**. Se a paleta tivesse um segundo acento vibrante, o limão viraria só "uma das cores" e a marca perderia seu gancho de reconhecimento. A disciplina de alocação de cor aqui é mais importante que a escolha das cores em si.

A sombra dura sem blur é o gesto que amarra tudo: ela nega a profundidade fotorrealista que todo dashboard moderno usa, e afirma uma lógica de **impressão** — camadas de papel, adesivo, serigrafia. É o que impede o site de parecer "mais um template de agência".

### 1.3 The "ONE brand thing"

- **A coisa**: a **sombra sólida deslocada sem blur** — `box-shadow: 5px 5px #58753515`, `9px 9px #bdd094`
- **Por que carrega a marca**: é o único elemento que nenhum concorrente replicaria por acidente. Trocar por `box-shadow: 0 4px 12px rgba(0,0,0,.08)` transforma o site num template genérico de agência, mantendo cores e fonte intactas.
- **Como o resto sustenta**: raios de borda pequenos (3–12px, não 24px), bordas de 1px visíveis, paleta de baixa saturação exceto o limão. Tudo isso é "plano" — a sombra dura é a única profundidade declarada.
- **Onde aparece (e onde não)**: em cards e elementos flutuantes. **Não** aparece em botões nem em texto.

*Confiança*: ✅ alta — extraído direto do CSS, cinco variações do mesmo padrão.

---

## 2. Design System (tokens)

### 2.1 Colors

Todos extraídos como CSS custom properties explícitas — confiança máxima.

| Token | Hex | Papel | Onde aparece | Confiança |
|---|---|---|---|---|
| `paper` | `#f7f8f2` | Fundo base | Body, cards claros | ✅ alta |
| `hero-soft` | `#edf4d8` | Fundo de seção suave | Bandas de hero, seções alternadas | ✅ alta |
| `ink` | `#192313` | Texto principal / botão primário | Títulos, corpo, CTA | ✅ alta |
| `deep` | `#162d16` | Superfície escura | Cards de destaque, footer | ✅ alta |
| `muted` | `#59614f` | Texto secundário | Legendas, descrições | ✅ alta |
| `lime` | `#d8ff3c` | Acento de marca (alta voltagem) | Header, CTAs, badges, bolhas | ✅ alta |
| `brand` | `#bada55` | Verde de marca secundário | Detalhes, ícones | ✅ alta |
| `line` | `#d9dfce` | Borda padrão | Divisores, contorno de card | ✅ alta |
| `line-strong` | `#bac8a1` | Borda com mais presença | Cards em destaque | ⚠️ média — hardcoded, não é var |
| `line-deep` | `#657e48` | Borda escura sobre fundo claro | Badges circulares | ⚠️ média — hardcoded |
| `shadow-soft` | `#58753515` | Sombra dura translúcida | Cards padrão | ✅ alta |
| `shadow-ink` | `#1b2b1820` | Sombra dura mais escura | Cards elevados | ✅ alta |
| `shadow-solid` | `#bdd094` | Sombra dura **opaca** verde | Elemento de maior destaque | ✅ alta |

**Não há dark mode detectável no site.** O sistema interno vai precisar inventá-lo — recomendação em Open Questions.

### 2.2 Typography

- **Família detectada**: `Sora` *(confiança: ✅ alta — lida direto do CSS)*
- **Fallback sugerido**: `Sora, system-ui, sans-serif`

**Escala observada** (todas fluidas via `clamp()`):

| Token | Tamanho | Peso | Line-height | Tracking | Uso |
|---|---|---|---|---|---|
| `display` | clamp(38px, 5vw, 70px) | 600 | 1.05 | -0.055em | Título de hero |
| `h1` | clamp(42px, 4.3vw, 64px) | 600 | 1.1 | -0.05em | Título de seção |
| `h2` | clamp(34px, 4.1vw, 55px) | 600 | 1.15 | -0.04em | Subseção |
| `h3` | clamp(20px, 2.2vw, 28px) | 600 | 1.3 | -0.035em | Título de card |
| `body` | 16px | 400 | 1.65 | 0 | Texto corrido |
| `label` | 14px | 500 | 1.4 | +0.08em | Rótulos, metadados |
| `eyebrow` | 13px | 600 | 1.2 | +0.15em | Kicker em caixa alta |

**Tracking é o traço de cuidado tipográfico aqui**: negativo e agressivo nos displays (até -0.08em observado), positivo e generoso nos eyebrows (+0.08em a +0.15em). Essa polaridade é deliberada.

**Teto de peso: 700**, mas 500 é o peso operário do site (8 ocorrências vs 2 de 700). Não existe peso 800/900.

### 2.3 Spacing

- **Unidade base inferida**: 4px
- **Confiança**: ⚠️ média — o CSS usa valores diretos, não uma escala declarada. A escala em `{spacing.scale}` é uma proposta coerente, não uma extração.

### 2.4 Radii

O sistema usa **raios pequenos**, não os 20–24px típicos de dashboards modernos:

- `{rounded.xs}` (3px): elementos pequenos, tags
- `{rounded.sm}` (5px): botões, inputs — **o raio mais comum depois de círculos**
- `{rounded.md}` (8px)
- `{rounded.lg}` (12px): cards
- `{rounded.xl}` (20px): exceção, poucos elementos grandes
- `{rounded.full}` (50%): badges numerados, avatares, ícones circulares — **13 ocorrências, o padrão mais frequente do site**
- `{rounded.bubble}` (10px 10px 10px 0): bolha de chat, com o canto inferior-esquerdo reto

### 2.5 Elevation system

**Sistema de dois níveis apenas, e ambos usam sombra dura sem blur.**

| Nível | Nome | Tratamento | Uso |
|---|---|---|---|
| 0 | Plano | Sem sombra, `1px solid {colors.line}` | Cards padrão, seções |
| 1 | Offset suave | `4px 5px {colors.shadow-soft}` ou `5px 5px` | Cards de conteúdo |
| 2 | Offset forte | `7px 8px {colors.shadow-ink}` | Cards em destaque |
| 3 | Offset sólido | `9px 9px {colors.shadow-solid}` (opaco) | O elemento mais importante da tela |

**Nenhuma sombra tem blur radius.** Isso não é omissão — é o gesto de marca (ver §1.3).

#### Decorative depth

- **Inversão de polaridade**: bandas claras (`{colors.paper}`, `{colors.hero-soft}`) alternam com cards escuros (`{colors.deep}`) — a profundidade vem da troca de superfície, não de sombra.
- **Faixa de marca**: o header usa `{colors.lime}` como banda sólida de largura total.

### 2.6 Borders

- Cor base: `{colors.line}` (#d9dfce), espessura 1px
- Variantes: `{colors.line-strong}` (#bac8a1), `{colors.line-deep}` (#657e48), `1px solid {colors.ink}` para contornos de alto contraste
- Caso especial: `5px solid #53684b` e `3px solid white` — molduras de imagem/avatar
- **Estados de foco não capturados** — precisam ser definidos.

### 2.7 Accessibility quick-check

Relatório completo em `design-a11y.md`. Resumo do que importa:

- `ink` sobre `paper`: **15.23:1** — AAA ✅
- `ink` sobre `lime`: **14.16:1** — AAA ✅ (limão como superfície é excelente)
- **branco sobre `lime`: 1.15:1 — falha total ❌** (praticamente invisível)
- `muted` sobre `paper`: **6.06:1** — AA ✅, AAA ❌ (ok para corpo, não para texto pequeno crítico)
- `lime` sobre `deep`: **12.87:1** — AAA ✅

---

## 3. Components Inventory

### 3.1 Generic components

#### button-primary

- Fundo `{colors.ink}`, texto `{colors.paper}`, raio `{rounded.sm}` (5px)
- **Conteúdo**: texto em `{typography.label}` + ícone de seta à direita
- **Transição**: `transform .25s, background .25s`
- **Confiança**: ✅ alta

#### button-lime

- Fundo `{colors.lime}`, texto `{colors.ink}` — nunca texto branco (ver §2.7)
- Mesmo raio e padding do primário; usado como ação secundária de alto destaque
- **Confiança**: ⚠️ média — inferido da faixa de header, não observado como botão isolado

#### card

- Fundo `{colors.paper}`, `1px solid {colors.line}`, `{rounded.lg}`, sombra dura `{components.shadow-hard}` nível 1 (`5px 5px {colors.shadow-soft}`)
- Rodapé com divisor tracejado + rótulo à esquerda e número à direita ("Anúncios … 01")
- **Confiança**: ✅ alta

#### card-deep

- Fundo `{colors.deep}`, texto `{colors.paper}`, sem sombra
- Usado como quebra de ritmo — aproximadamente 1 a cada 4 cards
- **Confiança**: ✅ alta

#### badge-number

- Círculo `{rounded.full}`, borda `1px solid {colors.line-deep}`, número em `{typography.label}`
- **Confiança**: ✅ alta — 13 ocorrências de `border-radius:50%`

### 3.2 Signature components

#### chat-bubble

- **O que é**: bolha de conversa dentro de um card escuro, em `{colors.lime}` com canto inferior-esquerdo reto (`{rounded.bubble}`)
- **Por que é signature**: combina os três gestos de marca de uma vez — limão como superfície, raio assimétrico, e contexto de conversa (que é literalmente o serviço vendido)
- **Onde aparece**: card de Automação no WhatsApp
- **Confiança**: ✅ alta

#### shadow-hard

- **O que é**: a utility de sombra dura em três intensidades — `5px 5px {colors.shadow-soft}`, `7px 8px {colors.shadow-ink}` e `9px 9px {colors.shadow-solid}`, todas sem blur radius
- **Por que é signature**: ver §1.3. É o elemento que carrega a marca sozinho. Precisa existir como utility no Tailwind desde o primeiro commit.
- **Confiança**: ✅ alta

---

## 4. Layout & Composition

### 4.1 Grid & containers

- Larguras máximas de coluna de texto observadas: 330–800px (a mais comum: 600px)
- Não foi encontrado um `max-width` de container de página em px — provavelmente usa % ou `clamp()`
- Hierarquia estabelecida por **tamanho + tracking**, não por saturação de cor

### 4.2 Composition patterns

- Hero alinhado à esquerda (não centralizado) com eyebrow + display + parágrafo + CTA
- Grade de cards de serviço com numeração sequencial (01…09)
- Bandas alternadas `paper` / `hero-soft` para separar seções
- Acordeão de FAQ com `+` que rotaciona (`transition: rotate .2s`)

### 4.3 Responsive behavior

**Só material desktop capturado.** Os breakpoints abaixo são inferidos das funções `clamp()`:

| Nome | Largura | Evidência |
|---|---|---|
| Mobile | < 600px | `clamp(32px, 8.5vw, 43px)` — o `8.5vw` domina abaixo de ~500px |
| Desktop | ≥ 1280px | displays travam no teto (70px, 64px) |

A tipografia é **fluida por padrão** — não depende de media queries para escalar. Isso é uma boa prática que vale herdar.

#### Touch targets

- CTA primário: altura estimada ~56px (padding 18px + linha) — ✅ acima do mínimo de 44px
- **Não verificado** para badges circulares e ícones de acordeão.

### 4.4 Image behavior

- **Logo**: SVG traçado à mão, em `{colors.ink}` sobre a faixa `{colors.lime}`
- **Ícones decorativos**: asteriscos (✳) e doodles lineares, traço fino, usados como marcadores de seção
- **Mockups de produto**: cards inclinados com leve rotação, dentro de containers com sombra dura
- **Fotografia**: não observada no material capturado

---

## 5. Reconstruction Notes

### Suggested stack

**Tailwind CSS v4 + shadcn/ui**, com os tokens acima mapeados em `@theme`.

Justificativa: o sistema tem poucos tokens e muita repetição de padrão — perfeito para utilitários. shadcn dá os primitivos acessíveis (dropdown, dialog, combobox) que um dashboard precisa e o site institucional não tem. A customização fica em três pontos: paleta, fonte Sora e a sombra dura (uma utility custom `shadow-hard`).

### Herança do `plataforma-agencia`

O projeto antigo tem um design system maduro em `plataforma-agencia/design/DESIGN.md` (v2, 13/08) — derivado de Kelp CRM e Untitled UI, com **Inter** e verde-musgo `#54733a`. **A paleta e a fonte não se aplicam** (não são da marca GENS), mas três coisas valem herdar:

1. **A regra dos 7 estados** — nenhum componente vai pro código sem vazio, carregando, erro, sucesso, hover, foco e desabilitado pensados.
2. **A paleta de status do pipeline de conteúdo** (`draft`, `in_review`, `changes_requested`, `approved`, `scheduled`, `published`) — mapeia direto na esteira de status do sistema novo e poupa uma rodada de decisão.
3. **"Elevação por borda, sem blur decorativo"** — convergência notável: o projeto antigo chegou a essa regra por referência de produto, e a marca GENS chega nela por identidade. Reforça que é a direção certa.

### Quick wins

- Os 9 tokens de cor cobrem ~80% do look — mapear direto em `@theme`
- Sora está no Google Fonts, carrega sem fricção
- A escala tipográfica fluida (`clamp()`) elimina a maior parte das media queries

### Tricky bits

- **A sombra dura precisa virar utility desde o começo.** Se o time usar `shadow-md` do Tailwind por hábito, a identidade evapora silenciosamente.
- **Dark mode não existe no site** — vai precisar ser desenhado do zero usando `{colors.deep}` como base (ver Open Questions).
- **Densidade**: o site é arejado; um dashboard com tabelas e boards é naturalmente denso. A tradução exige reduzir espaçamentos sem reduzir o tamanho tipográfico dos títulos — senão vira um site institucional espremido.

### Implicit states to define

Nenhum destes foi capturado; definir antes de implementar:

- Hover e focus de botão (o CSS só mostra `transition`, não o estado final)
- Focus ring visível (crítico para acessibilidade em formulário)
- Estados de loading, vazio e erro
- Estados de input: preenchido, desabilitado, inválido

### Confidence map

| Camada | Confiança | Por quê |
|---|---|---|
| Identidade | ✅ alta | Material suficiente, padrões claros |
| Cores | ✅ alta | Extraídas como CSS custom properties |
| Tipografia | ✅ alta | Família e escala lidas do CSS |
| Espaçamento | ⚠️ média | Escala proposta, não extraída |
| Componentes | ⚠️ média | Catálogo parcial, sem estados |
| Layout | ❓ baixa | Só desktop, sem media queries lidas |

---

## 6. Do's and Don'ts

### Do

- **Use a sombra dura sem blur** (`5px 5px {colors.shadow-soft}`) como elevação padrão de card. É o gesto que carrega a marca.
- **Reserve `{colors.lime}` para ação e status**, não para áreas grandes de leitura. Num dashboard usado o dia inteiro, limão como fundo de painel cansa a vista.
- **Sempre texto `{colors.ink}` sobre `{colors.lime}`** — o par tem 14.16:1, é excelente.
- **Use `{rounded.sm}` (5px) em botões e inputs, `{rounded.lg}` (12px) em cards.** As duas escalas coexistem de propósito.
- **Aplique tracking negativo (-0.04em a -0.055em) em todo título** e tracking positivo (+0.08em a +0.15em) em todo eyebrow em caixa alta. Essa polaridade é a voz tipográfica.
- **Alterne bandas `{colors.paper}` e `{colors.hero-soft}`** para separar seções, em vez de usar divisores.
- **Use `{rounded.full}` com número dentro** para ordenar itens de lista — é o padrão mais repetido do site.

### Don't

- **Não use `box-shadow` com blur.** `0 4px 12px rgba(0,0,0,.1)` mata a identidade mesmo mantendo cores e fonte.
- **Nunca texto branco sobre `{colors.lime}`** — 1.15:1, praticamente invisível.
- **Não use `{colors.lime}` como cor de texto sobre fundo claro** — ambos têm luminância alta, o contraste fica inutilizável.
- **Não suba o peso tipográfico acima de 700.** O teto da marca é bold; 800/900 não existem no sistema.
- **Não use raios de 16px+ como padrão de card.** O sistema opera em 5–12px; raio grande descaracteriza.
- **Não introduza um segundo acento vibrante.** O limão só funciona porque é o único ponto de voltagem alta.
- **Não centralize o hero.** O site alinha à esquerda de forma consistente.

---

## 7. Open Questions

- ~~Dark mode~~ — **decidido em 2026-09-18: não haverá dark mode por enquanto.** O sistema opera só em tema claro. Se isso mudar, o ponto de partida é `{colors.deep}` como superfície e `{colors.paper}` como texto (13.84:1 ✅), mas há um buraco a resolver antes: `{colors.muted}` sobre `{colors.deep}` dá 2.29:1 e reprova em tudo — o escuro precisaria de um token novo de texto secundário (algo como #a8b29c).
- **Estados de hover/focus/disabled** não foram capturados. Recomendo rodar `python scripts/capture_site.py <URL> --viewports desktop,tablet,mobile` para confirmar breakpoints reais e capturar estados.
- **Escala de espaçamento** é proposta, não extraída. Vale definir formalmente no `tailwind.config` e tratar como decisão nova, não como herança.
- **Sora tem licença aberta (SIL OFL)** — sem restrição de uso, mas confirme se a identidade oficial da GENS usa outra fonte para títulos (o logo é claramente desenhado à mão, não Sora).

---

## 8. Companion files

- [x] `design-tokens.json` — tokens em formato W3C DTCG
- [x] `design-a11y.md` — relatório WCAG dos pares de cor
- [ ] `design-screenshot.png` — não gerado (captura feita via navegador interativo)
