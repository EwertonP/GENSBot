import type { Followup } from './automation';

/** Sequência reutilizável entre automações (Fase 4) — substitui o array `followups` embutido por automação. */
export interface Sequence {
  id?: string;
  name: string;
  steps: Followup[];
  created_at?: string;
  updated_at?: string | null;
}
