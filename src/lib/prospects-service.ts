import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProspectInsert } from "@/types/database";
import type { Prospect, ProspectInput } from "@/types/prospect";
import { fromProspectRow, toProspectFields } from "./prospect-mapping.ts";
import { selectNewImportRows, type ImportRow } from "./import-prospects.ts";
import { migrationId } from "./local-migration.ts";

const columns = "id,user_id,entreprise,secteur,ville,email,site_internet,statut,prochaine_action,created_at,updated_at,notes,prochaine_action_date,is_client";

export function cloudError(error: unknown): Error {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (["42703", "PGRST204"].includes(code)) return new Error("Le schéma Supabase est incomplet. Exécutez le script de compatibilité pour conserver les notes, échéances et clients, puis actualisez.");
  if (code === "42501") return new Error("Supabase a refusé cette opération. Vérifiez votre connexion et les policies RLS de la table prospects.");
  if (error instanceof Error) return error;
  return new Error("La sauvegarde cloud n’a pas confirmé l’opération. Vérifiez la connexion, puis actualisez avant de réessayer.");
}

export function createProspectsService(client: SupabaseClient<Database>, userId: string) {
  async function assertUser() {
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Votre session a changé ou a expiré. Reconnectez-vous avant de continuer.");
    return data.user;
  }

  async function list(): Promise<Prospect[]> {
    await assertUser();
    const items: Prospect[] = [];
    let offset = 0;
    // Supabase limite les réponses : lire toutes les tranches, même au-delà de 1 000 lignes.
    while (true) {
      const { data, error, count } = await client.from("prospects").select(columns, { count: "exact" }).order("id").range(offset, offset + 499);
      if (error) throw cloudError(error);
      if (count === null || !data) throw new Error("La liste cloud n’a pas pu être vérifiée.");
      if (data.some((row) => row.user_id !== userId)) throw new Error("La réponse cloud ne correspond pas au compte connecté. Vérifiez les policies RLS.");
      items.push(...data.map(fromProspectRow));
      offset += data.length;
      if (offset >= count) return items;
      if (data.length === 0) throw new Error("La lecture cloud s’est interrompue. Actualisez pour récupérer tous les prospects.");
    }
  }

  async function add(input: ProspectInput) {
    const user = await assertUser();
    const now = new Date().toISOString();
    const { data, error } = await client.from("prospects").insert({ ...toProspectFields(input), user_id: user.id, created_at: now, updated_at: now }).select(columns).single();
    if (error) throw cloudError(error);
    return fromProspectRow(data);
  }

  async function update(id: string, input: ProspectInput) {
    await assertUser();
    const { data, error } = await client.from("prospects").update({ ...toProspectFields(input), updated_at: new Date().toISOString() }).eq("id", id).select(columns).single();
    if (error) throw cloudError(error);
    return fromProspectRow(data);
  }

  async function remove(id: string) {
    await assertUser();
    const { data, error } = await client.from("prospects").delete().eq("id", id).select("id");
    if (error) throw cloudError(error);
    if (!data?.some((row) => row.id === id)) throw new Error("Ce prospect n’existe plus ou n’est pas accessible à votre compte.");
  }

  async function importRows(rows: ImportRow[], localProspects?: Prospect[]) {
    // Relire le cloud évite de comparer uniquement à une liste périmée dans un onglet.
    const existing = await list();
    const { accepted, duplicates } = selectNewImportRows(rows, existing);
    const user = await assertUser();
    const now = new Date().toISOString();
    const inserts: ProspectInsert[] = await Promise.all(accepted.map(async ({ input, line }) => {
      const original = localProspects?.[line - 1];
      return {
        ...toProspectFields(input), user_id: user.id,
        id: original ? await migrationId(user.id, original.id) : crypto.randomUUID(),
        created_at: original?.createdAt ?? now, updated_at: now,
      };
    }));
    if (inserts.length > 0) {
      // Une requête, donc une transaction ; les IDs stables protègent les reprises de migration.
      const { error } = await client.from("prospects").upsert(inserts, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw cloudError(error);
    }
    const prospects = await list();
    const savedById = new Map(prospects.map((prospect) => [prospect.id, prospect]));
    for (let index = 0; index < inserts.length; index += 1) {
      const saved = savedById.get(inserts[index].id!);
      if (!saved || JSON.stringify(toProspectFields(saved)) !== JSON.stringify(toProspectFields(accepted[index].input))
        || Date.parse(saved.createdAt) !== Date.parse(inserts[index].created_at!)) {
        throw new Error("Le transfert n’a pas pu être entièrement vérifié. La sauvegarde locale reste intacte ; actualisez avant de réessayer.");
      }
    }
    return { prospects, added: inserts.length, skipped: duplicates.length };
  }

  return { list, add, update, remove, importRows };
}
