import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Ensina ao tailwind-merge a escala tipográfica do globals.css — sem isso
// `text-label` seria tratado como cor e `cn()` descartaria o tamanho ao
// combinar com `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "label", "body", "title", "headline", "display"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
