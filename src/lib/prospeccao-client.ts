import { createClient } from '@supabase/supabase-js';

/**
 * Segunda conexão Supabase — o CRM (Onda 4) lê/escreve direto no banco do
 * Prospecção Gens (projeto separado, `nbzaikqdnuhdzakghxnc`), sem duplicar
 * dado nem sincronizar nada: mesmo padrão de várias contas de Instagram
 * conectadas, só que pra um banco inteiro em vez de uma API externa.
 *
 * Usa a service role key (bypassa RLS) porque é ferramenta interna da própria
 * agência — o schema original (`prospeccao-b2b/supabase/migrations/001_schema.sql`)
 * já documenta isso como single-tenant, sem client_id.
 *
 * Env vars precisam ser configuradas manualmente no dashboard da Vercel
 * (Settings > API do projeto ProspeccaoGens no Supabase tem a URL e a
 * service_role key) — não são criadas automaticamente, e o GENSBot não tem
 * como obter a service role key sozinho (só a anon key é exposta por
 * ferramentas de automação, por design de segurança do próprio Supabase).
 */
export function getProspeccaoClient() {
  const url = process.env.PROSPECCAO_SUPABASE_URL;
  const key = process.env.PROSPECCAO_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
