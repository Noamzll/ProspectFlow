import { createHash, timingSafeEqual } from "node:crypto";
import { MAX_SYNC_BYTES, SyncError, UUID_PATTERN, validateSyncPayload } from "./validation.ts";
import type { SheetRow } from "./validation.ts";

export type SyncConfig = { secret: string; userId: string; spreadsheetId: string; sheetId: string; enabled: boolean };
export type SyncResult = { created: number; updated: number; unchanged: number; dryRun: boolean };
export type SyncOperation = (rows: SheetRow[], userId: string, dryRun: boolean) => Promise<SyncResult>;

export function getSyncConfig(env: Record<string, string | undefined>): SyncConfig | null {
  const secret = env.GOOGLE_SHEET_SYNC_SECRET ?? "";
  const userId = env.GOOGLE_SHEET_SYNC_USER_ID ?? "";
  const spreadsheetId = env.GOOGLE_SHEET_SPREADSHEET_ID ?? "";
  const sheetId = env.GOOGLE_SHEET_TAB_ID ?? "";
  if (secret.length < 32 || secret.length > 256 || /\s/.test(secret) || !UUID_PATTERN.test(userId)
    || !/^[a-zA-Z0-9_-]{20,200}$/.test(spreadsheetId) || !/^\d{1,12}$/.test(sheetId)) return null;
  return { secret, userId: userId.toLowerCase(), spreadsheetId, sheetId, enabled: env.GOOGLE_SHEET_SYNC_ENABLED === "true" };
}

function authorized(header: string | null, secret: string) {
  if (!header?.startsWith("Bearer ") || header.length > 300) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(secret));
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_SYNC_BYTES)) throw new SyncError(413, "payload_too_large");
  if (!request.body) throw new SyncError(400, "invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SYNC_BYTES) { await reader.cancel(); throw new SyncError(413, "payload_too_large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError(400, "invalid_json");
  } finally { reader.releaseLock(); }
}

export function createSyncHandler(getConfig: () => SyncConfig | null, sync: SyncOperation) {
  return async function POST(request: Request) {
    const reply = (body: unknown, status: number) => Response.json(body, { status, headers: {
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
    try {
      if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
      const config = getConfig();
      if (!config) return reply({ error: "sync_not_configured" }, 503);
      if (!authorized(request.headers.get("authorization"), config.secret)) return reply({ error: "unauthorized" }, 401);
      // Aucun appel provenant d'un navigateur ; aucune politique CORS permissive.
      if (request.headers.has("origin")) return reply({ error: "browser_request_forbidden" }, 403);
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return reply({ error: "unsupported_media_type" }, 415);
      }
      const payload = validateSyncPayload(await readJson(request));
      if (payload.spreadsheetId !== config.spreadsheetId || payload.sheetId !== config.sheetId) return reply({ error: "source_not_allowed" }, 403);
      if (!payload.dryRun && !config.enabled) return reply({ error: "writes_disabled" }, 409);
      // Le propriétaire provient exclusivement de la configuration serveur, jamais du JSON.
      const result = await sync(payload.rows, config.userId, payload.dryRun);
      return reply(result, 200);
    } catch (error) {
      if (error instanceof SyncError) return reply({ error: error.code, ...(error.details ? { details: error.details } : {}) }, error.status);
      // Ni secret, ni contacts, ni erreur brute Supabase dans la réponse ou les logs.
      return reply({ error: "sync_failed" }, 502);
    }
  };
}
