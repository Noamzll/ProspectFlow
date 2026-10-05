import test from "node:test";
import assert from "node:assert/strict";
import { prospects, getDashboardStats } from "../src/data/prospects.ts";
import { isValidWebsite, parseStoredProspects, readProspects, saveProspects, validateProspect } from "../src/lib/prospect-validation.ts";
import { exportProspectsCsv } from "../src/lib/export-prospects.ts";

test("les indicateurs se recoupent correctement, y compris pour un client", () => {
  assert.deepEqual(getDashboardStats(prospects), { total: 8, toContact: 5, drafts: 2, contacted: 3, replies: 2, clients: 1 });
  assert.deepEqual(getDashboardStats([]), { total: 0, toContact: 0, drafts: 0, contacted: 0, replies: 0, clients: 0 });
  const client = { ...prospects[0], isClient: true };
  assert.equal(getDashboardStats([client]).toContact, 0);
  assert.equal(getDashboardStats([client]).contacted, 1);
});

test("le formulaire refuse les champs vides, emails incorrects et dates impossibles", () => {
  const input = { ...prospects[0], company: "   ", email: "sans-arobase", nextActionDate: "2026-02-30" };
  const errors = validateProspect(input);
  assert.ok(errors.company);
  assert.ok(errors.email);
  assert.ok(errors.nextActionDate);
  assert.deepEqual(validateProspect({ ...prospects[0], email: "", website: "", notes: "", nextActionDate: "2028-02-29" }), {});
});

test("les sites sont limités à HTTP et HTTPS sans identifiants", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "ftp://example.com", "https://user:secret@example.com", "pas un site"]) {
    assert.equal(isValidWebsite(url), false, url);
  }
  assert.equal(isValidWebsite("https://example.com/contact"), true);
});

test("une liste vide sauvegardée reste vide et les anciens exemples sont compatibles", () => {
  assert.deepEqual(parseStoredProspects("[]"), []);
  const restored = parseStoredProspects(JSON.stringify(prospects));
  assert.equal(restored.length, 8);
  assert.equal(restored[0].notes, "");
  assert.equal(restored[0].nextActionDate, "");
});

test("une sauvegarde incorrecte, dupliquée ou contenant une URL exécutable est rejetée", () => {
  for (const data of [null, {}, [{ ...prospects[0], status: "Inconnu" }], [prospects[0], prospects[0]], [{ ...prospects[0], website: "javascript:alert(1)" }], [{ ...prospects[0], createdAt: "date invalide" }]]) {
    assert.throws(() => parseStoredProspects(JSON.stringify(data)));
  }
  assert.throws(() => parseStoredProspects("{invalide"));
});

test("le CSV préserve accents et notes, échappe les guillemets et neutralise les formules", () => {
  const csv = exportProspectsCsv([{ ...prospects[0], company: '=HYPERLINK("test")', notes: 'Échange; "à suivre"\nDeuxième ligne' }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""test"")"'));
  assert.ok(csv.includes('"Échange; ""à suivre""\nDeuxième ligne"'));
});

test("la sauvegarde prend en compte les données les plus récentes et conserve une liste vide", () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  assert.equal(readProspects(storage, "test", prospects).length, 8);
  saveProspects(storage, "test", prospects, () => [prospects[0]]);
  assert.equal(readProspects(storage, "test", prospects).length, 1);
  saveProspects(storage, "test", prospects, (items) => [...items, prospects[1]]);
  assert.equal(readProspects(storage, "test", prospects).length, 2);
  saveProspects(storage, "test", prospects, () => []);
  assert.deepEqual(readProspects(storage, "test", prospects), []);
});

test("un échec d’écriture ou une sauvegarde corrompue ne remplace pas les données existantes", () => {
  const raw = JSON.stringify(prospects);
  const quotaStorage = { getItem: () => raw, setItem: () => { throw new Error("Quota dépassé"); } };
  assert.throws(() => saveProspects(quotaStorage, "test", prospects, () => []), /Quota/);
  assert.equal(readProspects(quotaStorage, "test", []).length, 8);
  let writes = 0;
  const corruptStorage = { getItem: () => "corrompu", setItem: () => { writes += 1; } };
  assert.throws(() => saveProspects(corruptStorage, "test", prospects, () => []));
  assert.equal(writes, 0);
});
