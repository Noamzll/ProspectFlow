"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Modal } from "@/components/modal";
import { useProspects } from "@/components/prospects-provider";
import { MAX_CSV_BYTES, parseProspectsCsv, selectNewImportRows, type CsvImport } from "@/lib/import-prospects";
import { StatusBadge } from "@/components/status-badge";

export function ImportProspectsDialog({ onClose }: { onClose: () => void }) {
  const { prospects, importProspects, error, busy } = useProspects();
  const [result, setResult] = useState<CsvImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [pastedCsv, setPastedCsv] = useState("");
  const readId = useRef(0);
  const selection = result ? selectNewImportRows(result.rows, prospects) : null;

  function previewPastedCsv() {
    readId.current += 1;
    setReading(false);
    setResult(null);
    setFileError(null);
    setFileName("Contenu CSV collé");
    try {
      if (new TextEncoder().encode(pastedCsv).length > MAX_CSV_BYTES) throw new Error("Le contenu dépasse la limite de 2 Mo.");
      setResult(parseProspectsCsv(pastedCsv));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Impossible de lire ce CSV.");
    }
  }

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    const id = ++readId.current;
    setResult(null);
    setFileError(null);
    setReading(false);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { setFileError("Choisissez un fichier .csv."); return; }
    if (file.size > MAX_CSV_BYTES) { setFileError("Le fichier dépasse la limite de 2 Mo."); return; }
    setReading(true);
    try {
      const buffer = await file.arrayBuffer();
      if (id !== readId.current) return;
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
      catch { throw new Error("L’encodage n’est pas UTF-8. Enregistrez le fichier en CSV UTF-8 depuis votre tableur."); }
      setResult(parseProspectsCsv(text));
    } catch (error) {
      if (id === readId.current) setFileError(error instanceof Error ? error.message : "Impossible de lire ce fichier.");
    } finally {
      if (id === readId.current) setReading(false);
    }
  }

  return (
    <Modal title="Importer des prospects depuis un CSV" onClose={onClose}>
      <fieldset disabled={busy} className="min-w-0 p-6">
        <p className="text-sm leading-6 text-slate-600">Sélectionnez un CSV UTF-8 séparé par des virgules ou des points-virgules. Les colonnes Entreprise, Secteur et Ville sont obligatoires. Les autres sont facultatives.</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">L’import ajoute des prospects. Un email identique ou une même entreprise dans une même ville est considéré comme un doublon et ignoré.</p>
        <a href="/exemple-prospects.csv" download className="mt-3 inline-block rounded text-sm font-medium text-indigo-600 underline underline-offset-4">Télécharger un exemple CSV</a>
        <label htmlFor="prospects-csv" className="mt-5 mb-2 block text-sm font-medium">Fichier CSV (2 Mo maximum)</label>
        <input id="prospects-csv" type="file" accept=".csv,text/csv" onChange={readFile} className="block w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700" />
        <details className="mt-4 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">Ou coller le contenu CSV</summary>
          <label htmlFor="pasted-csv" className="mt-3 mb-2 block text-xs text-slate-500">Contenu CSV, avec les en-têtes</label>
          <textarea id="pasted-csv" value={pastedCsv} onChange={(event) => { setPastedCsv(event.target.value); readId.current += 1; setReading(false); setResult(null); setFileError(null); }} rows={5} maxLength={MAX_CSV_BYTES} placeholder={"Entreprise;Secteur;Ville\nAtelier Exemple;Design;Paris"} className="form-control h-auto py-2 font-mono text-xs" />
          <button type="button" disabled={!pastedCsv.trim()} onClick={previewPastedCsv} className="button-secondary mt-3">Prévisualiser le CSV collé</button>
        </details>
        {reading && <p role="status" className="mt-4 text-sm text-slate-500">Lecture du fichier…</p>}
        {fileError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{fileError}</p>}
        {result && selection && (
          <div className="mt-5 space-y-4">
            <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="break-all text-sm font-medium">{fileName}</p>
              <p className="mt-2 text-sm text-slate-600">{selection.accepted.length} à importer · {selection.duplicates.length} {selection.duplicates.length === 1 ? "doublon" : "doublons"} · {result.errors.length} {result.errors.length === 1 ? "ligne invalide" : "lignes invalides"}</p>
            </div>
            {result.ignoredHeaders.length > 0 && <p className="text-xs leading-5 text-slate-500">Colonnes ignorées : {result.ignoredHeaders.map((header) => header || "sans nom").join(", ")}.</p>}
            {selection.accepted.length > 0 && (
              <div className="relative overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <caption className="bg-slate-50 px-4 py-3 text-left text-xs text-slate-500">Aperçu : {Math.min(5, selection.accepted.length)} {selection.accepted.length === 1 ? "prospect à ajouter" : "premiers prospects à ajouter"}</caption>
                  <thead><tr><th scope="col" className="px-4 py-2 font-medium">Entreprise</th><th scope="col" className="px-4 py-2 font-medium">Ville</th><th scope="col" className="px-4 py-2 font-medium">Statut</th></tr></thead>
                  <tbody>{selection.accepted.slice(0, 5).map(({ line, input }) => <tr key={line} className="border-t border-slate-100"><td className="px-4 py-3">{input.company}</td><td className="px-4 py-3">{input.city}</td><td className="px-4 py-3"><StatusBadge status={input.status} /></td></tr>)}</tbody>
                </table>
              </div>
            )}
            {result.errors.length > 0 && (
              <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <summary className="cursor-pointer font-medium">Voir les lignes invalides ({result.errors.length})</summary>
                <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-xs leading-5">{result.errors.map(({ line, message }) => <li key={line}>Ligne {line} : {message}</li>)}</ul>
              </details>
            )}
            {selection.duplicates.length > 0 && (
              <details className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium">Voir les doublons ignorés ({selection.duplicates.length})</summary>
                <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">{selection.duplicates.map(({ line, input }) => <li key={line}>Ligne {line} : {input.company} · {input.city}</li>)}</ul>
              </details>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={onClose} className="button-secondary">Annuler</button>
          <button type="button" disabled={busy || reading || !selection?.accepted.length} onClick={async () => { if (result && await importProspects(result.rows)) onClose(); }} className="button-primary">
            <Upload className="size-4" aria-hidden="true" />{busy ? "Import en cours…" : `Importer ${selection?.accepted.length ?? 0} ${selection?.accepted.length === 1 ? "prospect valide" : "prospects valides"}`}
          </button>
        </div>
      </fieldset>
    </Modal>
  );
}
