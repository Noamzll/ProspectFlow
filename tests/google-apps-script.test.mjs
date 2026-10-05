import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const code = await readFile(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const headers = ["Entreprise", "Secteur", "Ville", "Email", "Site internet", "Statut", "Prochaine action", "Prospect ID"];
const line = (i, id = "") => [`Société ${i}`, "Conseil", "Paris", `contact${i}@example.com`, "societe.example", "Nouveau", "Contacter", id];

function harness(lines, { dryRun = "false", result } = {}) {
  const values = [headers, ...structuredClone(lines)];
  const requests = [], logs = [], sleeps = [], triggers = [];
  const properties = new Map(Object.entries({ PROSPECTFLOW_SYNC_URL: "https://prospectflow.example/api/sync/google-sheet", GOOGLE_SHEET_SYNC_SECRET: "test-only-shared-secret-not-a-real-secret", GOOGLE_SHEET_SPREADSHEET_ID: "test_spreadsheet_000000000000", GOOGLE_SHEET_TAB_ID: "0", DRY_RUN: dryRun }));
  let columnWrites = 0, locks = 0;
  const sheet = { getSheetId: () => 0, getLastRow: () => values.length, getDataRange: () => ({ getDisplayValues: () => structuredClone(values) }),
    getRange: (row, column, count, width) => { assert.equal(column, 8); assert.equal(width, 1); return { setValues: (ids) => { columnWrites++; assert.equal(ids.length, count); ids.forEach((id, index) => { values[row - 1 + index][column - 1] = id[0]; }); } }; },
  };
  const context = vm.createContext({
    console: { log: (message) => logs.push(message) },
    LockService: { getScriptLock: () => ({ tryLock: () => { locks++; return true; }, releaseLock: () => { locks--; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key) ?? null }) },
    SpreadsheetApp: { openById: () => ({ getSheets: () => [sheet] }), flush: () => {} },
    Utilities: { getUuid: () => crypto.randomUUID(), newBlob: (value) => ({ getBytes: () => new TextEncoder().encode(value) }), sleep: (ms) => sleeps.push(ms) },
    UrlFetchApp: { fetch: (_url, options) => {
      const payload = JSON.parse(options.payload);
      requests.push(payload);
      assert.equal(options.followRedirects, false);
      assert.equal(options.headers.Authorization, `Bearer ${properties.get("GOOGLE_SHEET_SYNC_SECRET")}`);
      const response = result?.(payload, requests.length) ?? { status: 200, body: { created: payload.rows.length, updated: 0, unchanged: 0, dryRun: payload.dryRun } };
      return { getResponseCode: () => response.status, getContentText: () => JSON.stringify(response.body) };
    } },
    ScriptApp: { getProjectTriggers: () => [...triggers], deleteTrigger: (trigger) => triggers.splice(triggers.indexOf(trigger), 1), newTrigger: (handler) => ({ timeBased: () => ({ everyMinutes: (minutes) => ({ create: () => { assert.equal(minutes, 5); triggers.push({ getHandlerFunction: () => handler }); } }) }) }) },
  });
  vm.runInContext(code, context);
  return { run: () => vm.runInContext("syncNow()", context), context, values, requests, logs, sleeps, triggers, writes: () => columnWrites, locks: () => locks };
}

test("Apps Script synchronise 1 201 lignes par lots de 200, avec un seul enregistrement des IDs", () => {
  const api = harness(Array.from({ length: 1201 }, (_, index) => line(index)));
  api.run();
  assert.equal(api.requests.length, 14); // 7 simulations puis 7 écritures.
  assert.ok(api.requests.slice(0, 7).every((request) => request.dryRun));
  assert.ok(api.requests.slice(7).every((request) => !request.dryRun));
  assert.equal(api.writes(), 1);
  assert.equal(new Set(api.values.slice(1).map((row) => row[7])).size, 1201);
  assert.equal(api.locks(), 0);
  assert.ok(api.logs.every((log) => !log.includes("@example.com") && !log.includes("test-only-shared-secret")));
});

test("les IDs restent attachés à l'entreprise après déplacement et les lectures périodiques détectent les éditions API", () => {
  const api = harness([line(1), line(2)]);
  api.run();
  const id = api.values[1][7];
  api.values.splice(1, 2, api.values[2], api.values[1]);
  api.values[2][6] = "Action modifiée via API";
  api.run();
  assert.equal(api.requests.at(-1).rows[1].externalId, id);
  assert.equal(api.requests.at(-1).rows[1].prochaine_action, "Action modifiée via API");
  assert.equal(api.writes(), 1);
});

test("simulation seule, lignes vides ignorées et absence de suppressions", () => {
  const api = harness([line(1), Array(8).fill("")], { dryRun: "true" });
  api.run();
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].rows.length, 1);
  assert.equal(api.requests[0].dryRun, true);
  assert.equal(Object.hasOwn(api.requests[0], "delete"), false);
});

test("les doublons d'ID ou d'entreprise arrêtent l'envoi avant toute écriture de colonne", () => {
  const id = crypto.randomUUID();
  for (const lines of [[line(1, id), line(2, id)], [line(1), line(1)]]) {
    const api = harness(lines);
    assert.throws(() => api.run(), /dupliqué/);
    assert.equal(api.requests.length, 0);
    assert.equal(api.writes(), 0);
    assert.equal(api.locks(), 0);
  }
});

test("un lot invalide pendant la simulation empêche tous les lots d'écriture", () => {
  const api = harness(Array.from({ length: 201 }, (_, index) => line(index)), { result: (payload, call) => call === 2
    ? { status: 422, body: { error: "invalid_status", details: [{ row: 1, fields: ["Statut"] }] } }
    : { status: 200, body: { created: payload.rows.length, updated: 0, unchanged: 0, dryRun: payload.dryRun } } });
  assert.throws(() => api.run(), /invalid_status/);
  assert.ok(api.requests.every((request) => request.dryRun));
  assert.equal(api.locks(), 0);
});

test("les pannes temporaires sont réessayées sans changer les IDs et sans journaliser le corps de l'erreur", () => {
  const api = harness([line(1)], { result: (payload, call) => call === 1
    ? { status: 503, body: { error: "database_sync_failed", message: "ne pas journaliser" } }
    : { status: 200, body: { created: 1, updated: 0, unchanged: 0, dryRun: payload.dryRun } } });
  api.run();
  assert.deepEqual(api.sleeps, [1000]);
  assert.equal(new Set(api.requests.map((request) => request.rows[0].externalId)).size, 1);
  assert.ok(api.logs.every((log) => !log.includes("ne pas journaliser")));
});

test("l'installation du déclencheur est idempotente et préserve les autres déclencheurs", () => {
  const api = harness([]);
  api.triggers.push({ getHandlerFunction: () => "autreFonction" });
  vm.runInContext("installSyncTrigger(); installSyncTrigger()", api.context);
  assert.deepEqual(api.triggers.map((trigger) => trigger.getHandlerFunction()), ["autreFonction", "syncNow"]);
  vm.runInContext("removeSyncTriggers()", api.context);
  assert.equal(api.triggers.length, 1);
});
