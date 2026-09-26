// Paleta de cores pra tags — cor sempre a mesma pra uma mesma tag (hash do texto),
// não realmente aleatória a cada render, senão a mesma tag mudaria de cor sozinha.
// Tags são categóricas (não semânticas), então aqui a paleta crua do Tailwind é
// intencional. Padrão Spectrum: texto 800 no claro / 300 no escuro sobre fundo
// 10% — todos ≥4.5:1 nos dois temas (os antigos 600 davam ~3:1).
const TAG_COLOR_PALETTE = [
  'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-600/25 dark:border-rose-300/25',
  'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-600/25 dark:border-amber-300/25',
  'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-600/25 dark:border-emerald-300/25',
  'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-600/25 dark:border-sky-300/25',
  'bg-violet-500/10 text-violet-800 dark:text-violet-300 border-violet-600/25 dark:border-violet-300/25',
  'bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-600/25 dark:border-fuchsia-300/25',
  'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-600/25 dark:border-cyan-300/25',
  'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-600/25 dark:border-orange-300/25',
  'bg-lime-500/10 text-lime-800 dark:text-lime-300 border-lime-600/25 dark:border-lime-300/25',
  'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-600/25 dark:border-indigo-300/25',
];

export function tagColorClasses(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
}
