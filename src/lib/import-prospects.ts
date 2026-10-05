import { prospectStatuses, validateProspect } from "./prospect-validation.ts";
import type { Prospect, ProspectInput } from "@/types/prospect";

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

type CsvRow = { line: number; cells: string[] };
export type ImportRow = { line: number; input: ProspectInput };
export type CsvImport = { rows: ImportRow[]; errors: { line: number; message: string }[]; ignoredHeaders: string[] };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

function detectDelimiter(text: string) {
  const counts = { ";": 0, ",": 0 };
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (char === ";" || char === ",")) counts[char] += 1;
    else if (!quoted && (char === "\n" || char === "\r") && (counts[";"] || counts[","])) break;
  }
  return counts[";"] >= counts[","] ? ";" : ",";
}

// Une lecture caractère par caractère respecte les séparateurs et retours à la ligne entre guillemets.
function readCsv(text: string, delimiter: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let startLine = 1;
  function finishCell() { cells.push(value); value = ""; closedQuote = false; }
  function finishRow() {
    finishCell();
    if (cells.some((cell) => cell.trim() !== "")) rows.push({ line: startLine, cells });
    if (rows.length > MAX_IMPORT_ROWS + 1) throw new Error(`Maximum ${MAX_IMPORT_ROWS} prospects par fichier.`);
    cells = [];
  }
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { value += '"'; index += 1; }
        else { quoted = false; closedQuote = true; }
      } else if (char === "\r" || char === "\n") {
        value += char;
        if (char === "\r" && text[index + 1] === "\n") { value += "\n"; index += 1; }
        line += 1;
      } else value += char;
    } else if (char === delimiter) finishCell();
    else if (char === "\r" || char === "\n") {
      finishRow();
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      startLine = line;
    } else if (closedQuote) {
      if (char !== " " && char !== "\t") throw new Error(`Ligne ${line} : caractère inattendu après un guillemet.`);
    } else if (char === '"') {
      if (value !== "") throw new Error(`Ligne ${line} : guillemet inattendu.`);
      quoted = true;
    } else value += char;
  }
  if (quoted) throw new Error(`Ligne ${startLine} : guillemet non fermé.`);
  if (value || closedQuote || cells.length) finishRow();
  return rows;
}

const headerNames: Record<string, keyof ProspectInput> = {
  entreprise: "company", company: "company",
  secteur: "sector", sector: "sector", ville: "city", city: "city",
  email: "email", "e-mail": "email", "site internet": "website", site: "website", website: "website",
  statut: "status", status: "status", "prochaine action": "nextAction", nextaction: "nextAction",
  echeance: "nextActionDate", "date de la prochaine action": "nextActionDate", nextactiondate: "nextActionDate",
  client: "isClient", isclient: "isClient", notes: "notes",
};
const labels: Record<keyof ProspectInput, string> = {
  company: "Entreprise", sector: "Secteur", city: "Ville", email: "Email", website: "Site internet",
  status: "Statut", nextAction: "Prochaine action", nextActionDate: "Échéance", isClient: "Client", notes: "Notes",
};

export function parseProspectsCsv(source: string): CsvImport {
  if (source.length > MAX_CSV_BYTES) throw new Error("Le fichier dépasse la limite de 2 Mo.");
  const text = source.replace(/^\uFEFF/, "");
  const records = readCsv(text, detectDelimiter(text));
  const header = records.shift();
  if (!header) throw new Error("Le fichier CSV est vide.");
  const mapped = header.cells.map((cell) => {
    const name = normalize(cell);
    return Object.hasOwn(headerNames, name) ? headerNames[name] : undefined;
  });
  const ignoredHeaders = header.cells.filter((_cell, index) => !mapped[index]);
  const missing = (["company", "sector", "city"] as const).filter((field) => !mapped.includes(field));
  if (missing.length) throw new Error(`Colonnes obligatoires manquantes : ${missing.map((field) => labels[field]).join(", ")}.`);
  const recognized = mapped.filter(Boolean);
  if (new Set(recognized).size !== recognized.length) throw new Error("Plusieurs colonnes correspondent au même champ. Gardez une seule colonne par champ.");
  if (records.length === 0) throw new Error("Le fichier contient les en-têtes, mais aucun prospect.");
  const rows: ImportRow[] = [];
  const errors: CsvImport["errors"] = [];

  for (const record of records) {
    if (record.cells.length !== header.cells.length) {
      errors.push({ line: record.line, message: `Nombre de colonnes incorrect (${record.cells.length} au lieu de ${header.cells.length}).` });
      continue;
    }
    const get = (field: keyof ProspectInput) => record.cells[mapped.indexOf(field)]?.trim() ?? "";
    const rawStatus = get("status");
    const status = prospectStatuses.find((item) => normalize(item) === normalize(rawStatus || "Nouveau"));
    const client = normalize(get("isClient"));
    if (!["", "oui", "non", "true", "false", "1", "0", "yes", "no"].includes(client)) {
      errors.push({ line: record.line, message: "Client : utilisez Oui ou Non (true/false et 1/0 sont acceptés)." });
      continue;
    }
    let website = get("website");
    if (website && !/^[a-z][a-z\d+.-]*:/i.test(website)) website = `https://${website}`;
    let date = get("nextActionDate");
    const frenchDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    if (frenchDate) date = `${frenchDate[3]}-${frenchDate[2]}-${frenchDate[1]}`;
    const input: ProspectInput = {
      company: get("company"), sector: get("sector"), city: get("city"), email: get("email"), website,
      status: status ?? (rawStatus as ProspectInput["status"]), nextAction: get("nextAction"),
      nextActionDate: date, isClient: ["oui", "true", "1", "yes"].includes(client),
      notes: record.cells[mapped.indexOf("notes")] ?? "",
    };
    const validation = validateProspect(input);
    if (Object.keys(validation).length) {
      errors.push({ line: record.line, message: Object.entries(validation).map(([field, message]) => `${labels[field as keyof ProspectInput]} : ${message}`).join(" ") });
    } else rows.push({ line: record.line, input });
  }
  return { rows, errors, ignoredHeaders };
}

export function selectNewImportRows(rows: ImportRow[], existing: ProspectInput[]) {
  const companyKey = (p: ProspectInput) => JSON.stringify([normalize(p.company), normalize(p.city)]);
  const emails = new Set(existing.filter((p) => p.email).map((p) => normalize(p.email)));
  const companies = new Set(existing.map(companyKey));
  const accepted: ImportRow[] = [];
  const duplicates: ImportRow[] = [];
  for (const row of rows) {
    const email = normalize(row.input.email);
    const company = companyKey(row.input);
    if ((email && emails.has(email)) || companies.has(company)) duplicates.push(row);
    else {
      accepted.push(row);
      if (email) emails.add(email);
      companies.add(company);
    }
  }
  return { accepted, duplicates };
}

export function mergeImportedProspects(current: Prospect[], rows: ImportRow[]) {
  const { accepted } = selectNewImportRows(rows, current);
  const createdAt = new Date().toISOString();
  return {
    added: accepted.length,
    prospects: [...accepted.map(({ input }) => ({ ...input, id: crypto.randomUUID(), createdAt })), ...current],
  };
}
