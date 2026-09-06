import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

// Cliente Supabase usando a Service Role Key para ignorar RLS no backend.
// NOTA: existe um `Database` gerado do schema real (src/types/database.ts) que daria
// tipagem completa aqui, mas plugar `createClient<Database>` quebra ~60 call sites
// no projeto hoje (colunas JSONB tipadas como `Json` genérico em vez do shape que o
// código já assume, `string | null` do banco passado onde o código espera `string`,
// etc.) — migrar pra isso é um trabalho à parte, não um plug-and-play seguro agora.
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
