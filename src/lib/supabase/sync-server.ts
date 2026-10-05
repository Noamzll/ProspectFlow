import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SyncError } from "../google-sheet-sync/validation";

export function createSyncClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || key.startsWith("sb_publishable_") || (key.startsWith("sb_secret_") && key.length < 32)) throw new SyncError(503, "server_database_not_configured");
  try {
    if (new URL(url).protocol !== "https:") throw new Error();
    if (!key.startsWith("sb_secret_")) {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      if (payload.role !== "service_role") throw new Error();
    }
  } catch { throw new SyncError(503, "server_database_not_configured"); }
  // Client distinct de l'authentification utilisateur : aucun cookie ni stockage de session.
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
