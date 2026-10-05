export type ProspectStatus =
  | "Nouveau"
  | "À vérifier"
  | "Brouillon prêt"
  | "Envoyé"
  | "Réponse reçue";

export type Prospect = {
  id: string;
  company: string;
  sector: string;
  city: string;
  email: string;
  website: string;
  status: ProspectStatus;
  nextAction: string;
  createdAt: string;
  isClient: boolean;
  nextActionDate?: string;
  notes?: string;
};

export type ProspectInput = Omit<Prospect, "id" | "createdAt">;
