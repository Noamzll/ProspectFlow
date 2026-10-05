import { isValidWebsite, prospectStatuses, validateProspect } from "./prospect-validation.ts";
import type { Prospect, ProspectInput } from "@/types/prospect";
import type { ProspectRow } from "@/types/database";

export function fromProspectRow(row: ProspectRow): Prospect {
  if (!prospectStatuses.includes(row.statut)) throw new Error("Un prospect cloud contient un statut non reconnu.");
  if (row.site_internet && !isValidWebsite(row.site_internet)) throw new Error("Un prospect cloud contient un site internet invalide. Corrigez cette valeur dans Supabase.");
  return {
    id: row.id, company: row.entreprise, sector: row.secteur ?? "", city: row.ville,
    email: row.email ?? "", website: row.site_internet ?? "", status: row.statut,
    nextAction: row.prochaine_action ?? "", createdAt: row.created_at ?? "",
    notes: row.notes ?? "", nextActionDate: row.prochaine_action_date ?? "", isClient: row.is_client ?? false,
  };
}

export function toProspectFields(input: ProspectInput) {
  if (Object.keys(validateProspect(input)).length) throw new Error("Les coordonnées du prospect sont invalides. Vérifiez les champs du formulaire.");
  return {
    entreprise: input.company, secteur: input.sector, ville: input.city,
    email: input.email || null, site_internet: input.website || null, statut: input.status,
    prochaine_action: input.nextAction || null, notes: input.notes || null,
    prochaine_action_date: input.nextActionDate || null, is_client: input.isClient,
  };
}
