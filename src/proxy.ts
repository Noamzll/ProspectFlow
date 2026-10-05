import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const config = getSupabaseConfig();
  const protectedPage = request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/prospects");

  function toLogin(reason?: string) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = reason ? `?raison=${reason}` : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Pragma", "no-cache");
    redirect.headers.set("Expires", "0");
    return redirect;
  }

  if (!config) return protectedPage ? toLogin("configuration") : response;
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  try {
    // getClaims vérifie le JWT ; getSession seul ne suffit pas à protéger une page.
    const { data, error } = await supabase.auth.getClaims();
    if (protectedPage && (error || !data?.claims?.sub)) return toLogin();
  } catch {
    if (protectedPage) return toLogin("indisponible");
  }
  return response;
}

export const config = { matcher: ["/", "/prospects/:path*", "/connexion", "/auth/:path*"] };
