# Design System (DESIGN.md)

Este documento atua como o contrato de design e "fonte de verdade" visual (Single Source of Truth) para o desenvolvimento do **InstaFlow (GENSBot)**. Qualquer agente de IA ou desenvolvedor deve ler e seguir estritamente estas especificações para manter a consistência visual.

> **Atualização (v4 — "Oat & Clay")**: o projeto migrou da identidade fintech azul (iBanko/OFSPACE) para uma linguagem inspirada na **Claude** (fundo quente, um único acento clay/terracota, cor semântica usada com moderação) e na **Apple** (tipografia confiante com bastante respiro, sombra difusa em vez de borda, cantos generosos e consistentes). Fundo off-white *quente* (não mais cinza-azulado), cards brancos elevados por sombra também quente, clay como único acento de ação, e cards de métrica com **indicador semântico pontual** em vez de fundo pastel dominando o card inteiro. **Não existe modo escuro** — o app não tem toggle de tema e a classe `.dark` não é usada em nenhum lugar; `:root` em `globals.css` já contém os valores finais.
>
> Todos os componentes (`page.tsx`, `login`, `register`, `privacidade`, `exclusao-de-dados`) já foram migrados pros tokens semânticos abaixo — não deve sobrar nenhuma classe com `#hex` fixo no código.

---

## 1. Design Tokens

Os tokens vivem como variáveis CSS em `:root` dentro de `globals.css` (não existe bloco `.dark` — é o único tema), e são expostos ao Tailwind v4 via `@theme inline`. **Nunca escreva um valor de cor literal (`#hex` ou `oklch(...)`) em um componente estrutural** — sempre use a classe utilitária correspondente ao token, inclusive para verde/âmbar/vermelho semânticos (`bg-success`/`bg-warning`/`bg-destructive`), que **não** devem mais usar a paleta padrão do Tailwind (`emerald-*`, `amber-*`, `blue-*`...) — ver seção 3.

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

* **Cor de marca / ação primária**: clay/terracota (`--primary: oklch(0.565 0.135 42)`, ≈ `#B6562E`) — **único** acento de cor usado em CTAs, links, ícone ativo do menu e estado selecionado. `--success` (verde-sálvia) e `--warning` (ocre) são tokens *semânticos*, separados do acento de marca — usam-se em indicadores de estado (pill, badge, bolinha), nunca em botão de ação.
* **Fontes**: `--font-sans: Inter, sans-serif` (texto geral — faz o papel da pilha de sistema tipo SF Pro), `--font-mono: monospace`, `--font-serif: Georgia, serif`. Uma família só carregando toda a hierarquia: a personalidade vem da escala e do peso (display grande/650, label uppercase com tracking), não de misturar fontes. Evite empilhar `font-black` em tudo — reserve peso máximo pra hierarquia que realmente precisa.
* **Raio base**: `--radius: 1.1rem` (cantos generosos e consistentes, "continuous corner"), com escalas derivadas `rounded-sm` → `rounded-4xl` calculadas a partir dele.
* **Sombras**: elevação vem de `--shadow-*` (sombra difusa e **quente**, `--shadow-color: #2a1c0f` — nunca cinza-azulada), não de borda — cards usam `shadow-sm`/`shadow-md` em vez de `border`. Use `border-border` só quando precisar de uma linha divisória fina (ex.: dentro de tabelas), não para "levantar" um card do fundo.

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

## 5. Histórico

* v3 → v4: paleta fintech azul (`iBanko/OFSPACE`) substituída pela identidade "Oat & Clay" (Claude × Apple) — ver nota no topo do documento.
* Paleta anterior a v3 (`#121212` / `#1DB954` verde Spotify) documentada no histórico do git deste arquivo, caso seja necessário reverter ou comparar.
