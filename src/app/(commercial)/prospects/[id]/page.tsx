import type { Metadata } from "next";
import { ProspectDetail } from "@/components/prospect-detail";

export const metadata: Metadata = { title: "ProspectFlow — Fiche prospect" };

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProspectDetail id={id} />;
}
