import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ProspectsProvider } from "@/components/prospects-provider";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  if (!getSupabaseConfig()) redirect("/connexion?raison=configuration");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/connexion");
  return (
    <ProspectsProvider key={data.user.id} user={{ id: data.user.id, email: data.user.email ?? "" }}>
      <Sidebar />
      <div className="lg:ml-60">{children}</div>
    </ProspectsProvider>
  );
}
