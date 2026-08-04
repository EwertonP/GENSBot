# Design System (DESIGN.md)

Este documento atua como o contrato de design e "fonte de verdade" visual (Single Source of Truth) para o desenvolvimento do **InstaFlow (GENSBot)**. Qualquer agente de IA ou desenvolvedor deve ler e seguir estritamente estas especificações para manter a consistência visual.

> **Atualização**: o projeto migrou de uma paleta com valores hex fixos (estilo Spotify) para um tema baseado em **shadcn/ui** (biblioteca de componentes **Base UI**, preset customizado via [tweakcn](https://tweakcn.com)), com tokens de cor em `oklch()` definidos em [src/app/globals.css](src/app/globals.css) e mapeados em [components.json](components.json).
>
> **Importante**: essa migração trocou os *tokens* disponíveis, mas **não re-estilizou** as telas já existentes (`page.tsx`, `login`, `register`, etc.) — elas ainda usam classes com hex fixo (`bg-[#1A1A1A]`, `text-[#A7A7A7]`, etc.) e continuam renderizando visualmente como antes. A partir de agora, **todo componente novo** deve ser feito com os tokens semânticos abaixo; a migração das telas antigas é gradual (ver seção 4).

---

## 1. Design Tokens

Os tokens vivem como variáveis CSS em `:root` (modo claro) e `.dark` (modo escuro) dentro de `globals.css`, e são expostos ao Tailwind v4 via `@theme inline`. **Nunca escreva um valor de cor literal (`#hex` ou `oklch(...)`) em um componente** — sempre use a classe utilitária correspondente ao token.

| Papel | Classe Tailwind | Variável CSS |
|---|---|---|
| Fundo principal | `bg-background` | `--background` |
| Texto principal | `text-foreground` | `--foreground` |
| Cards / painéis | `bg-card text-card-foreground` | `--card` / `--card-foreground` |
| Popovers / dropdowns | `bg-popover text-popover-foreground` | `--popover` / `--popover-foreground` |
| Ação primária (CTA) | `bg-primary text-primary-foreground` | `--primary` / `--primary-foreground` |
| Ação secundária | `bg-secondary text-secondary-foreground` | `--secondary` / `--secondary-foreground` |
| Texto/fundo esmaecido | `bg-muted text-muted-foreground` | `--muted` / `--muted-foreground` |
| Destaque / hover ativo | `bg-accent text-accent-foreground` | `--accent` / `--accent-foreground` |
| Erros / ações destrutivas | `bg-destructive text-destructive-foreground` | `--destructive` / `--destructive-foreground` |
| Bordas | `border-border` | `--border` |
| Campos de formulário | `border-input` | `--input` |
| Anel de foco | `ring-ring` | `--ring` |
| Gráficos (5 séries) | `text-chart-1` … `text-chart-5` | `--chart-1` … `--chart-5` |
| Sidebar | `bg-sidebar text-sidebar-foreground` | `--sidebar` / `--sidebar-foreground` |

* **Cor de marca / ação primária**: tom azul (`--primary: oklch(0.6112 0.1217 248.9572)` no claro / `oklch(0.6576 0.1208 252.0832)` no escuro) — substitui o antigo verde Spotify (`#1DB954`) como cor de CTA e estado ativo.
* **Fontes**: `--font-sans: Inter, sans-serif` (texto geral), `--font-mono: monospace`, `--font-serif: Georgia, serif`.
* **Raio base**: `--radius: 0.5rem`, com escalas derivadas `rounded-sm` → `rounded-4xl` calculadas a partir dele (ver `@theme inline` em `globals.css`).
* **Sombras**: `--shadow-2xs` até `--shadow-2xl`, com opacidade maior no modo escuro (`--shadow-opacity: 0.3`) do que no claro (`0.1`).

### Arredondamento (Border Radius Scale)
* **Containers externos, cards principais & modais**: `rounded-2xl`
* **Inputs, selects, textareas e tabs**: `rounded-xl`
* **Botões de ação principais e badges de estado**: `rounded-full` (formato pill)

### Espaçamento (Spacing)
* Seguir estritamente a grade do Tailwind:
  * Margens e paddings de cards: `p-6` (24px) para cards de fluxo e painéis.
  * Distâncias internas de formulários: `gap-4` ou `gap-6`.
  * Paddings de inputs: `px-4 py-2.5`.

---

## 2. Componentes shadcn/ui (Base UI)

O projeto agora tem `components.json` configurado (biblioteca **Base UI**, preset customizado). Para adicionar um novo componente de UI (botão, dialog, dropdown, etc.), prefira instalar via CLI em vez de escrever do zero:

```bash
npx shadcn@latest add button
```

Isso garante que o componente já nasce usando os tokens da tabela acima, com variantes (`variant="default" | "outline" | "ghost"`, etc.) prontas.

---

## 3. Padrões de Componentes (com tokens)

### Botão Primário (Primary Button)
```html
<button className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md transition-all cursor-pointer">
  Texto do Botão
</button>
```

### Campos de Entrada (Form Controls)
```html
<input
  type="text"
  className="bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder-muted-foreground transition-all"
/>
```

### Badge de Gatilho / Tags
```html
<span className="text-[9px] bg-muted text-primary font-extrabold px-1.5 py-0.5 rounded-md border border-primary/20 uppercase tracking-wider">
  Tag
</span>
```

---

## 4. Diretrizes de UX (Do's & Don'ts)

* **DO**: Use `bg-background`/`text-foreground` para as telas principais do aplicativo (nunca hex fixo).
* **DO**: Garanta contraste suficiente usando `text-muted-foreground` para texto secundário (WCAG AA).
* **DO**: Ao tocar em uma tela antiga (`page.tsx`, `login`, `register`) por outro motivo, aproveite para trocar as classes `bg-[#hex]`/`text-[#hex]` pelos tokens equivalentes da tabela da seção 1 — migração incremental, não é preciso reescrever tudo de uma vez.
* **DON'T**: Não introduza cores literais (`#hex` ou `oklch(...)`) em componentes novos; sempre use a classe de token.
* **DON'T**: A cor `primary` é reservada para sinalizar "Ação" ou "Estado Ativo" — não usar em elementos passivos.
* **DON'T**: Não use bordas com cor literal; sempre `border-border`.

---

## 5. Histórico

* Paleta anterior (`#121212` / `#1DB954` verde Spotify) documentada no histórico do git deste arquivo, caso seja necessário reverter ou comparar.
