import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltando variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.');
}

// Cliente Supabase usando a Service Role Key para ignorar RLS no backend
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
