# Design System: Spotify style (DESIGN.md)

Este documento atua como o contrato de design e "fonte de verdade" visual (Single Source of Truth) para o desenvolvimento do **InstaFlow (GENSBot)**. Qualquer agente de IA ou desenvolvedor deve ler e seguir estritamente estas especificações para manter a consistência visual baseada no design do Spotify.

---

## 1. Design Tokens

### Cores (Color Palette)
* **Canvas (Main Background)**: `#121212` (Fundo principal do aplicativo).
* **Surface 1 (Sidebar, Bottom Player Bars)**: `#1A1A1A`
* **Surface 2 (Cards, hover backgrounds, active rows)**: `#282828`
* **Surface 3 (Input fields, secondary hover states)**: `#333333`
* **Border**: `#3E3E3E`
* **Brand Primary (Spotify Green)**: `#1DB954`  
  *Utilizado exclusivamente em botões de ação principal, status ativo, progresso e CTAs.*
* **Brand Primary Hover**: `#1ED760`
* **Muted Text / Secondary**: `#A7A7A7`
* **White / Primary Text**: `#FFFFFF`
* **Error**: `#F15E6C`

### Arredondamento (Border Radius Scale)
* **Containers Externos, Cards Principais & Modais**: `rounded-2xl` (16px)  
* **Inputs, Selects, Textareas e Tabs**: `rounded-xl` (12px)  
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
<button className="px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-black font-bold text-sm shadow-md shadow-emerald-950/10 transition-all cursor-pointer">
  Texto do Botão
</button>
```

### Campos de Entrada (Form Controls)
```html
<input 
  type="text" 
  className="bg-[#282828] border border-[#3E3E3E] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/20 text-white placeholder-[#A7A7A7] transition-all" 
/>
```

### Badge de Gatilho / Tags
```html
<span className="text-[9px] bg-[#282828] text-[#1DB954] font-extrabold px-1.5 py-0.5 rounded-md border border-[#1DB954]/20 uppercase tracking-wider">
  Tag
</span>
```

---

## 3. Diretrizes de UX (Do's & Don'ts)

* **DO**: Utilize o fundo escuro `#121212` para todas as telas principais do aplicativo.
* **DO**: Garanta que as fontes secundárias tenham contraste suficiente (mínimo de `#A7A7A7` para manter a legibilidade WCAG AA).
* **DON'T**: Nunca introduza cores brilhantes e coloridas para elementos passivos; a cor de marca (`#1DB954`) é reservada para sinalizar "Ação" ou "Estado Ativo".
* **DON'T**: Não use bordas brancas ou cinzas claras; as bordas e divisores devem usar `#3E3E3E` ou `#282828`.
