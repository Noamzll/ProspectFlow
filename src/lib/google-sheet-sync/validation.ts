import { prospectStatuses, validateProspect } from "../prospect-validation.ts";

export const MAX_SYNC_ROWS = 200;
export const MAX_SYNC_BYTES = 512 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SheetRow = {
  externalId: string;
  entreprise: string;
  secteur: string;
  ville: string;
  email: string | null;
  site_internet: string | null;
  statut: (typeof prospectStatuses)[number];
  prochaine_action: string | null;
};
export type SyncPayload = { spreadsheetId: string; sheetId: string; dryRun: boolean; rows: SheetRow[] };

export class SyncError extends Error {
  status: number;
  code: string;
  details?: { row: number; fields: string[] }[];
  constructor(status: number, code: string, details?: { row: number; fields: string[] }[]) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyncError(422, "invalid_payload");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new SyncError(422, "invalid_payload");
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validateSyncPayload(value: unknown): SyncPayload {
  const payload = record(value);
  if (Object.keys(payload).some((key) => !["spreadsheetId", "sheetId", "dryRun", "rows"].includes(key))
    || typeof payload.spreadsheetId !== "string" || typeof payload.sheetId !== "string"
    || (payload.dryRun !== undefined && typeof payload.dryRun !== "boolean")) throw new SyncError(422, "invalid_payload");
  if (!Array.isArray(payload.rows) || payload.rows.length < 1 || payload.rows.length > MAX_SYNC_ROWS) {
    throw new SyncError(422, "invalid_batch_size");
  }
  const ids = new Set<string>();
  const emails = new Set<string>();
  const companies = new Set<string>();
  const rows = payload.rows.map((value, index): SheetRow => {
    const row = record(value);
    const fields = ["externalId", "entreprise", "secteur", "ville", "email", "site_internet", "statut", "prochaine_action"];
    if (Object.keys(row).some((key) => !fields.includes(key))) throw new SyncError(422, "unknown_row_fields", [{ row: index + 1, fields: ["champs non autorisés"] }]);
    const externalId = text(row.externalId).toLowerCase();
    if (!UUID_PATTERN.test(externalId)) throw new SyncError(422, "invalid_external_id", [{ row: index + 1, fields: ["Prospect ID"] }]);
    if (ids.has(externalId)) throw new SyncError(422, "duplicate_external_id", [{ row: index + 1, fields: ["Prospect ID"] }]);
    ids.add(externalId);
    const rawStatus = text(row.statut) || "Nouveau";
    const normalizeStatus = (status: string) => status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const status = prospectStatuses.find((status) => normalizeStatus(status) === normalizeStatus(rawStatus));
    if (!status) throw new SyncError(422, "invalid_status", [{ row: index + 1, fields: ["Statut"] }]);
    let website = text(row.site_internet);
    if (website && !/^[a-z][a-z\d+.-]*:/i.test(website)) website = `https://${website}`;
    // Valider avant URL : javascript:, identifiants et autres protocoles restent refusés.
    const input = {
      company: text(row.entreprise), sector: text(row.secteur), city: text(row.ville),
      email: text(row.email).toLowerCase(), website, status, nextAction: text(row.prochaine_action), isClient: false,
    };
    const errors = Object.keys(validateProspect(input));
    if (errors.length) throw new SyncError(422, "invalid_row", [{ row: index + 1, fields: errors }]);
    const companyKey = JSON.stringify([input.company.toLowerCase(), input.city.toLowerCase()]);
    if ((input.email && emails.has(input.email)) || companies.has(companyKey)) throw new SyncError(422, "duplicate_business", [{ row: index + 1, fields: ["Entreprise / Ville / Email"] }]);
    if (input.email) emails.add(input.email);
    companies.add(companyKey);
    if (website) website = new URL(website).href;
    return { externalId, entreprise: input.company, secteur: input.sector, ville: input.city,
      email: input.email || null, site_internet: website || null, statut: status, prochaine_action: input.nextAction || null };
  });
  return { spreadsheetId: payload.spreadsheetId, sheetId: payload.sheetId, dryRun: payload.dryRun ?? true, rows };
}
