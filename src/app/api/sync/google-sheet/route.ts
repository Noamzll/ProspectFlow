import "server-only";
import { createSyncHandler, getSyncConfig } from "@/lib/google-sheet-sync/handler";
import { syncSheetRows } from "@/lib/google-sheet-sync/service";
import { createSyncClient } from "@/lib/supabase/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createSyncHandler(
  () => getSyncConfig(process.env),
  (rows, userId, dryRun) => syncSheetRows(createSyncClient(), rows, userId, dryRun),
);
