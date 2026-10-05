import type { Prospect, ProspectInput, ProspectStatus } from "@/types/prospect";

export const prospectStatuses: ProspectStatus[] = [
  "Nouveau", "À vérifier", "Brouillon prêt", "Envoyé", "Réponse reçue",
];

export type FormErrors = Partial<Record<keyof ProspectInput, string>>;

export function isValidActionDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidWebsite(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname)
      && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateProspect(input: ProspectInput): FormErrors {
  const errors: FormErrors = {};
  for (const field of ["company", "sector", "city"] as const) {
    if (!input[field].trim()) errors[field] = "Ce champ est obligatoire.";
    else if (input[field].length > 120) errors[field] = "120 caractères maximum.";
  }
  if (input.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254)) {
    errors.email = "Indiquez une adresse email valide.";
  }
  if (input.website && (!isValidWebsite(input.website) || input.website.length > 2048)) {
    errors.website = "Utilisez une adresse http:// ou https:// valide.";
  }
  if (!prospectStatuses.includes(input.status)) errors.status = "Sélectionnez un statut valide.";
  if (input.nextAction.length > 300) errors.nextAction = "300 caractères maximum.";
  if ((input.notes?.length ?? 0) > 5000) errors.notes = "5 000 caractères maximum.";
  if (input.nextActionDate && !isValidActionDate(input.nextActionDate)) {
    errors.nextActionDate = "Indiquez une date valide.";
  }
  return errors;
}

// localStorage contient du texte : on vérifie son contenu avant de l'utiliser.
export function parseStoredProspects(raw: string): Prospect[] {
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Format de sauvegarde invalide");
  const ids = new Set<string>();
  return data.map((item: unknown) => {
    if (typeof item !== "object" || item === null) throw new Error("Prospect invalide");
    const p = item as Record<string, unknown>;
    const fields = ["id", "company", "sector", "city", "email", "website", "status", "nextAction", "createdAt"];
    if (fields.some((field) => typeof p[field] !== "string")
      || typeof p.isClient !== "boolean"
      || (p.notes !== undefined && typeof p.notes !== "string")
      || (p.nextActionDate !== undefined && typeof p.nextActionDate !== "string")) {
      throw new Error("Champs invalides");
    }
    const prospect = p as unknown as Prospect;
    if (!prospect.id || ids.has(prospect.id) || Number.isNaN(Date.parse(prospect.createdAt))
      || Object.keys(validateProspect(prospect)).length > 0) {
      throw new Error("Prospect invalide ou identifiant dupliqué");
    }
    ids.add(prospect.id);
    // Ne conserver que les champs de notre modèle.
    return {
      id: prospect.id, company: prospect.company, sector: prospect.sector,
      city: prospect.city, email: prospect.email, website: prospect.website,
      status: prospect.status, nextAction: prospect.nextAction,
      createdAt: prospect.createdAt, isClient: prospect.isClient,
      notes: prospect.notes ?? "", nextActionDate: prospect.nextActionDate ?? "",
    };
  });
}

export function formatActionDate(value: string) {
  if (!value) return "Sans échéance";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

export function readProspects(storage: BrowserStorage, key: string, fallback: Prospect[]) {
  const raw = storage.getItem(key);
  return raw === null ? fallback : parseStoredProspects(raw);
}

export function saveProspects(storage: BrowserStorage, key: string, fallback: Prospect[], change: (items: Prospect[]) => Prospect[]) {
  const current = readProspects(storage, key, fallback);
  const next = change(current);
  // Ne retourner les nouvelles données qu'après une écriture réussie.
  storage.setItem(key, JSON.stringify(next));
  return next;
}
