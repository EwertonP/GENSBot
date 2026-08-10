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
  created_at?: string;
}
