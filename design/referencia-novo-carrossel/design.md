---
version: anydesign-1
name: O Novo Carrossel (referência de cor e estrutura)
source: https://onovocarrossel.com/
captured_at: 2026-11-04
description: |
  Verde-floresta profundo como fundo, um único verde-menta de alta voltagem como
  chamada para ação e faixas de papel claro que alternam com o escuro. A cor não enfeita:
  cada tom tem um papel (fundo, superfície, tinta, linha, ação). Um amarelo aparece
  só no hover e na promoção. O resto é contido: raios em escada curta, sombras em duas
  camadas, tipografia de títulos apertada e uma textura de grade quase invisível.

colors:
  bg: "#00251D"
  bg-deep: "#001A14"
  surface: "#013027"
  surface-2: "#01382D"
  fill: "#0A4436"
  line: "#0C3A2E"
  line-2: "#1A5341"
  ink: "#E9F5EC"
  ink-2: "#9DBFB0"
  ink-3: "#587F70"
  cta: "#00D898"
  cta-ink: "#00281E"
  mint: "#A5EFC7"
  ok: "#7CDCA3"
  ok-deep: "#1B7A4E"
  yellow: "#F0D100"
  yellow-ink: "#3A2E00"
  danger: "#E06B6A"
  danger-deep: "#C9403F"
  light-bg: "#EEF2EC"
  light-surface: "#FFFFFF"
  light-fill: "#E4EBE2"
  light-ink: "#0D231C"
  light-ink-2: "#64786E"
  light-ink-3: "#93A69B"
  light-line: "#E2E9DF"
  light-line-2: "#D2DCCF"
  paper: "#FBFAF6"

typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: clamp(32px, 4.5vw, 56px)
    fontWeight: 800
    letterSpacing: -0.02em
  section-title:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: clamp(26px, 3.6vw, 40px)
    fontWeight: 800
    letterSpacing: -0.02em
  card-title:
    fontFamily: "Rubik, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 700
    letterSpacing: -0.01em
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  eyebrow:
    fontFamily: "Rubik, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: 11.5px
    fontWeight: 600
    letterSpacing: 0.18em

spacing:
  base: 4px
  scale: [8, 12, 16, 24, 36, 44, 64]
  container: 1120px
  gutter: 24px
  section: 64px

rounded:
  sm: 9px
  md: 11px
  lg: 15px
  xl: 20px
  button: 14px
  pill: 999px

components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.cta-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: 0 26px
    height: 52px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    border: "1.5px inset rgba(233,245,236,.26)"
    rounded: "{rounded.button}"
    height: 52px
  card-dark:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.line-2}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-light:
    backgroundColor: "{colors.light-surface}"
    border: "1px solid {colors.light-line}"
    rounded: "{rounded.xl}"
    padding: 26px 22px 28px
  pill:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    height: 42px
  eyebrow-label:
    textColor: "{colors.ink-3}"
    typography: "{typography.eyebrow}"
  promo-strip:
    backgroundColor: "linear-gradient(90deg, #E8421A, #C9403F)"
    textColor: "{colors.light-surface}"
  app-mockup:
    backgroundColor: "{colors.light-surface}"
    border: "1px solid {colors.light-line}"
    rounded: "{rounded.xl}"
  comparison-bars:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.xl}"
---

# Design Analysis — O Novo Carrossel

> Analysis generated with the `anydesign` skill.
> Date: 2026-11-04
> Analysis emphasis: design system (usado como norte de cor e estrutura para o GENSBot)

---

## Source

- **Source type**: URL, página de venda de um produto digital (landing), com a captura do app dentro de um mockup.
- **Path / URL**: `https://onovocarrossel.com/` (parâmetros de rastreio removidos da URL)
- **Capture method**: HTML bruto e 3 blocos `<style>` inline (55 variáveis CSS lidas direto, ✅ alta confiança) + capturas de tela do site renderizado no Chrome (topo, faixa clara, mockup do app, gráfico).
- **Detected limitations**: só desktop capturado (1554×784); o comportamento mobile vem das regras `@media` do CSS, não de captura. Sem arquivo de CSS externo (tudo inline). Estados de hover só lidos no CSS, não vistos. Fontes carregadas por `@font-face`, não conferidas visualmente.

---

## TL;DR

Página de conversão com duas polaridades: abertura em verde-floresta escuro e corpo em papel claro, ligadas por um único verde-menta (`{colors.cta}`, #00D898) que só existe para agir. Os neutros são esverdeados em toda a escala, e isso dá a sensação de "uma cor só" sem ficar monótono. O que vale levar para o GENSBot é a disciplina (um papel para cada tom, ação com contraste alto, faixas alternadas, grade quase invisível), mais do que o verde em si.

---

## 1. Visual identity

### 1.1 Surface description

**Personality**: direto, confiante, editorial, enxuto, de "ferramenta de criador".

**Mood**: calmo e seguro no escuro, claro e prático no papel. A urgência fica concentrada em uma faixa vermelha de promoção, fora do resto.

**Detectable stylistic references**: produto SaaS de criadores (linha Linear/Framer em estrutura), com tipografia de revista nos exemplos de slides.

**Information density**: balanced.

**Implicit positioning**: criadores de conteúdo e donos de perfil que querem velocidade e resultado, sem designer.

**Confidence**: ✅ high

### 1.2 Brand voice / Atmosphere

O design acredita que o público já está cansado de ferramenta complicada e precisa sentir controle rápido. Por isso o escuro do hero não é preto, é um verde que lembra "dinheiro e crescimento" sem dizer isso, e o botão de ação é o único objeto saturado da tela. A pessoa nunca precisa decidir onde clicar.

A alternância para papel claro, com cartões brancos e sombra leve, muda o ritmo na hora de provar: mostrar o app, os números e o preço. Escuro serve para prometer, claro serve para mostrar. Cada mudança de fundo acompanha uma mudança de função do texto.

A textura de grade a 3% de opacidade vem do vocabulário de "planta de design": lembra que o produto é feito por designer, sem competir com o conteúdo.

### 1.3 The "ONE brand thing"

- **The thing**: o verde-menta de ação `{colors.cta}` (#00D898) sobre um verde-floresta quase preto, com tinta escura de contraste alto no botão (`{colors.cta-ink}`, 8,5:1).
- **Why it carries the brand**: tire o menta e sobra uma página escura genérica. Tire o fundo floresta e o menta vira "verde de app de delivery".
- **How everything else supports it**: neutros esverdeados, amarelo só no hover, vermelho só na faixa de oferta, tinta clara de baixo ruído.
- **Where it appears (and where it deliberately doesn't)**: botões de ação, logo, foco, barras de destaque nos gráficos. Não aparece em texto corrido nem em fundos grandes.

*Confidence*: ✅ high

---

## 2. Design System (tokens)

### 2.1 Colors

Fonte: variáveis CSS do próprio site (✅ high em todas).

**Tema escuro (hero, rodapé, blocos de promessa)**

| Token | Hex | Role | Confidence |
|---|---|---|---|
| `bg` | `#00251D` | Fundo da página no escuro | ✅ high |
| `bg-deep` | `#001A14` | Capas e blocos mais fundos | ✅ high |
| `surface` / `surface-2` | `#013027` / `#01382D` | Cartões e camadas sobre o fundo | ✅ high |
| `fill` | `#0A4436` | Preenchimento de chips e controles | ✅ high |
| `line` / `line-2` | `#0C3A2E` / `#1A5341` | Divisória suave / borda de cartão | ✅ high |
| `ink` | `#E9F5EC` | Texto principal | ✅ high |
| `ink-2` | `#9DBFB0` | Texto secundário | ✅ high |
| `ink-3` | `#587F70` | Rótulos decorativos (eyebrow) | ✅ high |
| `cta` / `cta-ink` | `#00D898` / `#00281E` | Ação e o texto dentro dela | ✅ high |
| `mint` / `ok` | `#A5EFC7` / `#7CDCA3` | Realce suave e sucesso | ✅ high |
| `yellow` / `yellow-ink` | `#F0D100` / `#3A2E00` | Hover do botão, promoção | ✅ high |
| `danger` | `#E06B6A` | Erro no escuro | ✅ high |

**Tema claro (corpo da página, cartões de prova)**

| Token | Hex | Role | Confidence |
|---|---|---|---|
| `light-bg` | `#EEF2EC` | Fundo das faixas claras | ✅ high |
| `light-surface` | `#FFFFFF` | Cartões | ✅ high |
| `light-fill` | `#E4EBE2` | Controles, chips | ✅ high |
| `light-ink` | `#0D231C` | Texto principal (14,6:1) | ✅ high |
| `light-ink-2` | `#64786E` | Texto secundário (4,2:1, abaixo do AA para texto pequeno) | ✅ high |
| `light-ink-3` | `#93A69B` | Decoração (2,3:1, nunca como texto) | ✅ high |
| `light-line` / `light-line-2` | `#E2E9DF` / `#D2DCCF` | Bordas | ✅ high |
| `paper` | `#FBFAF6` | Papel quente usado em mockups | ✅ high |

Outras cores vistas só na renderização, não como variável: faixa de promoção em degradê vermelho-laranja (`#E8421A` a `#C9403F`, ⚠️ medium), pastas coloridas no mockup do app (verde, azul, laranja, ⚠️ medium).

### 2.2 Typography

- **Detected family**: Manrope (corpo e títulos) e Rubik (títulos de cartão, rótulos). Plus Jakarta Sans, Inter e Source Serif 4 aparecem só dentro de mockups de slides. *(✅ high, vem de `--display` e `--ui`)*
- **Suggested fallback**: `-apple-system, BlinkMacSystemFont, system-ui, sans-serif`

| Token | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `display` | clamp(32px, 4.5vw, 56px) | 800 | ~1.1 | Título do hero |
| `section-title` | clamp(26px, 3.6vw, 40px) | 800 | ~1.15 | Título de seção |
| `card-title` | 18 a 22px | 700 | ~1.3 | Título de cartão |
| `body` | 16px | 400 | 1.6 | Texto corrido |
| `eyebrow` | 11.5px | 600 | n/d | Rótulo em caixa alta, tracking 0,18em |

**Notable tracking**: -0,02em nos títulos grandes e -0,01em nos de cartão. Tamanho fluido com `clamp()`, sem degraus fixos por breakpoint.

### 2.3 Spacing

- **Inferred base unit**: 4px (⚠️ medium; os valores lidos são 8, 12, 16, 24, 36, 44 e 64)
- **Container**: 1120px com 24px de gutter (✅ high)
- **Seção**: 64px de respiro vertical no desktop (✅ high); cabeçalho de seção centralizado com no máx. 760px

### 2.4 Radii

- `sm` 9px, `md` 11px, `lg` 15px, `xl` 20px (✅ high, são variáveis)
- Botão grande 14px, botão pequeno 11px, pill 999px
- Escada curta e consistente: cartão sempre `xl`, controle sempre `md`, botão em 14px.

### 2.5 Elevation system

| Level | Name | Treatment | Use |
|---|---|---|---|
| 0 | Plano | sem sombra, borda 1px `line-2` | Cartões escuros |
| 1 | Suave | `0 1px 2px rgba(0,0,0,.25), 0 6px 16px rgba(0,0,0,.22)` | Cartões escuros elevados |
| 2 | Flutuante | `0 4px 14px rgba(0,0,0,.3), 0 20px 56px rgba(0,0,0,.38)` | Chips flutuantes, mockups |
| L1 | Suave (claro) | `0 1px 2px rgba(6,32,24,.05), 0 5px 12px rgba(6,32,24,.06)` | Cartões brancos |

Sempre duas camadas (contato curto + sombra longa). Sem sombra dura.

#### Decorative depth (non-functional)

- **Polarity flips**: faixas escuras e claras se alternam por função (promessa em escuro, prova em claro).
- **Background patterns**: grade de 32px (linhas a `rgba(213,255,235,.028)` e pontos a `.05`) no escuro, pontos no claro. Quase invisível, só dá textura.
- **Motion de entrada**: `chegada-sobe` 1,4s com `cubic-bezier(.16,1,.3,1)`, e atraso em escada de 70ms por item (`--i`).

### 2.6 Borders

- Escuro: 1px `line-2` (#1A5341); claro: 1px `light-line` (#E2E9DF)
- Foco: `outline: 2px solid {colors.cta}`, offset 2px (no claro vira a tinta escura)
- Botão fantasma: contorno interno 1,5px a 26% da tinta

### 2.7 Accessibility quick-check

Ver `design-a11y.md`. Resumo:
- `ink` sobre `bg`: **14,61:1** (AAA)
- `cta-ink` sobre `cta`: **8,53:1** (AAA)
- `cta` sobre `bg`: **8,79:1** (AAA)
- `light-ink` sobre `light-bg`: **14,56:1** (AAA)
- Falham: `ink-3` sobre `bg` (3,65:1), `light-ink-2` sobre `light-bg` (4,16:1) e `light-ink-3` (2,27:1). O próprio site usa esses tons só em rótulos decorativos. **Não copiar esses três.**

---

## 3. Components Inventory

### 3.1 Generic components

#### button-primary
- **Variants**: primário `{colors.cta}`, fantasma, pequeno (40px / 11px de raio)
- **Observed sizes**: 52px de altura (padrão), 40px (pequeno); padding horizontal 26px
- **Visible states**: hover troca o fundo para `{colors.yellow}` com texto `{colors.yellow-ink}` e sobe 1px; no claro vai para quase preto `#0D231C`; active volta ao lugar
- **Radius**: `{rounded.button}` (14px)
- **Confidence**: ✅ high (lido no CSS)

#### button-ghost
- **Variants**: contorno interno 1,5px, sem fundo
- **Visible states**: hover só clareia o fundo (6%), sem subir
- **Confidence**: ✅ high

#### card-dark
- **Variants**: borda 1px `line-2`, raio `{rounded.xl}`, padding 24px; hover sobe e muda a cor da borda
- **Confidence**: ✅ high

#### card-light
- **Variants**: branco, borda `light-line`, raio 20px, sombra `L1`; conteúdo centralizado
- **Confidence**: ✅ high

#### pill
- **Variants**: seletor de estilo (Revista / Tweet / Notas), 42px de altura, raio 11px, fundo `fill`
- **Confidence**: ✅ high

#### eyebrow-label
- **Variants**: rótulo em caixa alta, 11,5px, tracking 0,18em
- **Confidence**: ✅ high

### 3.2 Signature components

#### promo-strip
- **What it is**: barra em degradê vermelho-laranja com selo branco "50% DE DESCONTO", preço antigo riscado e preço novo.
- **Why it's signature**: é o único lugar com cor quente. Isola a urgência do resto.
- **Where it appears**: fixa abaixo do cabeçalho, em todas as seções.
- **Confidence**: ✅ high

#### app-mockup
- **What it is**: o app real (barra lateral, pastas coloridas, cartões de carrossel, status em pílula) dentro de um cartão claro com sombra grande.
- **Why it's signature**: mostra a UI do produto como prova, em vez de ilustração. Revela o idioma visual do app: claro, botão primário verde-escuro, status em tom suave, cor usada para organizar (pastas verde, azul, laranja).
- **Where it appears**: seção "Do assunto ao carrossel pronto".
- **Confidence**: ✅ high (visto renderizado)

#### comparison-bars
- **What it is**: barras do ano anterior em tom apagado e do ano atual em tom forte, na mesma família de cor; o valor que ganha vira verde.
- **Why it's signature**: a comparação não usa duas cores diferentes, usa saturação.
- **Confidence**: ✅ high

---

## 4. Layout & Composition

### 4.1 Grid & containers

- Container 1120px, gutter 24px, `overflow-x: clip` no corpo.
- Seções empilhadas com 64px de respiro e cabeçalho centralizado de até 760px.
- Hierarquia por tamanho e contraste, não por cor saturada.

### 4.2 Composition patterns

- Hero centralizado: avatares dos criadores, título, subtítulo, botão, preço em parcelas.
- Faixa de etiquetas rolando (marquee).
- Grades de 3 e 4 itens, cartões lado a lado e FAQ.
- Botão de compra repetido cerca de 15 vezes, sempre com uma linha de apoio embaixo ("12x de R$ 20,25").

### 4.3 Responsive behavior

#### Breakpoints

| Name | Width | Key changes |
|---|---|---|
| Móvel pequeno | ≤ 340–400px | ajustes finos de padding e fonte |
| Móvel | ≤ 480–640px | cartão de pessoa vira 112px + texto, seções com menos respiro |
| Tablet | 641–900px | grades de 3 viram 2 |
| Desktop | ≥ 901 / 961px | layout completo |

Só desktop foi capturado; os breakpoints vêm das `@media` do CSS (⚠️ medium).

#### Touch targets

- Botão padrão 52px, pequeno 40px, pill 42px. O padrão passa de 44px; o pequeno fica abaixo.

#### Collapsing strategy

- Tamanho fluido por `clamp()`, cartões de duas colunas viram uma, seletor de pílulas passa a `flex:1`.

### 4.4 Image behavior

- Slides de exemplo em WebP em larguras de 144 a 540px, tratados como cartões inclinados no hero.
- Logos em SVG (versão clara e escura). Sem biblioteca de ícones; atalhos de teclado em texto (⌘C, ⌘V).

---

## 5. Reconstruction Notes

### Suggested stack

**CSS próprio com variáveis** (o site usa `:root` e uma classe `.light` para trocar a faixa). No GENSBot, o equivalente já existe: `@theme inline` do Tailwind v4 mais `:root` e `.dark`.

### Quick wins

- Papel de cada tom bem nomeado (`bg`, `surface`, `fill`, `line`, `ink`, `cta`).
- Hover do botão que muda de cor, não só de brilho.
- Grade de pontos a 3%.
- Escada de raio com 4 degraus.

### Tricky bits

- Sombras em duas camadas que valem nos dois temas.
- A alternância escuro/claro por seção exige tokens duplicados (`l-*`), o que o GENSBot resolve melhor com a classe do tema.
- Animação de entrada em escada com `--i`.

### Implicit states to define

- Foco visível no claro e no escuro, desabilitado, carregando, erro de campo, vazio.

### Confidence map

| Layer | Confidence | Why |
|---|---|---|
| Identity | ✅ high | Renderizado e CSS concordam |
| Colors | ✅ high | Variáveis lidas direto |
| Typography | ✅ high | `--display` e `--ui` explícitos; tamanhos de `clamp()` |
| Spacing | ⚠️ medium | Poucos valores lidos, sem escala nomeada |
| Components | ⚠️ medium | Botão e cartão lidos no CSS; resto visto na captura |
| Layout | ⚠️ medium | Sem captura mobile |

---

## 6. Do's and Don'ts

### Do

- **Reserve `{colors.cta}` (#00D898) para uma ação por tela.** Tudo que é saturado compete com ela.
- **Dê a todo neutro o mesmo matiz da marca.** Fundo, linha e tinta esverdeados são o que faz a paleta parecer uma só.
- **Faça o hover do primário mudar de cor, não só de brilho.** O amarelo `{colors.yellow}` aparece só ali e na oferta.
- **Alterne faixa escura (promessa) e faixa clara (prova)** em páginas longas, e mantenha o botão no mesmo verde nas duas.
- **Use sempre duas camadas de sombra** (curta e longa). Nunca uma sombra única e pesada.
- **Aperte os títulos** (`-0.02em`) e deixe o corpo em 16px com 1,6 de entrelinha.
- **Compare períodos com a mesma cor em dois tons** (anterior apagado, atual forte).

### Don't

- **Não use `{colors.ink-3}` nem `{colors.light-ink-3}` como texto de leitura.** Falham o contraste (3,65:1 e 2,27:1).
- **Não coloque o menta em texto corrido nem em fundos grandes.**
- **Não introduza um terceiro acento.** Há o menta, o amarelo do hover e o vermelho da oferta; mais que isso quebra a hierarquia.
- **Não misture raios fora da escada** (9, 11, 15, 20, 14 só para botão, pill).
- **Não use sombra dura** (sem desfoque).
- **Não repita o mesmo botão sem a linha de apoio** (preço, garantia): o texto abaixo faz parte do componente.

---

## 7. Open Questions

- Como o site se comporta em mobile real? Só desktop foi capturado; sugerido `capture_site.py --viewports desktop,tablet,mobile` quando o Playwright estiver instalado.
- O amarelo do hover também vale em botões secundários? Só o primário foi lido.
- Qual cor de primário o app dentro do mockup usa em modo escuro? O mockup só mostra o claro (botão verde-escuro visível, hex não confirmado).
- A página é um funil de venda: parte dos padrões (15 botões iguais, urgência) é de conversão e **não** deve ir para um produto de operação como o GENSBot.

---

## 8. Companion files

- [x] `design-tokens.json`: tokens estruturados (DTCG)
- [x] `design-a11y.md`: contraste WCAG dos pares principais

---

*End of analysis.*
