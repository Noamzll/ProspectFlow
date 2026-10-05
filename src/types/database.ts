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
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
