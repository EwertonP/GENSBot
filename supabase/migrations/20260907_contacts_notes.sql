-- ============================================================
-- Adiciona campo de observações livres no lead — pra registrar contexto
-- que não cabe numa tag (ex: "é cirurgião plástico, dor principal é
-- captar pacientes particulares") enquanto o usuário acompanha a
-- conversa na aba de Contatos.
-- ============================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
