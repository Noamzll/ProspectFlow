import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createProspectsService, cloudError } from "../src/lib/prospects-service.ts";
import { fromProspectRow, toProspectFields } from "../src/lib/prospect-mapping.ts";
import { detectLocalMigration, LEGACY_STORAGE_KEY, markLocalMigration, migrationId } from "../src/lib/local-migration.ts";
import { prospects } from "../src/data/prospects.ts";
import { parseProspectsCsv } from "../src/lib/import-prospects.ts";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row = (index = 0, userId = owner) => ({
  id: crypto.randomUUID(), user_id: userId, entreprise: `Entreprise ${index}`, secteur: "Conseil", ville: "Paris",
  email: "", site_internet: null, statut: "Nouveau", prochaine_action: null,
  notes: "Contexte\nSeconde ligne", prochaine_action_date: "2026-10-15", is_client: true,
  created_at: "2026-10-05T10:00:00.000Z", updated_at: "2026-10-05T10:00:00.000Z",
});

// Le vrai SDK Supabase contacte uniquement ce faux transport HTTP : aucun projet distant.
function backend(initial = [], { maxRows = 1000, writeError = false, loseWrites = false } = {}) {
  let rows = structuredClone(initial);
  let currentUser = owner;
  const requests = [];
  const client = createClient("https://test.supabase.invalid", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      assert.equal(url.hostname, "test.supabase.invalid");
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body) : null;
      requests.push({ method, url, body });
      const response = (data, status = 200, total) => new Response(JSON.stringify(data), { status, headers: {
        "content-type": "application/json", ...(total === undefined ? {} : { "content-range": `0-0/${total}` }),
      } });
      if (method !== "GET" && writeError) return response({ code: "42501", message: "RLS" }, 403);
      const visible = () => rows.filter((item) => item.user_id === currentUser);
      if (method === "GET") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Math.min(maxRows, Number(url.searchParams.get("limit") ?? maxRows));
        const sorted = visible().sort((a, b) => a.id.localeCompare(b.id));
        return response(sorted.slice(offset, offset + limit), 200, sorted.length);
      }
      let affected = [];
      if (method === "POST") {
        const batch = Array.isArray(body) ? body : [body];
        if (batch.some((item) => item.user_id !== currentUser)) return response({ code: "42501" }, 403);
        affected = batch.filter((item) => !rows.some((existing) => existing.id === item.id)).map((item) => ({ id: crypto.randomUUID(), ...item }));
        if (!loseWrites) rows.push(...affected);
      } else {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        affected = visible().filter((item) => item.id === id);
        if (method === "PATCH") { affected.forEach((item) => Object.assign(item, body)); }
        if (method === "DELETE") { rows = rows.filter((item) => !affected.includes(item)); }
      }
      const single = new Headers(init.headers).get("accept")?.includes("vnd.pgrst.object");
      if (single && affected.length !== 1) return response({ code: "PGRST116" }, 406);
      return response(single ? affected[0] : affected, method === "POST" ? 201 : 200);
    } },
  });
  client.auth.getUser = async () => ({ data: { user: currentUser ? { id: currentUser } : null }, error: null });
  return { service: createProspectsService(client, owner), requests, rows: () => rows, setUser: (value) => { currentUser = value; } };
}

test("la lecture récupère les 1 201 prospects et laisse le RLS isoler le propriétaire", async () => {
  const api = backend([...Array.from({ length: 1201 }, (_, i) => row(i)), row(9999, other)]);
  const result = await api.service.list();
  assert.equal(result.length, 1201);
  assert.equal(new Set(result.map((item) => item.id)).size, 1201);
  assert.equal(result.some((item) => item.company === "Entreprise 9999"), false);
  assert.deepEqual(api.requests.map((request) => Number(request.url.searchParams.get("offset"))), [0, 500, 1000]);
});

test("une limite de réponse inférieure à 500 ne tronque pas la liste", async () => {
  const api = backend(Array.from({ length: 351 }, (_, i) => row(i)), { maxRows: 100 });
  assert.equal((await api.service.list()).length, 351);
  assert.equal(api.requests.length, 4);
});

test("le mapping préserve les sept champs métier, notes, échéance et client", () => {
  const original = row();
  const input = fromProspectRow(original);
  assert.equal(input.notes, original.notes);
  assert.equal(input.nextActionDate, original.prochaine_action_date);
  assert.equal(input.isClient, true);
  const fields = toProspectFields(input);
  assert.equal(fields.entreprise, original.entreprise);
  assert.equal(fields.statut, original.statut);
  assert.equal(fields.email, null);
  assert.equal(Object.hasOwn(fields, "user_id"), false);
  assert.throws(() => toProspectFields({ ...input, status: "Client" }));
});

test("créer, modifier et supprimer utilisent le propriétaire connecté et conservent created_at", async () => {
  const api = backend();
  const input = { ...prospects[0], notes: "Notes importantes", nextActionDate: "2026-10-15", isClient: true };
  const added = await api.service.add(input);
  assert.equal(api.rows()[0].user_id, owner);
  const updated = await api.service.update(added.id, { ...input, company: "Entreprise modifiée" });
  assert.equal(updated.createdAt, added.createdAt);
  assert.equal(updated.notes, input.notes);
  assert.equal(updated.company, "Entreprise modifiée");
  assert.equal(Object.hasOwn(api.requests.find((request) => request.method === "PATCH").body, "user_id"), false);
  await api.service.remove(added.id);
  assert.equal(api.rows().length, 0);
});

test("une session expirée ou un autre utilisateur bloque les appels de données", async () => {
  for (const account of [null, other]) {
    const api = backend();
    api.setUser(account);
    await assert.rejects(api.service.add(prospects[0]), /session/);
    await assert.rejects(api.service.list(), /session/);
    assert.equal(api.requests.length, 0);
  }
});

test("un refus RLS ne crée rien et une suppression étrangère ne réussit pas", async () => {
  const denied = backend([], { writeError: true });
  await assert.rejects(denied.service.add(prospects[0]), /RLS/);
  assert.equal(denied.rows().length, 0);
  const foreign = row(1, other);
  const api = backend([foreign]);
  await assert.rejects(api.service.remove(foreign.id), /accessible/);
  assert.equal(api.rows().length, 1);
});

test("l’import relit le cloud, déduplique et vérifie plus de 1 000 insertions", async () => {
  const api = backend([row(0)]);
  const csv = "Entreprise;Secteur;Ville\n" + Array.from({ length: 1201 }, (_, i) => `Entreprise ${i};Conseil;Paris`).join("\n");
  const result = await api.service.importRows(parseProspectsCsv(csv).rows);
  assert.equal(result.added, 1200);
  assert.equal(result.skipped, 1);
  assert.equal(result.prospects.length, 1201);
  assert.equal(api.requests.filter((request) => request.method === "POST").length, 1);
  const repeat = await api.service.importRows(parseProspectsCsv(csv).rows);
  assert.equal(repeat.added, 0);
  assert.equal(repeat.skipped, 1201);
});

test("la migration conserve les dates et les détails et ne se répète pas", async () => {
  const raw = JSON.stringify(prospects.map((item) => ({ ...item, notes: "Contexte à conserver", nextActionDate: "2026-10-15" })));
  const values = new Map([[LEGACY_STORAGE_KEY, raw]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const migration = await detectLocalMigration(storage, owner);
  const api = backend();
  const result = await api.service.importRows(migration.prospects.map((input, index) => ({ line: index + 1, input })), migration.prospects);
  assert.equal(result.added, 8);
  const restored = result.prospects.find((item) => item.company === prospects[0].company);
  assert.equal(restored.createdAt, prospects[0].createdAt);
  assert.equal(restored.notes, "Contexte à conserver");
  assert.equal(restored.nextActionDate, "2026-10-15");
  assert.equal(result.prospects.find((item) => item.company === prospects[5].company).isClient, true);
  markLocalMigration(storage, owner, migration.fingerprint);
  assert.equal(await detectLocalMigration(storage, owner), null);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), raw);
  assert.notEqual(await migrationId(owner, "p1"), await migrationId(other, "p1"));
  assert.equal((await api.service.importRows(migration.prospects.map((input, index) => ({ line: index + 1, input })), migration.prospects)).added, 0);
});

test("une vérification cloud échouée laisse la migration locale disponible", async () => {
  const raw = JSON.stringify(prospects);
  const storage = { getItem: (key) => key === LEGACY_STORAGE_KEY ? raw : null };
  const api = backend([], { loseWrites: true });
  const migration = await detectLocalMigration(storage, owner);
  await assert.rejects(api.service.importRows(migration.prospects.map((input, index) => ({ line: index + 1, input })), migration.prospects), /vérifié/);
  assert.ok(await detectLocalMigration(storage, owner));
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), raw);
});

test("aucune donnée locale ou une liste vide n’injecte les exemples dans le cloud", async () => {
  assert.equal(await detectLocalMigration({ getItem: () => null }, owner), null);
  assert.equal(await detectLocalMigration({ getItem: () => "[]" }, owner), null);
  await assert.rejects(detectLocalMigration({ getItem: () => "{corrompu" }, owner));
  assert.match(cloudError({ code: "PGRST204" }).message, /schéma/);
});
