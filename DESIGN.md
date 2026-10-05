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
| `DataTable` / `DataTablePagination` (`ui/data-table.tsx`) | Toda lista em tabela usa este componente (receita da Audiência): 14px, cabeçalho `text-xs font-medium` em caixa normal, linha clicável, `SkeletonRows` ao carregar, `empty` no lugar das linhas. Cada coluna diz seu papel no celular (`mobile: 'primary' \| 'meta' \| 'hidden'`); abaixo de `sm` a linha vira cartão. Ações da linha em `actions`, com `IconButton`. |
| `IconButton` (`ui/icon-button.tsx`) | Botão só de ícone: `label` vira `aria-label` e `Tip`. Toque de 40px no celular, 32px a partir de `sm`. Use em vez de `<button className="p-1.5 …">`. |
| `CalendarPicker`, `MemberChipSelect` | Ver o código. |
| `CommandPalette` | Busca rápida (Ctrl/⌘+K), com itens `{ label, grupo, icon, keywords, run }`. A busca ignora acentos. |

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

### 5.1 Celular

A equipe usa o sistema no celular. Toda tela nova é conferida em 375px antes do merge.

- **Pontos de quebra:** `sm` (640px) separa celular de tablet; `lg` (1024px) é onde painéis laterais (prévia, propriedades) passam a ficar ao lado do conteúdo. Abaixo de `lg`, painel lateral vira aba ou botão "Ver prévia".
- **Toque:** alvo mínimo de 40px abaixo de `sm` (`IconButton` já faz isso). Itens de menu e linhas de lista com 44px.
- **Tabela:** sempre `DataTable`. Rolagem lateral não é solução no celular; a linha vira cartão e as ações ficam visíveis.
- **Largura fixa:** nada de `w-[300px]` ou maior sem `max-w-full` ou variante responsiva. Grade de 3+ colunas começa em `grid-cols-1` e cresce com `sm:`/`lg:`.
- **Arrastar:** arrastar e soltar não funciona no toque. Toda ação de arrastar tem um caminho por menu (ex.: "Mover para…").
- **Texto:** o piso de 12px vale no celular também. Exceções: o conteúdo dentro de uma prévia que imita o Instagram ou o Direct, e a inicial dentro de avatar de 16 a 32px (um caractere que precisa caber no círculo).
- **Dica:** `title=` não aparece no toque nem no foco do teclado. Use `Tip` (ou `IconButton`, que já traz um). `title` só em `iframe`, onde é o nome acessível.

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
4. ✅ **Shell e navegação:**
   - `components/nav-config.tsx` é a fonte única das telas (rótulo, título, subtítulo, ícone, grupo). Tela nova entra ali, e menu, cabeçalho, barra do celular e busca rápida se atualizam juntos.
   - `navegarPara(tela, { item })` no `page.tsx` é a única porta de navegação: confere edição não salva, fecha o menu do celular e grava `?tab=…&item=…` na URL. Recarregar mantém a tela e o voltar do navegador funciona.
   - Busca rápida (`components/command-palette.tsx`) com Ctrl/⌘+K: telas, trocar de conta, nova demanda, agendar, nova automação e tema.
   - O menu tem dois grupos, "Agência" e "Instagram · @conta". A tela ativa é marcada com um filete na cor de marca. Equipe ficou no menu do perfil.
   - Celular: o menu fecha ao navegar, tem botão de fechar e abre sempre expandido; a barra do topo mostra o título da tela.
   - Trocar de conta mostra uma barra de progresso em vez do esqueleto de tela inteira.
   - Removidos `crm-board`, `calendar-view`, `kanban-board`, `logs-tab`, `sequence-manager`, `ui/board` e o chat antigo do `page.tsx`.
   - Ficou para depois: tirar o estado das automações do `page.tsx` (~50 props para o `AutomationsTab`).
5. **Telas**, entregues em 3 PRs:
   - ✅ **5a:**
     - **Aprovação do cliente:**
       - O nome é pedido uma vez e lembrado no navegador.
       - Aprovar mostra "Aprovado · Desfazer" por 8s antes de enviar; se a aba fechar, envia via `sendBeacon`.
       - O ajuste pode ser "este slide/momento" ou "a publicação toda".
     - **Esteira:**
       - Cards focáveis: Enter abre, e Alt + ←/→ muda de etapa.
       - Menu "Mover para…" (`mover-etapa-menu.tsx`) para teclado e toque.
       - Um só vocabulário de etapas: Planejamento, Criação, Revisão interna, Aprovação do cliente, Agendamento, Publicado.
   - ✅ **5b:**
     - **Calendário:**
       - Arrastar um post para outro dia reagenda, mantendo o horário, com "Desfazer".
       - "Mudar data" no detalhe do post, para quem não usa mouse.
       - Busca por título, legenda ou cliente.
       - "+N outros" abre a visão do dia.
     - **Dashboard:** KPIs em `StatCard` (`ui/stat-card.tsx`), com valor, frase explicativa e `Sparkline` de dado real.
       - Saíram os deltas fixos que sobraram (+24,8%, +17,4%, +148, +31,2%, +19,4%), as barras de horário inventadas e o "18h às 21h" fixo.
       - O melhor horário passa a ser calculado pela janela de 3h com mais seguidores online.
   - ✅ **5c:**
     - **Publicação em passos:** Formato e mídia → Legenda → Automação → Publicar, com indicador de passo concluído e botões Voltar/Próximo. Todos os campos continuam montados (só um passo aparece), então nada se perde ao trocar de passo. A prévia do celular já era fixa ao lado.
     - **`hooks/use-automation-editor.ts`:** o estado do editor de automação (formulário, perguntas, condição, aviso de saída) saiu do `page.tsx`, movido sem mudar a lógica. Os dados carregados (`automations`, mídias, UTM) continuam na página, porque o Dashboard também usa.
     - **Esteira:** os modais "Duplicar mês" e "Enviar para aprovação" viraram `esteira-duplicar-mes-sheet.tsx` e `esteira-aprovacao-whatsapp-sheet.tsx`.
     - **Ainda por fazer:** o `esteira-tab` continua com ~3.2k linhas. Os formulários de criar e editar demanda são quase idênticos e são o próximo candidato a virar um componente único, mas exigem testes com dados reais.
6. ✅ **Motion:** ver §6.1 abaixo.

### 6.1 Regras de movimento

- **Uma curva só.** O padrão de toda `transition-*` é 160ms com `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-out-expo`, rápida no começo e assenta devagar), definido no `@theme`. Overlays de entrada usam 200–300ms (ver `ui/dialog.tsx`); saídas são mais curtas (100–150ms).
- **Interrompível.** Transições CSS retargeteiam no meio do caminho e são preferidas a keyframes. A troca de tela usa só entrada (fade de 180ms), sem esperar a saída da tela anterior. Não use `AnimatePresence mode="wait"` em navegação.
- **Nada de `transition-all`.** Use `transition-ui` (cor, sombra, opacidade, transform) ou propriedades explícitas, como `transition-[width,translate]` na sidebar. `transition-all` só onde o tamanho anima de propósito (barras de progresso).
- **`animate-fade-in`** (só opacidade, 200ms) existe de verdade agora; antes era usada em ~30 telas sem estar definida.
- **"Reduzir movimento"** (`prefers-reduced-motion`): animações viram instantâneas, deslocamento e escala deixam de animar e `hover:scale-*` / `active:scale-*` / `hover:-translate-y-*` não se aplicam, mas cor, opacidade e sombra continuam animando, porque são o feedback de estado. As animações em JS (`motion/react`) obedecem por `MotionConfig reducedMotion="user"` no layout.
- **Um momento autoral por tela**, não efeitos espalhados. Micro-interações (hover, foco) são discretas; o destaque é a entrada dos overlays (Dialog, busca rápida, toasts).

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
