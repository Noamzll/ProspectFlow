"use client";

import { prospects as examples } from "@/data/prospects";
import { readProspects, saveProspects, validateProspect } from "@/lib/prospect-validation";
import type { Prospect, ProspectInput } from "@/types/prospect";
import { mergeImportedProspects, type ImportRow } from "@/lib/import-prospects";

export const STORAGE_KEY = "prospectflow.prospects.v1";

type Snapshot = {
  prospects: Prospect[];
  ready: boolean;
  error: string | null;
  notice: string | null;
};

const initialSnapshot: Snapshot = { prospects: examples, ready: false, error: null, notice: null };
let snapshot = initialSnapshot;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function loadProspects() {
  try {
    publish({ prospects: readProspects(window.localStorage, STORAGE_KEY, examples), ready: true, error: null, notice: null });
  } catch {
    publish({ ...snapshot, ready: true, error: "Impossible de lire la sauvegarde locale. Elle reste intacte. Vérifiez l’accès au stockage du navigateur, puis réessayez." });
  }
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) loadProspects();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  if (!snapshot.ready) loadProspects();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export const getSnapshot = () => snapshot;
export const getServerSnapshot = () => initialSnapshot;

export function clearNotice() {
  if (snapshot.notice) publish({ ...snapshot, notice: null });
}

function commit(change: (items: Prospect[]) => Prospect[], notice: string | (() => string)) {
  if (!snapshot.ready) return false;
  try {
    // Relire avant d'écrire prend en compte les changements d'un autre onglet.
    const next = saveProspects(window.localStorage, STORAGE_KEY, examples, change);
    publish({ prospects: next, ready: true, error: null, notice: typeof notice === "function" ? notice() : notice });
    return true;
  } catch (error) {
    publish({ ...snapshot, error: error instanceof MissingProspectError
      ? "Ce prospect a été supprimé dans un autre onglet. Actualisez les données avant de continuer."
      : "La modification n’a pas été enregistrée. Vérifiez le stockage du navigateur, puis réessayez." });
    return false;
  }
}

class MissingProspectError extends Error {}

export function addProspect(input: ProspectInput) {
  if (Object.keys(validateProspect(input)).length) return false;
  const prospect: Prospect = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  return commit((items) => [prospect, ...items], `${input.company} a été ajouté.`);
}

export function updateProspect(id: string, input: ProspectInput) {
  if (Object.keys(validateProspect(input)).length) return false;
  return commit((items) => {
    if (!items.some((p) => p.id === id)) throw new MissingProspectError();
    return items.map((p) => p.id === id ? { ...p, ...input } : p);
  }, `${input.company} a été mis à jour.`);
}

export function removeProspect(id: string) {
  return commit((items) => items.filter((p) => p.id !== id), "Le prospect a été supprimé.");
}

export function importProspects(rows: ImportRow[]) {
  if (rows.length === 0 || rows.some(({ input }) => Object.keys(validateProspect(input)).length)) return false;
  let added = 0;
  return commit((items) => {
    const result = mergeImportedProspects(items, rows);
    added = result.added;
    return result.prospects;
  }, () => added > 0 ? `${added} ${added === 1 ? "prospect a été importé" : "prospects ont été importés"}.`
    : "Aucun nouveau prospect : les lignes sont déjà présentes dans votre espace.");
}
