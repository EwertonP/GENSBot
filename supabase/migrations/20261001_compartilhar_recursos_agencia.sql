-- Migration: 20261001_compartilhar_recursos_agencia.sql
-- Permite que membros da mesma agência visualizem e gerenciem recursos compartilhados
-- (automações, versões de automação, contas do Instagram conectadas, posts agendados,
-- contatos/leads, links UTM e sequências).

CREATE OR REPLACE FUNCTION private.mesma_agencia(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membros m1
    JOIN public.membros m2 ON m1.agencia_id = m2.agencia_id
    WHERE m1.id = auth.uid()
      AND m2.id = target_user_id
      AND m1.ativo = true
      AND m2.ativo = true
  );
$$;

COMMENT ON FUNCTION private.mesma_agencia(uuid) IS
  'Retorna true se o usuário logado (auth.uid()) e target_user_id pertencem à mesma agência e ambos estão ativos.';
