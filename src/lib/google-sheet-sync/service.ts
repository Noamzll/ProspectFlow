import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SheetRow } from "./validation.ts";
import { SyncError } from "./validation.ts";
import type { SyncResult } from "./handler.ts";

export async function syncSheetRows(client: SupabaseClient<Database>, rows: SheetRow[], userId: string, dryRun: boolean): Promise<SyncResult> {
  const { data, error } = await client.rpc("sync_google_sheet_prospects", { p_user_id: userId, p_rows: rows, p_dry_run: dryRun });
  if (error) {
    if (error.code === "P0001" || error.code === "23505") throw new SyncError(409, "identity_conflict_link_existing_id");
    if (["22023", "22P02", "23514"].includes(error.code)) throw new SyncError(422, "invalid_row");
    if (["PGRST202", "42703", "42883"].includes(error.code)) throw new SyncError(503, "migration_required");
    throw new SyncError(502, "database_sync_failed");
  }
  if (!data || data.dryRun !== dryRun || [data.created, data.updated, data.unchanged].some((value) => !Number.isSafeInteger(value) || value < 0)
    || data.created + data.updated + data.unchanged !== rows.length) throw new SyncError(502, "unconfirmed_sync");
  return data;
}
