"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCheck, FileText, MessageSquare, Plus, Send, Target, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospect-form";
import { StorageFeedback, useProspects } from "@/components/prospects-provider";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardStats } from "@/data/prospects";

export function Dashboard() {
  const { prospects, ready, busy, error } = useProspects();
  const [adding, setAdding] = useState(false);
  const stats = getDashboardStats(prospects);
  // Copier avant sort évite de modifier le tableau de données partagé.
  const recentProspects = [...prospects]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const cards = [
    { label: "Total des prospects", value: stats.total, description: "Dans votre espace de prospection", icon: Users },
    { label: "À contacter", value: stats.toContact, description: "Premier contact à envoyer", icon: Target },
    { label: "Brouillons prêts", value: stats.drafts, description: "Emails à relire avant envoi", icon: FileText },
    { label: "Prospects contactés", value: stats.contacted, description: "Contact établi, réponses incluses", icon: Send },
    { label: "Réponses reçues", value: stats.replies, description: "Conversations engagées", icon: MessageSquare },
    { label: "Clients obtenus", value: stats.clients, description: "Prospects devenus clients", icon: CheckCheck },
  ];

  return (
    <>
      <PageHeader label="Dashboard" />
      <main id="main-content" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold tracking-widest text-indigo-600 uppercase">Vue d’ensemble</p>
          <h1 className="text-3xl font-semibold tracking-tight">Votre prospection, en un coup d’œil.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Gardez le cap sur vos prospects et vos prochaines opportunités.</p>
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <button type="button" className="button-primary" disabled={!ready || busy} onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden="true" />Ajouter un prospect</button>
          <Link href="/prospects" className="button-secondary">Voir tous les prospects</Link>
        </div>
        <StorageFeedback />
        {!ready ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{error ? "Votre dashboard cloud n’a pas pu être chargé. Actualisez les données ci-dessus." : "Chargement de votre dashboard…"}</p> : <>
        <section aria-label="Indicateurs de prospection" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => <StatCard key={card.label} {...card} />)}
        </section>

        <section aria-labelledby="recent-title" className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div><h2 id="recent-title" className="font-semibold">Derniers prospects ajoutés</h2><p className="mt-1 text-sm text-slate-500">Les nouvelles entreprises de votre réseau.</p></div>
            <span className="text-xs text-slate-500">{recentProspects.length} sur {stats.total} prospects</span>
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Les cinq prospects les plus récemment ajoutés, leur statut et leur prochaine action.</caption>
              <thead className="bg-slate-50/70 text-xs text-slate-500">
                <tr><th scope="col" className="px-6 py-3 font-medium">Entreprise</th><th scope="col" className="px-6 py-3 font-medium">Statut</th><th scope="col" className="px-6 py-3 font-medium">Prochaine action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentProspects.map((prospect) => (
                  <tr key={prospect.id}>
                    <th scope="row" className="px-6 py-4 font-normal">
                      <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">{prospect.company.slice(0, 2).toUpperCase()}</span><div className="min-w-36"><Link href={`/prospects/${encodeURIComponent(prospect.id)}`} className="font-medium hover:text-indigo-600 hover:underline">{prospect.company}</Link><p className="mt-1 text-xs text-slate-500">{prospect.sector} · {prospect.city}</p></div></div>
                    </th>
                    <td className="px-6 py-4"><StatusBadge status={prospect.status} /></td>
                    <td className="min-w-52 px-6 py-4 text-slate-500">{prospect.nextAction}</td>
                  </tr>
                ))}
                {recentProspects.length === 0 && <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-500">Aucun prospect pour le moment.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-5 text-xs leading-5 text-slate-500">Les indicateurs se recoupent : un brouillon prêt est aussi un prospect à contacter, et un client peut avoir déjà répondu.</p>
        </>}
      </main>
      {adding && <ProspectForm onClose={() => setAdding(false)} />}
    </>
  );
}
