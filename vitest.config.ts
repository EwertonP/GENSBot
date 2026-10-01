import { defineConfig } from 'vitest/config';
import path from 'path';

// Faltava um config de vitest no projeto — nenhum teste até agora puxava (nem
// transitivamente) um arquivo que importa pelo alias "@/" (tsconfig.json), só
// por import relativo. src/lib/instagram-insights.ts e src/lib/content-performance.ts
// usam "@/lib/supabase", e o vitest não resolve esse alias sem isso — quebrava com
// "Cannot find package '@/lib/supabase'" assim que um teste importava algo que
// encostava neles de verdade (ex: servidor.ts do MCP, via ferramentas-c10.ts).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
