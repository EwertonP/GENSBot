-- ============================================================
-- Rastreamento de cliques nos links UTM. Antes um link UTM era só a URL
-- com os parâmetros anexados — sem contar nada. Agora cada link ganha um
-- código curto que passa por um redirect próprio (src/app/r/[code]) antes
-- de ir pro destino real; esse redirect loga um analytics_events do tipo
-- 'link_clicked' (o mesmo tipo já somado no funil/ranking do dashboard),
-- e opcionalmente vinculado a uma automação — permitindo comparar quantas
-- vezes a automação rodou vs quantas vezes o link final foi de fato clicado.
-- ============================================================

ALTER TABLE utm_links ADD COLUMN IF NOT EXISTS short_code TEXT;
ALTER TABLE utm_links ADD COLUMN IF NOT EXISTS automation_id UUID REFERENCES automations(id) ON DELETE SET NULL;
ALTER TABLE utm_links ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_utm_links_short_code ON utm_links (short_code) WHERE short_code IS NOT NULL;
