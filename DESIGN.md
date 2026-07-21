# Design System: Clean Mind style (DESIGN.md)

Este documento atua como o contrato de design e "fonte de verdade" visual (Single Source of Truth) para o desenvolvimento do **InstaFlow (GENSBot)**. Qualquer agente de IA ou desenvolvedor deve ler e seguir estritamente estas especificações para manter a consistência visual.

---

## 1. Design Tokens

### Cores (Color Palette)
* **Brand Primary (Forest Green)**: `#0A3A20`  
  *Utilizado em botões principais, destaques ativos, títulos de cabeçalhos e estados de foco.*
* **Brand Accent (Lime/Neon Green)**: `#CEF96F`  
  *Utilizado em marcas de conexão ativa, caminhos ativos no fluxograma, e borders de badges destacados.*
* **Soft Brand Background (Pastel Green)**: `#F0FDF4`  
  *Utilizado como cor de fundo para alertas ativos, contatos selecionados e elementos em destaque suave.*
* **Neutros (Neutrals)**:
  * **Fundo Geral (Main Background)**: `#F8FAFC`
  * **Bordas Principais (Borders)**: `#E2E8F0` (Slate 200) ou `#F1F5F9` (Slate 100)
  * **Textos Principais**: `#0F172A` (Slate 900)
  * **Textos Secundários**: `#475569` (Slate 600) *— Nota: Evitar cinzas mais claros que Slate 500 para garantir acessibilidade de contraste (WCAG).*

### Arredondamento (Border Radius Scale)
* **Containers Externos, Cards Principais & Modais**: `rounded-2xl` (16px)  
  *Garante consistência e visual amigável nas divisões do painel.*
* **Inputs, Selects, Textareas e Tabs**: `rounded-xl` (12px)  
  *Para áreas interativas compactas.*
* **Botões de Ação Principais e Badges de Estado**: `rounded-full` (Pill format)

### Espaçamento (Spacing)
* Seguir estritamente a grade do Tailwind:
  * Margens e paddings de cards: `p-6` (24px) para cards de fluxo e painéis.
  * Distâncias internas de formulários: `gap-4` ou `gap-6`.
  * Paddings de inputs: `px-4 py-2.5`.

---

## 2. Padrões de Componentes

### Botão Primário (Primary Button)
```html
<button className="px-5 py-2.5 rounded-full bg-[#0A3A20] hover:bg-[#125835] text-white font-bold text-sm shadow-md shadow-emerald-950/10 transition-all cursor-pointer">
  Texto do Botão
</button>
```

### Campos de Entrada (Form Controls)
```html
<input 
  type="text" 
  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0A3A20] focus:ring-1 focus:ring-[#0A3A20]/20 text-slate-800 placeholder-slate-400 transition-all" 
/>
```

### Badge de Gatilho / Tags
```html
<span className="text-[9px] bg-[#F0FDF4] text-[#0A3A20] font-extrabold px-1.5 py-0.5 rounded-md border border-[#CEF96F]/30 uppercase tracking-wider">
  Tag
</span>
```

---

## 3. Diretrizes de UX (Do's & Don'ts)

* **DO**: Sempre conecte visualmente as etapas do fluxo de automação usando a linha vertical guia.
* **DO**: Utilize avatares com iniciais coloridas para contatos no chat se não houver foto de perfil.
* **DON'T**: Nunca introduza gradientes roxos, azuis ou vermelhos na interface padrão.
* **DON'T**: Evite acumular múltiplos pesos de fonte na mesma seção (ex: evite misturar `font-black` com `font-extrabold` desnecessariamente). Use pesos padrão (`font-normal`, `font-semibold`, `font-bold` e `font-extrabold` para títulos principais).
