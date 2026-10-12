export type WorkspaceTipo = 'agencia' | 'cliente';

export interface WorkspaceContexto {
  tipo: WorkspaceTipo;
  clienteId: string | null; // UUID na tabela 'clientes', ou null se for a Agência GENS
  nome: string;
  nicho?: string | null;
  cor?: string | null;
  fotoUrl?: string | null;
  instagramAccountId?: string | null; // UUID em 'instagram_accounts'
  instagramUserId?: string | null; // ID numérico do Instagram (ex: "178414...")
  instagramUsername?: string | null; // @ do Instagram
}
