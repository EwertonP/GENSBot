-- ============================================================
-- GENSBot Flow Engine — schema para o canvas visual de automações
-- (nós trigger/sendMessage/condition/delay/action), sequências
-- reutilizáveis e histórico de versões.
-- Ver plano em ZERNFLOW-MELHORIAS.md. Não altera nem remove
-- nenhuma coluna/tabela legada — automações sem flow_definition
-- continuam funcionando exatamente como hoje.
-- ============================================================

-- 1. automations: coluna nova para o fluxo em grafo (nodes/edges).
--    flow_definition = null significa automação ainda no modelo
--    legado (form linear); presente = já migrada pro canvas.
ALTER TABLE automations ADD COLUMN IF NOT EXISTS flow_definition JSONB;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS flow_version INTEGER NOT NULL DEFAULT 0;

-- 2. sequences: entidade própria e reutilizável entre automações,
--    desacoplada do array jsonb `followups` hoje embutido em cada
--    automação individualmente. `steps` espelha a shape de Followup
--    (id, delay_minutes, text, link_url?, link_text?, link_button_label?).
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instagram_user_id TEXT,
  name TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_sequences" ON sequences;
CREATE POLICY "users_see_own_sequences" ON sequences
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. automation_versions: snapshot do flow_definition ANTERIOR a cada
--    publicação (não do novo) — ver ZERNFLOW-MELHORIAS.md / plano,
--    seção "Fase 5" pra decisão de não duplicar o estado atual.
CREATE TABLE IF NOT EXISTS automation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  flow_definition JSONB NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (automation_id, version_number)
);

ALTER TABLE automation_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_automation_versions" ON automation_versions;
CREATE POLICY "users_see_own_automation_versions" ON automation_versions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_automation_versions_automation
  ON automation_versions (automation_id, version_number DESC);

-- 4. contacts: ponteiro genérico de posição dentro de um flow_definition
--    (nó de delay aguardando, ou nó esperando resposta livre tipo
--    e-mail/telefone). `conversation_state` NÃO é removida — continua
--    servindo o caminho legado (compat.ts) para automações sem
--    flow_definition.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS flow_run_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS flow_node_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS flow_state JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contacts_flow_node ON contacts (flow_node_id) WHERE flow_node_id IS NOT NULL;
