import test from "node:test";
import assert from "node:assert/strict";
import { parseProspectsCsv, selectNewImportRows, mergeImportedProspects, MAX_CSV_BYTES, MAX_IMPORT_ROWS } from "../src/lib/import-prospects.ts";
import { exportProspectsCsv } from "../src/lib/export-prospects.ts";
import { prospects } from "../src/data/prospects.ts";
import { parseStoredProspects } from "../src/lib/prospect-validation.ts";

test("l’export de ProspectFlow peut être réimporté sans doublonner les données", () => {
  const result = parseProspectsCsv(exportProspectsCsv(prospects));
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 8);
  assert.deepEqual(result.rows[0].input, {
    company: prospects[0].company, sector: prospects[0].sector, city: prospects[0].city,
    email: prospects[0].email, website: prospects[0].website, status: prospects[0].status,
    nextAction: prospects[0].nextAction, nextActionDate: "", isClient: false, notes: "",
  });
  const selection = selectNewImportRows(result.rows, prospects);
  assert.equal(selection.accepted.length, 0);
  assert.equal(selection.duplicates.length, 8);
});

test("les virgules, guillemets doublés, BOM et notes multilignes sont préservés", () => {
  const csv = '\uFEFFEntreprise,Secteur,Ville,Notes\r\n"Studio, Nord",Design,Lyon,"  Il dit ""bonjour"".\r\nDeuxième ligne  "\r\n';
  const result = parseProspectsCsv(csv);
  assert.equal(result.rows[0].input.company, "Studio, Nord");
  assert.equal(result.rows[0].input.notes, '  Il dit "bonjour".\r\nDeuxième ligne  ');
  assert.equal(result.rows[0].input.status, "Nouveau");
});

test("les en-têtes anglais, statuts et dates français et sites sans protocole sont normalisés", () => {
  const result = parseProspectsCsv("company;sector;city;website;status;nextActionDate;isClient\nOrion;Conseil;Paris;orion.example;reponse recue;12/10/2026;TRUE");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].input.website, "https://orion.example");
  assert.equal(result.rows[0].input.status, "Réponse reçue");
  assert.equal(result.rows[0].input.nextActionDate, "2026-10-12");
  assert.equal(result.rows[0].input.isClient, true);
});

test("les lignes invalides ne bloquent pas les lignes valides et gardent leur numéro physique", () => {
  const result = parseProspectsCsv('Entreprise;Secteur;Ville;Notes;Email\nValide;Conseil;Paris;"Note\nsuite";contact@valide.example\nInvalide;Conseil;Lyon;;email incorrect\nTrop court;Conseil');
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.errors.map((error) => error.line), [4, 5]);
  assert.match(result.errors[0].message, /Email/);
  assert.match(result.errors[1].message, /colonnes/);
});

test("les champs obligatoires, dates impossibles, liens exécutables et booléens inconnus sont rejetés", () => {
  const result = parseProspectsCsv("Entreprise;Secteur;Ville;Site;Échéance;Client\n;Conseil;Paris;;;Non\nDate;Conseil;Paris;;30/02/2026;Non\nLien;Conseil;Paris;javascript:alert(1);;Non\nClient;Conseil;Paris;;;peut-être");
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 4);
});

test("les fichiers vides, en-têtes manquants ou dupliqués et CSV mal formés sont refusés", () => {
  for (const csv of ["", "Entreprise;Secteur;Ville", "Email\ncontact@example.com", "Entreprise;company;Secteur;Ville\nA;B;C;D", 'Entreprise;Secteur;Ville\n"non fermé;A;B', 'Entreprise;Secteur;Ville\n"nom"erreur;A;B']) {
    assert.throws(() => parseProspectsCsv(csv), csv);
  }
});

test("les colonnes inconnues sont signalées, y compris les noms du prototype JavaScript", () => {
  const result = parseProspectsCsv("Entreprise;Secteur;Ville;constructor;__proto__\nA;Conseil;Paris;inconnu;inconnu");
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.ignoredHeaders, ["constructor", "__proto__"]);
});

test("les doublons par email ou entreprise et ville sont ignorés dans la base et le fichier", () => {
  const result = parseProspectsCsv("Entreprise;Secteur;Ville;Email\nAutre nom;Conseil;Paris;BONJOUR@FORMA.EXAMPLE\n atelier forma ;Conseil;LYON;autre@example.com\nNouvelle;Conseil;Lille;nouveau@example.com\nNouvelle;Design;lille;autre-nouveau@example.com");
  const selection = selectNewImportRows(result.rows, prospects);
  assert.equal(selection.accepted.length, 1);
  assert.equal(selection.duplicates.length, 3);
});

test("l’import conserve les prospects existants et devient idempotent après la première insertion", () => {
  const result = parseProspectsCsv("Entreprise;Secteur;Ville\nImport test;Conseil;Paris");
  const merged = mergeImportedProspects(prospects, result.rows);
  assert.equal(merged.added, 1);
  assert.equal(merged.prospects.length, 9);
  assert.deepEqual(merged.prospects.slice(1), prospects);
  assert.notEqual(merged.prospects[0].id, prospects[0].id);
  assert.equal(parseStoredProspects(JSON.stringify(merged.prospects)).length, 9);
  assert.equal(mergeImportedProspects(merged.prospects, result.rows).added, 0);
  assert.equal(prospects.length, 8);
});

test("la taille maximale et le nombre maximal de prospects sont contrôlés", () => {
  assert.throws(() => parseProspectsCsv("a".repeat(MAX_CSV_BYTES + 1)), /2 Mo/);
  assert.throws(() => parseProspectsCsv("Entreprise;Secteur;Ville\n" + "A;B;C\n".repeat(MAX_IMPORT_ROWS + 1)), /5000/);
});
