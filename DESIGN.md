# Design System do GENSBot (DESIGN.md)

Contrato visual do **GENSBot** (Agência GENS). É a fonte de verdade para qualquer pessoa ou agente que mexa na UI. Se o código e este documento divergirem, o `src/app/globals.css` vence, e este arquivo deve ser corrigido no mesmo PR.

**Versão atual: v6, "Fundação" (Onda 1, set/2026).**
- O dark mode voltou para **preto neutro + lima só como destaque**, na direção Linear da v5 que tinha se perdido para um tom oliva.
- Os status seguem o padrão de contraste do **Spectrum UI**.
- A tipografia tem **piso de 12px**.
- Não existe mais paleta crua do Tailwind nas telas.

---

## 1. Tokens de cor

Os tokens vivem como variáveis CSS em `:root` (claro) e `.dark` (escuro) no `globals.css` e são expostos ao Tailwind v4 via `@theme inline`. **Nunca escreva `#hex`, `oklch()` ou `emerald-*`/`amber-*` num componente de produto.** Use a classe do token, que já troca de valor com o tema.

Os contrastes abaixo foram medidos (WCAG 2.x) no navegador, nos dois temas.

### Superfícies e texto

| Papel | Classe | Claro | Escuro | Contraste |
|---|---|---|---|---|
| Fundo da página | `bg-background` | `#f7f8f2` (papel) | `#09090b` | — |
| Sidebar | `bg-sidebar` | `#ffffff` | `#0c0c0e` | — |
| Card / painel | `bg-card` | `#ffffff` | `#141417` | — |
| Popover / menu | `bg-popover` | `#ffffff` | `#1b1b1f` | — |
| Hover / item ativo | `bg-accent` | `#eceee4` | `#202025` | — |
| Superfície suave | `bg-muted` / `bg-secondary` | `#eef0e7` / `#edf4d8` | `#18181b` / `#1d1d21` | — |
| Texto principal | `text-foreground` | `#192313` (tinta) | `#f4f4f5` | 15.6 / 18.1 |
| Texto secundário | `text-muted-foreground` | `#545c4a` | `#a1a1aa` | ≥6.1 / ≥6.3 |
| Hairline decorativa | `border-border` | `#d9dfce` | `#2a2a30` | decorativa |
| Divisória que precisa ser vista | `border-border-strong` | `#b9c1ab` | `#3f3f46` | — |
| Contorno de campo | `border-input` | `#8a917e` | `#63636b` | ≥3:1 (WCAG 1.4.11) |
| Foco | `ring-ring` | `#192313` | `#d8ff3c` | — |

No escuro, a elevação vem do **degrau de tom** (`background → sidebar → card → popover`) mais um filete de luz `inset` no topo, que já está dentro das sombras. Sombra projetada quase não aparece sobre preto.

### Marca

| Papel | Classe | Claro | Escuro |
|---|---|---|---|
| Ação primária | `bg-primary text-primary-foreground` | tinta `#192313` / papel | lima `#d8ff3c` / `#12180d` |
| Superfície de marca (CTA "Publicar", selos) | `bg-lime text-lime-foreground` | `#d8ff3c` / `#192313` | igual |
| Verde da marca **como texto** | `text-brand-text` | `#3f6212` | `#d8ff3c` |
| Selo de marca | `bg-brand-soft text-brand-text ring-brand-ring` | — | — |

> ⚠️ **`text-lime` nunca vai sobre superfície clara.** Dá ~1.1:1, é invisível. Para verde legível use `text-brand-text`. `text-lime` só é permitido sobre overlay escuro de imagem.

### Status (padrão Spectrum UI)

Cada status tem quatro tokens:
- `{s}`: cor forte, usada como texto no soft ou como fundo sólido.
- `{s}-foreground`: texto sobre o fundo sólido.
- `{s}-soft`: fundo a 10%, via `color-mix`.
- `{s}-ring`: contorno a 30%.

| Status | Claro | Escuro | Texto no soft (claro / escuro) |
|---|---|---|---|
| `success` | `#065f46` | `#34d399` | ≥6 / 7.8 |
| `warning` | `#92400e` | `#fbbf24` | 5.7 / 8.7 |
| `destructive` | `#be123c` | `#fb7185` | 5.1 / 5.9 |
| `info` | `#0369a1` | `#7dd3fc` | 5.1 / 8.7 |

Receita:
- **Pill / alerta suave:** `bg-{s}-soft text-{s} border-{s}-ring` (ou `ring-1 ring-{s}-ring`).
- **Fundo sólido:** `bg-{s} text-{s}-foreground`. Nunca `text-white`: no escuro o fundo de status é claro, e o branco some.

### Gráficos

`chart-1` (marca), `chart-2` (teal), `chart-3` (âmbar), `chart-4` (violeta), `chart-5` (rosa). Em SVG use `stroke="var(--chart-1)"`, nunca hex.

### Paleta crua: onde ainda é permitida

1. **Tags categóricas** (`src/lib/tag-colors.ts`) e **tipos de nó do flow builder** (`flow-builder/nodes.tsx`). Cor por categoria, não por significado. Padrão obrigatório: `text-{hue}-800 dark:text-{hue}-300` sobre `bg-{hue}-500/10`.
2. **Mockups do Instagram** (`aprovacao/instagram-*-preview.tsx`, `feed-preview-grid.tsx`, o celular do `publish-panel.tsx` e o DM mock do `automations-tab.tsx`). Imitam a UI real do Instagram de propósito.
3. **Marcas de terceiros**, como o botão do WhatsApp (`#25D366` com texto `#052e16`, nunca branco: 2:1).
4. A **imagem OG** (`api/aprovacao/[token]/og`).

---

## 2. Tipografia

- **Fontes:** DM Sans (corpo) e Sora (títulos, via `font-display`/`h1…h6`), pesos 400–700. `font-extrabold`/`font-black` não existem, porque o peso não é carregado.
- **Escala:**

| Classe | Tamanho/linha | Uso |
|---|---|---|
| `text-caption` / `text-xs` | 12/16 | metadados, badges, legendas |
| `text-label` | 13/18 | rótulos de campo |
| `text-body` / `text-sm` | 14/20 | corpo |
| `text-base` | 16/24 | corpo grande |
| `text-title` | 20/28 | título de card/seção |
| `text-headline` | 24/32 | título de página |
| `text-display` | 30/36 | KPI grande |

- **Piso de 12px.** Nada de `text-[9px]`, `[10px]` ou `[11px]` em UI de produto. Exceções:
  - mockups de celular;
  - selos de 11px sobre miniatura de mídia (`bg-black/60 text-white`);
  - iniciais dentro de avatar pequeno (`cliente-avatar.tsx`).
- **Peso:** bold é para títulos e números. Rótulos e corpo ficam em `font-medium`/`font-semibold`.
- **Números:** `tabular-nums` em KPIs, tabelas, datas e contadores.
- **Rótulo de grupo em caixa alta:** a utility `eyebrow` (12px, tracking 0.08em). Serve só para cabeçalho de grupo (sidebar, colunas), nunca como "kicker" em cima de um título.

---

## 3. Componentes base (`src/components/ui`)

| Componente | Notas |
|---|---|
| `Button` | Variantes `primary` (tinta/lima), `lime` (CTA de publicar), `secondary`, `outline`, `ghost`, `destructive`. Foco: `ring-2 ring-ring ring-offset-2`. Raio `rounded-xl`. |
| `Badge` | Variantes `success`, `warning`, `destructive`, `info`, `brand`, `muted`, mais a prop `dot`. `STATUS_LABELS` em `lib/conteudo.ts` já mapeia cada etapa da esteira para uma variante. |
| `Input` / `Select` / `Textarea` | Usam `fieldInputClass` de `lib/form-styles.ts` (`border-input`, foco em `ring`, `aria-invalid` vermelho). Campo cru (`<input>`) usa `border-input`, nunca `border-border`. |
| `Card` | `bg-card border-border rounded-2xl shadow-2xs`. `interactive` só em card realmente clicável. |
| `Sheet` | Modal padrão, sobre o Dialog do Base UI: foco preso, foco devolvido ao gatilho, scroll travado, Esc/clique fora. A prop `dirty` pede confirmação antes de descartar alterações. Dialogs renderizados **dentro** dele são aninhados (o Esc fecha só o de cima). |
| `confirmDialog()` (`ui/dialog.tsx`) | Substitui `window.confirm()`: `if (!(await confirmDialog({ title, description, confirmLabel, tone: 'destructive' }))) return;`. O título diz a ação; a descrição, a consequência. `confirm()` e `alert()` nativos são **proibidos**. |
| `MediaLightbox` | Zoom de imagem/vídeo. Renderize dentro do Sheet que o abre. |
| `toast` (`ui/toast.tsx`) | `toast.success/error/warning/info(título, { description })` de qualquer lugar, com fila, pausa no hover e swipe. `toast.undo(título, onUndo, { onClose })` serve para exclusão adiada com "Desfazer" (padrão em `rotina-tab.tsx`). O `showToast` antigo das abas já delega para cá. |
| `Tip` (`ui/tooltip.tsx`) | Tooltip acessível (hover + foco), com `shortcut` opcional. Substitui `title=`. Botão só de ícone continua precisando de `aria-label`. |
| `Skeleton` / `SkeletonRows` | Carregamento com o formato do conteúdo, no lugar de spinner ou texto solto. |
| `EmptyState` | Ícone, título, descrição, `action` (próximo passo) e `secondaryAction`. `size="compact"` para colunas e painéis. |
| `CalendarPicker`, `MemberChipSelect`, `Board` | Ver o código. |

`cn()` (`lib/utils.ts`) é um tailwind-merge estendido com a escala tipográfica. Sem isso, `text-label text-foreground` perderia o tamanho.

Raios: card/modal `rounded-2xl`, campo/botão `rounded-xl`, pill/avatar `rounded-full`. Nada de `rounded-[38px]` fora de mockup de celular.

---

## 4. Tema

- O script inline em `layout.tsx` aplica `.dark` antes da hidratação. Se existir preferência salva (`localStorage.gensbot_theme`), ela vale; senão, segue `prefers-color-scheme`.
- Os toggles em `page.tsx` e na aprovação só **leem** a classe do `<html>` e gravam a escolha.
- Nunca condicione cor ao tema no componente (`theme === 'dark' ? … : …`). O token resolve.
- `color-scheme`, seleção de texto (lima), caret (`brand-text`), placeholder e scrollbar já são temáticos no `@layer base`.

---

## 5. Do's & Don'ts

- **DO:** status sempre por token (`Badge` ou a receita soft/ring). Se precisar de um tom novo, crie o token no `globals.css` com contraste medido nos dois temas.
- **DO:** borda sem opacidade (`border-border`, não `border-border/60`). O token já é calibrado; opacidade derrubava a hairline para ~1.1:1 no escuro.
- **DO:** texto secundário é `text-muted-foreground`, sem `/50` ou `/60`.
- **DON'T:** `text-white` em fundo de status, `text-lime` em fundo claro, hex solto, paleta crua fora das exceções da seção 1.
- **DON'T:** sombra "bloco" sem blur (`4px 4px 0`). A profundidade é sombra suave com offset e blur.

---

## 6. Roteiro (Ondas)

Cada Onda é mergeada e testada antes da próxima.

1. ✅ **Fundação:** tokens de contraste, piso de 12px, varredura de cores, Badge/Button/Input/Card.
2. ✅ **Primitivos de interação:**
   - Dialog, AlertDialog, Tooltip e Toast do Base UI, sem dependência nova.
   - Os 22 `confirm()`/`alert()` foram trocados, e o toast do `page.tsx` agora usa o gerenciador global.
   - `Sheet` com focus trap e `dirty`; os lightboxes e modais feitos à mão viraram Dialog.
   - Skeletons, Ctrl+B e tooltips no shell.
   - Ficou para depois: o FlowBuilder (entra com o aviso de alterações não salvas na Onda 3), os ~110 `title=` fora do shell (trocar ao mexer em cada tela) e o "Desfazer" nas outras exclusões.
3. ✅ **Dados honestos e segurança:**
   - **Regra permanente: nenhum número inventado na UI.** Sem dado, a tela mostra 0, "—" ou um EmptyState que explica o motivo. Nada de fallback `|| 12450`, `Math.random()` ou valor "de exemplo".
   - Métricas, Dashboard e relatório (interno e público) usam só dados da Meta, via `lib/instagram-insights.ts` e `lib/content-performance.ts`. O comparativo mês a mês saiu até existir backend para ele.
   - O link público de relatório é assinado com HMAC (`lib/relatorio-token.ts`) e só é gerado no servidor (`POST /api/relatorio/link`). Links antigos `rel_` são recusados.
   - Aviso de alterações não salvas na Esteira (criar/editar), na Publicação (trocar o rascunho), nas Automações (sair do editor) e no FlowBuilder.
   - Feedback real na Publicação e na exclusão em massa de contatos.
   - Ficou para depois: histórico de relatórios no banco (hoje fica no localStorage) e demografia via `follower_demographics`.
4. **Shell e navegação:**
   - Aba na URL (deep link e voltar).
   - Command Palette com Ctrl+K e o Ctrl+B que já é anunciado.
   - Sidebar reorganizada (agência × conta do Instagram).
   - Drawer mobile que fecha ao navegar.
   - Remover código morto: `crm-board`, `calendar-view`, `kanban-board` e `logs-tab` não são renderizados.
5. **Telas:**
   - Quebrar o `esteira-tab` (~3.5k linhas); o board real ainda usa drag nativo e não o `ui/board.tsx`.
   - Calendário com arrastar para reagendar.
   - Composer em etapas.
   - Aprovação do cliente com nome e desfazer.
   - KPIs no padrão Stat Cards.
6. **Motion:** springs interrompíveis (apple-design) e `prefers-reduced-motion` em tudo.

Referências de produto: **Linear** (sidebar e cor só em estado/ação), **Attio** (cards de CRM com ação no hover), **Notion Calendar** (cor como estrutura) e **Spectrum UI** (contraste de status, command palette, undo pill, stat cards).

---

## 7. Histórico

- **v5 → v6:**
  - O dark voltou ao preto neutro; o código tinha migrado para "obsidian forest" oliva sem atualizar este documento.
  - Tokens de status passaram para o padrão soft/ring e ganharam `info`, `brand-text`, `border-strong` e `input` real.
  - Piso de 12px e sombra suave no lugar da sombra bloco.
  - Corrigido também: a v5 dizia que os boards estavam consolidados, mas a Esteira nunca migrou.
- **v4 → v5:** a paleta "Oat & Clay" foi substituída pela paleta oficial GENS (lima/tinta).
- **v3 → v4:** a paleta fintech azul foi substituída por "Oat & Clay".
- As versões anteriores estão no histórico do git deste arquivo.
