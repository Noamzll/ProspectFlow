import type { Metadata } from "next";
import { ProspectsWorkspace } from "@/components/prospects-workspace";

export const metadata: Metadata = { title: "ProspectFlow — Prospects" };

export default function ProspectsPage() {
  return <ProspectsWorkspace />;
}
