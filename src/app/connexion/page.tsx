import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ProspectFlow — Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ raison?: string }> }) {
  const configured = Boolean(getSupabaseConfig());
  if (configured) {
    const client = await createClient();
    const { data } = await client.auth.getUser();
    if (data.user) redirect("/");
  }
  const { raison } = await searchParams;
  return <AuthForm configured={configured} reason={raison} />;
}
