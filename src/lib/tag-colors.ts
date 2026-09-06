// Paleta de cores pra tags — cor sempre a mesma pra uma mesma tag (hash do texto),
// não realmente aleatória a cada render, senão a mesma tag mudaria de cor sozinha.
const TAG_COLOR_PALETTE = [
  'bg-rose-500/10 text-rose-600 border-rose-500/20',
  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'bg-sky-500/10 text-sky-600 border-sky-500/20',
  'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20',
  'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'bg-lime-500/10 text-lime-700 border-lime-500/20',
  'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
];

export function tagColorClasses(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
}
