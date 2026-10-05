import { parseStoredProspects } from "./prospect-validation.ts";

// Clé de la version locale existante, jamais remplacée par une clé supposée.
export const LEGACY_STORAGE_KEY = "prospectflow.prospects.v1";
const migrationKey = (userId: string) => `prospectflow.cloud-migration.v1.${userId}`;

export async function localFingerprint(raw: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function detectLocalMigration(storage: Pick<Storage, "getItem">, userId: string) {
  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  const prospects = parseStoredProspects(raw);
  if (prospects.length === 0) return null;
  const fingerprint = await localFingerprint(raw);
  if (storage.getItem(migrationKey(userId)) === fingerprint) return null;
  return { prospects, fingerprint };
}

export function markLocalMigration(storage: Pick<Storage, "setItem">, userId: string, fingerprint: string) {
  // Conserver l’original est volontaire : aucune suppression automatique de la sauvegarde.
  storage.setItem(migrationKey(userId), fingerprint);
}

export async function migrationId(userId: string, localId: string) {
  // Un identifiant stable par propriétaire rend une reprise après coupure idempotente.
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${localId}`)));
  hash[6] = (hash[6] & 15) | 128;
  hash[8] = (hash[8] & 63) | 128;
  const hex = Array.from(hash.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
