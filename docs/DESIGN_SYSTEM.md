# Design System GENSBot — Padrão Hero Gradient & Tipografia

Este documento define o padrão visual oficial adotado no **Financeiro** e replicado em todas as telas principais do GENSBot (**Dashboard**, **CRM**, **Demandas & Esteira**, **Formulários**, **Propostas & Contratos** e **Calendário**).

---

## 1. Tipografia Oficial

| Token / Classe | Fonte | Uso Permitido |
| :--- | :--- | :--- |
| `font-display` | **Sora** | Títulos de seção, títulos de cards, valores de KPIs em destaque. |
| `font-sans tabular-nums` | **DM Sans** | Textos corridos, labels, botões, tabelas, valores monetários (`R$`), datas e contadores. |
| `font-mono` | Monoespaçada | **Uso restrito** exclusivamente a códigos curtos (`#LEAD-A1B2`), URLs técnicas, tokens e slugs. **Nunca** usar em títulos, cabeçalhos de tabela, botões ou valores em `R$`. |

---

## 2. Hero Gradient Panel (`HeroGradientPanel`)

Container principal de topo de página que cria profundidade visual suave tanto no **Dark Mode** quanto no **Light Mode**, utilizando o componente reutilizável em `src/components/ui/hero-gradient-panel.tsx`.

- **Container externo:**
  `rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-xs flex flex-col gap-5`
- **Eyebrow / Data:** `text-xs text-muted-foreground`
- **Título Hero:** `font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground`
- **Pílula de Contexto (canto superior direito):**
  `inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-xs font-semibold text-foreground`

---

## 3. Sub-Cards de KPI (`HeroKpiCard`)

Cards posicionados dentro do `HeroGradientPanel`:

- **Container:** `rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs p-4 flex flex-col justify-between gap-2 shadow-2xs`
- **Cabeçalho com Ícone Squircle:** `grid size-7 place-items-center rounded-xl bg-<cor>-500/15 text-<cor>-500`
- **Valor Principal:** `font-display text-2xl sm:text-3xl font-bold tabular-nums`
- **Pílula Comparativa / Subtexto:** `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold`

---

## 4. Exemplo de Uso

```tsx
import { HeroGradientPanel, HeroKpiCard } from '@/components/ui/hero-gradient-panel';
import { Wallet, TrendingUp } from 'lucide-react';

<HeroGradientPanel
  eyebrow="Quinta, 12 de novembro"
  title="Caixa da Agência"
  badge="Competência: Novembro"
  badgeIcon={Wallet}
>
  <HeroKpiCard
    label="Receitas do mês"
    value="R$ 42.500,00"
    valueTone="success"
    icon={TrendingUp}
    iconTone="emerald"
    hint="+18% vs. mês anterior"
  />
</HeroGradientPanel>
```
