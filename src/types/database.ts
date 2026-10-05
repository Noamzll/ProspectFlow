import type { ProspectStatus } from "./prospect";

export type ProspectRow = {
  id: string;
  user_id: string;
  entreprise: string;
  secteur: string | null;
  ville: string;
  email: string | null;
  site_internet: string | null;
  statut: ProspectStatus;
  prochaine_action: string | null;
  created_at: string | null;
  updated_at: string | null;
  notes: string | null;
  prochaine_action_date: string | null;
  is_client: boolean;
  sheet_external_id?: string | null;
  sheet_payload_hash?: string | null;
};

export type ProspectInsert = Pick<ProspectRow, "user_id" | "entreprise" | "ville" | "statut"> & Partial<Omit<ProspectRow, "user_id" | "entreprise" | "ville" | "statut">>;

export type Database = {
  public: {
    Tables: {
      prospects: {
        Row: ProspectRow;
        Insert: ProspectInsert;
        Update: Partial<ProspectInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      sync_google_sheet_prospects: {
        Args: { p_user_id: string; p_rows: { externalId: string; entreprise: string; secteur: string; ville: string; email: string | null; site_internet: string | null; statut: ProspectStatus; prochaine_action: string | null }[]; p_dry_run: boolean };
        Returns: { created: number; updated: number; unchanged: number; dryRun: boolean };
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
