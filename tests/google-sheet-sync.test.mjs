import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { createSyncHandler, getSyncConfig } from "../src/lib/google-sheet-sync/handler.ts";
import { syncSheetRows } from "../src/lib/google-sheet-sync/service.ts";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const config = { secret: "test-only-shared-secret-not-a-real-secret", userId: owner, spreadsheetId: "test_spreadsheet_000000000000", sheetId: "0", enabled: true };
const item = (index = 0) => ({ externalId: crypto.randomUUID(), entreprise: `Entreprise ${index}`, secteur: "Conseil", ville: "Paris", email: `contact${index}@societe.example`, site_internet: "https://societe.example/", statut: "Nouveau", prochaine_action: "Contacter" });
let db;
const requests = [];
let post;

before(async () => {
  // PostgreSQL réel en mémoire ; ni réseau Supabase, ni fichier utilisateur.
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.prospects (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
      entreprise text not null, secteur text, ville text not null, email text, site_internet text,
      statut text not null, prochaine_action text, created_at timestamptz default now(), updated_at timestamptz default now(),
      notes text, prochaine_action_date date, is_client boolean not null default false
    );
    alter table public.prospects enable row level security;
    create policy own_prospects on public.prospects to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant all on public.prospects to authenticated, service_role;
  `);
  const migration = await readFile(new URL("../supabase/migrations/20261005_google_sheet_sync.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration); // Migration réexécutable.
  const client = createClient("https://sync-test.supabase.invalid", "sb_secret_test_fixture_only", { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: async (url, init) => {
      assert.equal(new URL(url).hostname, "sync-test.supabase.invalid");
      assert.equal(new URL(url).pathname, "/rest/v1/rpc/sync_google_sheet_prospects");
      const body = JSON.parse(init.body);
      requests.push(body);
      try {
        const data = await db.transaction(async (tx) => {
          await tx.exec("set local role service_role");
          return (await tx.query("select public.sync_google_sheet_prospects($1::uuid, $2::jsonb, $3::boolean) as result", [body.p_user_id, JSON.stringify(body.p_rows), body.p_dry_run])).rows[0].result;
        });
        return Response.json(data);
      } catch (error) { return Response.json({ code: error.code, message: error.message }, { status: 400 }); }
    },
  } });
  post = createSyncHandler(() => config, (rows, userId, dryRun) => syncSheetRows(client, rows, userId, dryRun));
});
beforeEach(async () => { await db.exec("truncate public.prospects"); requests.length = 0; });
after(async () => { await db?.close(); });

function request(rows = [item()], overrides = {}, headers = {}) {
  return new Request("https://prospectflow.example/api/sync/google-sheet", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.secret}`, ...headers }, body: JSON.stringify({ spreadsheetId: config.spreadsheetId, sheetId: config.sheetId, dryRun: false, rows, ...overrides }) });
}
async function stored() { return (await db.query("select * from public.prospects order by entreprise")).rows; }
async function seed(row, user = owner, extra = {}) {
  await db.query(`insert into public.prospects (id,user_id,entreprise,secteur,ville,email,site_internet,statut,prochaine_action,notes,prochaine_action_date,is_client,created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'2026-12-15',true,'2026-01-02T10:00:00Z')`,
  [row.externalId, user, row.entreprise, row.secteur, row.ville, row.email, row.site_internet, row.statut, row.prochaine_action, extra.notes ?? "Notes à conserver"]);
}

test("crée un prospect normalisé depuis le Sheet avec le propriétaire serveur", async () => {
  const row = { ...item(), entreprise: "  Atelier   Forma ", email: " CONTACT@FORMA.EXAMPLE ", site_internet: "forma.example", statut: " a VERIFIER  ", prochaine_action: " " };
  const response = await post(request([row]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { created: 1, updated: 0, unchanged: 0, dryRun: false });
  const [saved] = await stored();
  assert.equal(saved.id, row.externalId);
  assert.equal(saved.sheet_external_id, row.externalId);
  assert.equal(saved.user_id, owner);
  assert.equal(saved.entreprise, "Atelier Forma");
  assert.equal(saved.email, "contact@forma.example");
  assert.equal(saved.site_internet, "https://forma.example/");
  assert.equal(saved.statut, "À vérifier");
  assert.equal(saved.prochaine_action, null);
  assert.equal(saved.notes, null);
  assert.equal(saved.is_client, false);
});

test("rattache puis met à jour un ID existant sans altérer notes, échéance, client ou date de création", async () => {
  const row = item();
  await seed(row);
  const [original] = await stored();
  const response = await post(request([{ ...row, entreprise: "Nom modifié", statut: "Réponse reçue" }]));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).updated, 1);
  const [saved] = await stored();
  assert.equal(saved.entreprise, "Nom modifié");
  for (const field of ["notes", "prochaine_action_date", "is_client", "created_at", "user_id", "id"]) assert.deepEqual(saved[field], original[field]);
});

test("répéter un lot ou déplacer ses lignes ne crée aucun doublon ni nouvelle date de modification", async () => {
  const rows = [item(1), item(2)];
  assert.equal((await post(request(rows))).status, 200);
  const original = await stored();
  const response = await post(request([...rows].reverse()));
  assert.deepEqual(await response.json(), { created: 0, updated: 0, unchanged: 2, dryRun: false });
  assert.deepEqual(await stored(), original);
});

test("un Sheet inchangé n'écrase pas une modification du SaaS ; une vraie édition du Sheet est répercutée", async () => {
  const row = item();
  assert.equal((await post(request([row]))).status, 200);
  await db.query("update public.prospects set statut = 'Envoyé', prochaine_action = 'Relance depuis le SaaS' where id = $1", [row.externalId]);
  const response = await post(request([row]));
  assert.equal((await response.json()).unchanged, 1);
  assert.equal((await stored())[0].statut, "Envoyé");
  assert.equal((await stored())[0].prochaine_action, "Relance depuis le SaaS");
  assert.equal((await post(request([{ ...row, statut: "Réponse reçue" }]))).status, 200);
  assert.equal((await stored())[0].statut, "Réponse reçue");
});

test("deux nouvelles identités pour la même entreprise sont rejetées avant le SQL", async () => {
  const row = item();
  assert.equal((await post(request([row, { ...row, externalId: crypto.randomUUID() }]))).status, 422);
  assert.equal(requests.length, 0);
});

test("un mauvais secret est rejeté avant tout accès SQL", async () => {
  for (const secret of ["Bearer incorrect", "", "Basic incorrect"]) {
    const response = await post(request([item()], {}, { authorization: secret }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  assert.equal(requests.length, 0);
  assert.equal((await stored()).length, 0);
});

test("un statut incorrect annule la validation de tout le lot avant le SQL", async () => {
  const response = await post(request([item(1), { ...item(2), statut: "Client" }]));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "invalid_status");
  assert.equal(requests.length, 0);
});

test("synchronise 200 lignes par une seule requête sans supprimer les prospects précédents", async () => {
  await seed(item(999));
  const rows = Array.from({ length: 200 }, (_, index) => item(index));
  const response = await post(request(rows));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).created, 200);
  assert.equal(requests.length, 1);
  assert.equal((await stored()).length, 201);
  assert.equal((await stored()).find((row) => row.entreprise === "Entreprise 999").notes, "Notes à conserver");
});

test("un ID d'un autre compte annule atomiquement le lot entier et ne change pas son propriétaire", async () => {
  const foreign = item(8);
  await seed(foreign, other);
  const response = await post(request([item(1), { ...foreign, entreprise: "Tentative" }]));
  assert.equal(response.status, 409);
  const rows = await stored();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, other);
  assert.equal(rows[0].entreprise, foreign.entreprise);
});

test("un nouvel ID pour un prospect non rattaché est refusé, y compris en simulation", async () => {
  const row = item(1);
  await seed(row);
  const original = await stored();
  for (const dryRun of [true, false]) {
    const response = await post(request([{ ...row, externalId: crypto.randomUUID() }], { dryRun }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, "identity_conflict_link_existing_id");
  }
  assert.deepEqual(await stored(), original);
});

test("une simulation reste sans écriture et elle est le défaut du protocole", async () => {
  const response = await post(request([item(1), item(2)], { dryRun: undefined }));
  assert.deepEqual(await response.json(), { created: 2, updated: 0, unchanged: 0, dryRun: true });
  assert.equal((await stored()).length, 0);
  const disabled = createSyncHandler(() => ({ ...config, enabled: false }), () => { throw new Error("ne doit pas être appelé"); });
  assert.equal((await disabled(request())).status, 409);
});

test("la route refuse une autre source, le navigateur et les champs hors contrat", async () => {
  assert.equal((await post(request([item()], { spreadsheetId: "another_source" }))).status, 403);
  assert.equal((await post(request([item()], { sheetId: "1" }))).status, 403);
  assert.equal((await post(request([item()], {}, { origin: "https://prospectflow.example" }))).status, 403);
  assert.equal((await post(request([item()], { userId: other }))).status, 422);
  assert.equal((await post(request([{ ...item(), notes: "Injection", is_client: true }]))).status, 422);
  assert.equal(requests.length, 0);
});

test("refuse les IDs dupliqués, les URL dangereuses, les cellules invalides et les lots excessifs", async () => {
  const row = item();
  for (const rows of [[row, row], [{ ...row, site_internet: "javascript:alert(1)" }], [{ ...row, site_internet: "https://user:password@example.com" }], [{ ...row, entreprise: "" }], [{ ...row, ville: 12 }], [], Array.from({ length: 201 }, (_, index) => item(index))]) {
    assert.equal((await post(request(rows))).status, 422);
  }
  assert.equal(requests.length, 0);
});

test("borne le corps JSON même sans Content-Length et ne divulgue pas les erreurs", async () => {
  const headers = { authorization: `Bearer ${config.secret}`, "content-type": "application/json" };
  assert.equal((await post(new Request("https://test.invalid", { method: "POST", headers, body: "x".repeat(512 * 1024 + 1) }))).status, 413);
  assert.equal((await post(new Request("https://test.invalid", { method: "POST", headers, body: "{" }))).status, 400);
  assert.equal((await post(request([item()], {}, { "content-type": "text/plain" }))).status, 415);
  const failed = createSyncHandler(() => config, () => { throw new Error(`${config.secret} contact@example.com`); });
  assert.deepEqual(await (await failed(request())).json(), { error: "sync_failed" });
  assert.equal(requests.length, 0);
});

test("la RPC est inaccessible aux rôles anon et authenticated ; les policies continuent d'isoler les comptes", async () => {
  const own = item(1), foreign = item(2);
  await seed(own); await seed(foreign, other);
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select public.sync_google_sheet_prospects($1::uuid,$2::jsonb,true)", [owner, JSON.stringify([item()])]);
    }), (error) => error.code === "42501");
  }
  const rows = await db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; set local "request.jwt.claim.sub" = '${owner}'`);
    return (await tx.query("select id from public.prospects")).rows;
  });
  assert.deepEqual(rows.map((row) => row.id), [own.externalId]);
});

test("l'index unique isole les propriétaires et la configuration absente ferme la route", async () => {
  const a = item(1), b = item(2);
  await seed(a); await seed(b);
  await db.query("update public.prospects set sheet_external_id = 'same-source-id' where id = $1", [a.externalId]);
  await assert.rejects(db.query("update public.prospects set sheet_external_id = 'same-source-id' where id = $1", [b.externalId]), (error) => error.code === "23505");
  assert.equal(getSyncConfig({}), null);
  assert.equal((await createSyncHandler(() => null, () => { throw new Error(); })(request())).status, 503);
  const parsed = getSyncConfig({ GOOGLE_SHEET_SYNC_SECRET: config.secret, GOOGLE_SHEET_SYNC_USER_ID: owner, GOOGLE_SHEET_SPREADSHEET_ID: config.spreadsheetId, GOOGLE_SHEET_TAB_ID: "0" });
  assert.equal(parsed.enabled, false);
});
