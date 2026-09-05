-- ============================================================
-- Foto de perfil do Instagram para leads/contatos.
-- Aditiva — não remove nem altera nenhuma coluna existente.
-- ============================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
