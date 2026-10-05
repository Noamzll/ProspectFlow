"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospect-form";
import { DeleteProspectDialog } from "@/components/delete-prospect-dialog";
import { StorageFeedback, useProspects } from "@/components/prospects-provider";
import { StatusBadge } from "@/components/status-badge";
import { formatActionDate } from "@/lib/prospect-validation";

export function ProspectDetail({ id }: { id: string }) {
  const { prospects, ready } = useProspects();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const prospect = prospects.find((p) => p.id === id);

  return (
    <>
      <PageHeader label="Fiche prospect" />
      <main id="main-content" className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <Link href="/prospects" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"><ArrowLeft className="size-4" aria-hidden="true" />Retour aux prospects</Link>
        <StorageFeedback />
        {!ready ? <p role="status">Chargement du prospect…</p> : !prospect ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8">
            <h1 className="text-2xl font-semibold">Prospect introuvable</h1>
            <p className="mt-3 text-sm text-slate-500">Ce prospect n’existe pas dans ce navigateur ou a été supprimé.</p>
            <Link href="/prospects" className="button-primary mt-6">Consulter les prospects</Link>
          </section>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
              <div className="min-w-0 max-w-full">
                <h1 className="break-words text-3xl font-semibold tracking-tight">{prospect.company}</h1>
                <p className="mt-2 text-sm text-slate-500">{prospect.sector} · {prospect.city}</p>
                <div className="mt-3 flex items-center gap-2"><StatusBadge status={prospect.status} />{prospect.isClient && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Client obtenu</span>}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setEditing(true)} className="button-primary"><Pencil className="size-4" aria-hidden="true" />Modifier</button>
                <button type="button" onClick={() => setDeleting(true)} className="button-secondary text-red-600"><Trash2 className="size-4" aria-hidden="true" />Supprimer</button>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-semibold">Coordonnées</h2>
                <dl className="mt-5 space-y-5 text-sm">
                  <div><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all">{prospect.email ? <a href={`mailto:${prospect.email}`} className="text-indigo-600 hover:underline">{prospect.email}</a> : "Non renseigné"}</dd></div>
                  <div><dt className="text-slate-500">Site internet</dt><dd className="mt-1 break-all">{prospect.website ? <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">{new URL(prospect.website).hostname}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only"> (nouvel onglet)</span></a> : "Non renseigné"}</dd></div>
                  <div><dt className="text-slate-500">Ajouté le</dt><dd className="mt-1">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(prospect.createdAt))}</dd></div>
                </dl>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-semibold">Prochaine action</h2>
                <p className="mt-5 text-sm leading-6 whitespace-pre-wrap break-words text-slate-600">{prospect.nextAction || "Aucune action prévue."}</p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><CalendarDays className="size-4" aria-hidden="true" />{formatActionDate(prospect.nextActionDate ?? "")}</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-2">
                <h2 className="font-semibold">Notes</h2>
                <p className="mt-4 text-sm leading-7 whitespace-pre-wrap break-words text-slate-600">{prospect.notes || "Aucune note pour le moment. Ajoutez le contexte de vos échanges en modifiant ce prospect."}</p>
              </section>
            </div>
            {editing && <ProspectForm prospect={prospect} onClose={() => setEditing(false)} />}
            {deleting && <DeleteProspectDialog prospect={prospect} onClose={() => setDeleting(false)} onDeleted={() => router.push("/prospects")} />}
          </>
        )}
      </main>
    </>
  );
}
