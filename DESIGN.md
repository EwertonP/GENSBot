# Design System (DESIGN.md)

Este documento atua como o contrato de design e "fonte de verdade" visual (Single Source of Truth) para o desenvolvimento do **InstaFlow (GENSBot)**. Qualquer agente de IA ou desenvolvedor deve ler e seguir estritamente estas especificações para manter a consistência visual.

> **Atualização (v4 — "Oat & Clay")**: o projeto migrou da identidade fintech azul (iBanko/OFSPACE) para uma linguagem inspirada na **Claude** (fundo quente, um único acento clay/terracota, cor semântica usada com moderação) e na **Apple** (tipografia confiante com bastante respiro, sombra difusa em vez de borda, cantos generosos e consistentes). Fundo off-white *quente* (não mais cinza-azulado), cards brancos elevados por sombra também quente, clay como único acento de ação, e cards de métrica com **indicador semântico pontual** em vez de fundo pastel dominando o card inteiro.
>
> **Atualização (v4.1 — modo escuro)**: o app agora tem tema escuro de verdade, com toggle manual (`src/components/theme-toggle.tsx`) persistido em `localStorage` (`gensbot_theme`) — no primeiro acesso segue `prefers-color-scheme` do SO, depois respeita a escolha explícita do usuário. A classe `.dark` no `<html>` troca todos os tokens da seção 1 pelo par escuro (bloco `.dark` em `globals.css`); um script inline em `layout.tsx` aplica a classe antes da hidratação pra não piscar o tema errado. **Nunca** monte cor condicional a tema num componente (`theme === 'dark' ? '#fff' : '#000'`) — o token já resolve isso sozinho via CSS var.
>
> **Atualização (v5 — paleta GENS, este documento estava desatualizado)**: a identidade "Oat & Clay" (v4, clay/terracota) descrita abaixo **não reflete mais o `globals.css` real** — o app migrou pra paleta oficial da agência GENS (lima `#DBFF69` no dark / verde-oliva `#4D8300` no light como `--primary`). A seção 1 abaixo foi corrigida pra bater com o código de verdade. Junto disso, o dark mode teve um ajuste: `--accent`/`--secondary`/`--muted`/`--border` eram verde-oliva (tingindo todo hover/badge de verde) e viraram cinza-neutro — o lima passou a ser o **único** ponto de cor saturada (CTA, aba ativa, gráfico), no espírito do dark mode do Linear. Ver seção "Referências e próximos passos" no fim do documento.
>
> Todos os componentes (`page.tsx`, `login`, `register`, `privacidade`, `exclusao-de-dados`) já foram migrados pros tokens semânticos abaixo — não deve sobrar nenhuma classe com `#hex` fixo no código.

---

## 1. Design Tokens

Os tokens vivem como variáveis CSS em `:root` (tema claro) e `.dark` (tema escuro, ver v4.1 acima) dentro de `globals.css`, e são expostos ao Tailwind v4 via `@theme inline`. **Nunca escreva um valor de cor literal (`#hex` ou `oklch(...)`) em um componente estrutural** — sempre use a classe utilitária correspondente ao token, inclusive para verde/âmbar/vermelho semânticos (`bg-success`/`bg-warning`/`bg-destructive`), que **não** devem mais usar a paleta padrão do Tailwind (`emerald-*`, `amber-*`, `blue-*`...) — ver seção 3.

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
| Sucesso / estado ativo positivo | `bg-success text-success-foreground` | `--success` / `--success-foreground` |
| Atenção / pendente | `bg-warning text-warning-foreground` | `--warning` / `--warning-foreground` |
| Erros / ações destrutivas | `bg-destructive text-destructive-foreground` | `--destructive` / `--destructive-foreground` |
| Bordas | `border-border` | `--border` |
| Campos de formulário | `border-input` | `--input` |
| Anel de foco | `ring-ring` | `--ring` |
| Gráficos (5 séries) | `text-chart-1` … `text-chart-5` | `--chart-1` … `--chart-5` |
| Sidebar | `bg-sidebar text-sidebar-foreground` | `--sidebar` / `--sidebar-foreground` |

* **Cor de marca / ação primária**: verde da GENS — lima `oklch(0.946 0.179 121.3)` (`#DBFF69`) no dark, verde-oliva `oklch(0.551 0.154 132.3)` (`#4D8300`) no light — **único** acento de cor saturada usado em CTAs, links, ícone/aba ativa do menu e linha principal de gráfico. `--accent`/`--secondary`/`--muted`/`--border` são **cinza-neutro**, não devem carregar matiz de verde (correção da v5 — antes o dark mode tingia toda superfície de hover/badge de verde-oliva). `--success` (verde-sálvia) e `--warning` (ocre) são tokens *semânticos*, separados do acento de marca — usam-se em indicadores de estado (pill, badge, bolinha), nunca em botão de ação.
* **Fontes**: `--font-sans: Inter, sans-serif` (texto geral), `--font-mono: monospace`, `--font-serif: Georgia, serif`. Uma família só carregando toda a hierarquia: a personalidade vem da escala e do peso, não de misturar fontes.
* **Raio base**: `--radius: 0.625rem`, com escalas derivadas `rounded-sm` → `rounded-4xl` calculadas a partir dele.
* **Sombras**: elevação existe (`--shadow-*`), mas no **dark mode** a elevação real vem mais de variação de tom entre `--background` → `--sidebar` → `--card` do que de sombra (sombra quase não aparece em fundo preto) — mesma lógica do dark mode do Linear.

### Arredondamento (Border Radius Scale)
* **Containers externos, cards principais & modais**: `rounded-2xl`
* **Inputs, selects, textareas e tabs**: `rounded-xl`
* **Botões de ação principais**: `rounded-xl` (o componente `Button` real usa isso, não pill — só badge/avatar/pill-tab usam `rounded-full`)

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

### Card de Métrica (KPI cards do Dashboard)
O card é sempre `bg-card` neutro — a cor de categoria vira só um **indicador pontual** (bolinha de 7px no canto), não um fundo pastel tomando o card inteiro. Isso evita quatro blocos de cor competindo por atenção na mesma tela; o card some no fundo e só o número/variação chamam olho:

```html
<div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3 h-40">
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Leads Gerados</span>
    <span className="w-1.75 h-1.75 rounded-full bg-primary" />
  </div>
  <span className="text-4xl font-bold text-foreground leading-none tabular-nums">128</span>
  <span className="text-xs font-semibold text-success">↑ 24,5% vs. 30 dias anteriores</span>
</div>
```
A cor da bolinha (`bg-primary`/`bg-success`/`bg-warning`/texto neutro) só diferencia a categoria visualmente — a variação percentual usa `text-success`/`text-destructive` semanticamente (subiu/caiu), não a cor da categoria. Números sempre com `tabular-nums` pra não "dançar" quando o valor muda.

### Seletor de Conta na Sidebar
O bloco de perfil no topo da sidebar (avatar + `@username` + contador de contas) funciona como o seletor de conta do Instagram — substitui o antigo dropdown no header. Ao clicar, abre lista de contas conectadas + "Conectar outra conta" + "Desconectar esta conta". Trocar de conta atualiza automaticamente todos os dados do dashboard (stats, automações, contatos, fila) via `handleSelectAccount`, sem precisar recarregar a página.

---

## 4. Diretrizes de UX (Do's & Don'ts)

* **DO**: Use `bg-background`/`text-foreground` para as telas principais do aplicativo (nunca hex fixo).
* **DO**: Garanta contraste suficiente usando `text-muted-foreground` para texto secundário (WCAG AA).
* **DO**: Ao tocar em uma tela antiga (`page.tsx`, `login`, `register`) por outro motivo, aproveite para trocar as classes `bg-[#hex]`/`text-[#hex]` pelos tokens equivalentes da tabela da seção 1 — migração incremental, não é preciso reescrever tudo de uma vez.
* **DON'T**: Não introduza cores literais (`#hex` ou `oklch(...)`) em componentes novos; sempre use a classe de token.
* **DON'T**: A cor `primary` é reservada para sinalizar "Ação" ou "Estado Ativo" — não usar em elementos passivos. `success`/`warning` são para *estado*, não para chamar atenção pra uma ação.
* **DON'T**: Não use bordas com cor literal; sempre `border-border`.
* **DON'T**: Não use `emerald-*`/`blue-*`/`amber-*`/`violet-*`/`rose-*` (paleta crua do Tailwind) em componente novo — sempre `success`/`warning`/`destructive`/`primary`.

---

## 6. Referências e próximos passos (v5)

Inspirações trazidas pelo usuário e o que cada uma empresta especificamente
pro GENSBot (não é pra copiar a paleta/identidade visual de nenhuma delas,
só o princípio):

* **Linear** — hierarquia de sidebar clara + cor de marca reservada só pra
  estado/ação (é a base do ajuste de `--accent` feito na v5).
* **Attio** (CRM moderno) — cards de lead agrupados por coluna, com
  avatar/tag/ação que aparece só no hover — referência direta pro
  `crm-board.tsx` (Kanban de leads).
* **Notion Calendar** — cor a serviço de estrutura (cada tipo de
  evento/post com sua própria cor), não decoração — referência pro
  `calendar-view.tsx`.

Duas dívidas estruturais que tornam qualquer reskin mais caro do que
precisaria ser, valem resolver antes de ir fundo no visual:

1. **Dois Kanbans quase idênticos**: `src/components/kanban-board.tsx`
   (posts) e `src/components/crm-board.tsx` (leads) — cada um com sua
   própria lógica de `draggable`/`onDragStart`/`onDrop` nativa (HTML5, sem
   suporte a touch). Consolidar num componente `Board`/`DraggableCard`
   genérico, idealmente com `dnd-kit`, antes de aplicar polish visual —
   senão o trabalho de reskin (ghost card, animação de reorder) se repete
   duas vezes.
2. **`src/app/page.tsx` com ~2600 linhas**: toda a casca do app (sidebar,
   header, KPIs, switch de todas as abas) num único client component.
   Reagrupar a sidebar no estilo Linear fica mais seguro depois de quebrar
   isso em componentes por aba.

## 7. Histórico

* v4 → v5: paleta "Oat & Clay" (clay/terracota) substituída pela paleta
  oficial da agência GENS (lima/verde-oliva) — a v4 nunca foi corrigida
  neste documento quando o código migrou, o que deixou a seção 1 inteira
  desatualizada até esta correção. Dark mode também teve `--accent` e
  tokens vizinhos neutralizados (ver nota v5 no topo do documento).
* v3 → v4: paleta fintech azul (`iBanko/OFSPACE`) substituída pela identidade "Oat & Clay" (Claude × Apple).
* Paleta anterior a v3 (`#121212` / `#1DB954` verde Spotify) documentada no histórico do git deste arquivo, caso seja necessário reverter ou comparar.
