import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (token_hash && type === "email" && getSupabaseConfig()) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash, type: "email" });
    if (!error) return NextResponse.redirect(new URL("/", request.url), { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.redirect(new URL("/connexion?raison=confirmation", request.url), { headers: { "Cache-Control": "private, no-store" } });
}
