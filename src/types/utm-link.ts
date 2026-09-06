export interface UtmLink {
  id?: string;
  name?: string | null;
  base_url: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  generated_url: string;
  /** Código do redirect de rastreamento (src/app/r/[code]). */
  short_code?: string | null;
  /** URL completa do redirect — calculada pela API, não salva no banco. */
  short_url?: string | null;
  /** Automação cujo link final usa este link — permite comparar execuções vs cliques. */
  automation_id?: string | null;
  click_count?: number;
  created_at?: string;
}
