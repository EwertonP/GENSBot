# Design System (DESIGN.md)

Este documento atua como o contrato de design e "fonte de verdade" visual (Single Source of Truth) para o desenvolvimento do **InstaFlow (GENSBot)**. Qualquer agente de IA ou desenvolvedor deve ler e seguir estritamente estas especificações para manter a consistência visual.

> **Atualização (v3 — tema claro)**: o projeto migrou de uma paleta dark hex fixa (estilo Spotify) para um tema **shadcn/ui** (Base UI + preset [tweakcn](https://tweakcn.com)) e depois para uma identidade **100% clara**, inspirada em dashboards fintech (iBanko/OFSPACE): fundo off-white, cards brancos elevados por sombra (não por borda), azul como único acento de ação, e cards de métrica com fundo pastel colorido por categoria. **Não existe modo escuro** — o app não tem toggle de tema e a classe `.dark` não é usada em nenhum lugar; `:root` em `globals.css` já contém os valores finais.
>
> Todos os componentes (`page.tsx`, `login`, `register`, `privacidade`, `exclusao-de-dados`) já foram migrados pros tokens semânticos abaixo — não deve sobrar nenhuma classe com `#hex` fixo no código.

---

## 1. Design Tokens

Os tokens vivem como variáveis CSS em `:root` dentro de `globals.css` (não existe bloco `.dark` — é o único tema), e são expostos ao Tailwind v4 via `@theme inline`. **Nunca escreva um valor de cor literal (`#hex` ou `oklch(...)`) em um componente estrutural** — sempre use a classe utilitária correspondente ao token. A exceção são os *cards de métrica pastel* (seção 3), que usam a paleta padrão do Tailwind (`emerald`/`blue`/`amber`/`violet`) de propósito, para diferenciar categorias visualmente — ver seção 3.

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

* **Cor de marca / ação primária**: tom azul (`--primary: oklch(0.6112 0.1217 248.9572)`) — único acento de cor usado em CTAs, links, ícone ativo do menu e estado selecionado.
* **Fontes**: `--font-sans: Inter, sans-serif` (texto geral), `--font-mono: monospace`, `--font-serif: Georgia, serif`.
* **Raio base**: `--radius: 1rem` (generoso, tipo dashboard fintech), com escalas derivadas `rounded-sm` → `rounded-4xl` calculadas a partir dele.
* **Sombras**: elevação vem de `--shadow-*` (sombra suave azulada, `--shadow-color: #1a2340`), não de borda — cards usam `shadow-sm`/`shadow-md` em vez de `border`. Use `border-border` só quando precisar de uma linha divisória fina (ex.: dentro de tabelas), não para "levantar" um card do fundo.

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

### Card de Métrica Pastel (KPI cards do Dashboard)
Cada métrica ganha uma cor de categoria (não é sobre "bom/mau", é só pra diferenciar visualmente). Use sempre o par `tint`/`text`/`sub`/`badge`/`icon` de uma mesma família Tailwind — nunca misture famílias dentro do mesmo card:

```html
<div className="bg-emerald-50 rounded-2xl p-5 shadow-sm">
  <span className="text-xs font-bold text-emerald-700 uppercase">Leads Gerados</span>
  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600">↗</div>
  <span className="text-4xl font-black text-emerald-900">128</span>
  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">↑ 24.5%</span>
</div>
```
Famílias em uso hoje: `emerald` (leads/positivo), `blue` (automações), `amber` (fila/pendente), `violet` (eventos). Pra uma quinta categoria, use `rose` ou `cyan` antes de reutilizar uma cor já empregada em outro card da mesma tela.

### Seletor de Conta na Sidebar
O bloco de perfil no topo da sidebar (avatar + `@username` + contador de contas) funciona como o seletor de conta do Instagram — substitui o antigo dropdown no header. Ao clicar, abre lista de contas conectadas + "Conectar outra conta" + "Desconectar esta conta". Trocar de conta atualiza automaticamente todos os dados do dashboard (stats, automações, contatos, fila) via `handleSelectAccount`, sem precisar recarregar a página.

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
