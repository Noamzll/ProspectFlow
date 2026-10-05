"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, RotateCcw, Search, Trash2, Users } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { ProspectForm } from "@/components/prospect-form";
import { DeleteProspectDialog } from "@/components/delete-prospect-dialog";
import { formatActionDate, prospectStatuses } from "@/lib/prospect-validation";
import type { Prospect } from "@/types/prospect";

type SortKey = "company" | "sector" | "city" | "email" | "website" | "status" | "nextAction";
type Sort = { key: SortKey; direction: "asc" | "desc" };

const columns: { key: SortKey; label: string }[] = [
  { key: "company", label: "Entreprise" },
  { key: "sector", label: "Secteur" },
  { key: "city", label: "Ville" },
  { key: "email", label: "Email" },
  { key: "website", label: "Site internet" },
  { key: "status", label: "Statut" },
  { key: "nextAction", label: "Prochaine action" },
];

const statuses = prospectStatuses;
const controlClass = "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

// « Énergie » et « energie » deviennent comparables pour la recherche.
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export function ProspectsTable({ prospects }: { prospects: Prospect[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<Sort | null>(null);
  const [clientFilter, setClientFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [deleting, setDeleting] = useState<Prospect | null>(null);

  const sectors = [...new Set(prospects.map((p) => p.sector))].sort((a, b) => a.localeCompare(b, "fr"));
  const cities = [...new Set(prospects.map((p) => p.city))].sort((a, b) => a.localeCompare(b, "fr"));
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const hasChanges = Boolean(query || status || sector || city || clientFilter || sort || page !== 1 || pageSize !== 10);

  // filter produit un nouveau tableau : sort ne modifie pas les données reçues.
  const visibleProspects = prospects
    .filter((prospect) => {
      const text = normalize([...columns.map(({ key }) => prospect[key]), prospect.notes ?? ""].join(" "));
      return words.every((word) => text.includes(word))
        && (!status || prospect.status === status)
        && (!sector || prospect.sector === sector)
        && (!city || prospect.city === city)
        && (!clientFilter || (clientFilter === "clients" ? prospect.isClient : !prospect.isClient));
    })
    .sort((a, b) => {
      if (sort === null) return b.createdAt.localeCompare(a.createdAt);

      const comparison = sort.key === "status"
        ? statuses.indexOf(a.status) - statuses.indexOf(b.status)
        : a[sort.key].localeCompare(b[sort.key], "fr", { sensitivity: "base", numeric: true });

      return (sort.direction === "asc" ? comparison : -comparison)
        || b.createdAt.localeCompare(a.createdAt)
        || a.id.localeCompare(b.id);
    });

  const totalPages = Math.max(1, Math.ceil(visibleProspects.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageProspects = visibleProspects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: SortKey) {
    setPage(1);
    setSort((current) => ({
      key,
      direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function reset() {
    setQuery("");
    setStatus("");
    setSector("");
    setCity("");
    setSort(null);
    setClientFilter("");
    setPage(1);
    setPageSize(10);
  }

  return (
    <>
    <section aria-labelledby="prospects-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <h2 id="prospects-title" className="font-semibold">Votre liste de prospects</h2>
          <p className="mt-1 text-sm text-slate-500">{sort === null ? "Du plus récent au plus ancien." : "Cliquez sur une colonne pour inverser son tri."}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <Users className="size-4" aria-hidden="true" />
          <span role="status">{visibleProspects.length} sur {prospects.length} prospects</span>
        </span>
      </div>

      <div className="grid gap-4 border-b border-slate-100 px-5 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
        <div className="sm:col-span-2 xl:col-span-3">
          <label htmlFor="prospect-search" className="mb-1.5 block text-xs font-medium text-slate-600">Rechercher</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" aria-hidden="true" />
            <input id="prospect-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Entreprise, email, action ou notes…" className={`${controlClass} pl-9`} />
          </div>
        </div>
        <div>
          <label htmlFor="prospect-status" className="mb-1.5 block text-xs font-medium text-slate-600">Statut</label>
          <select id="prospect-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={controlClass}>
            <option value="">Tous les statuts</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="prospect-sector" className="mb-1.5 block text-xs font-medium text-slate-600">Secteur</label>
          <select id="prospect-sector" value={sector} onChange={(event) => { setSector(event.target.value); setPage(1); }} className={controlClass}>
            <option value="">Tous les secteurs</option>
            {sectors.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="prospect-city" className="mb-1.5 block text-xs font-medium text-slate-600">Ville</label>
          <select id="prospect-city" value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} className={controlClass}>
            <option value="">Toutes les villes</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-3">
          <label htmlFor="prospect-client" className="text-xs font-medium text-slate-600">Relation</label>
          <select id="prospect-client" value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setPage(1); }} className="form-control w-auto">
            <option value="">Prospects et clients</option>
            <option value="prospects">Prospects uniquement</option>
            <option value="clients">Clients obtenus</option>
          </select>
        <button type="button" onClick={reset} disabled={!hasChanges} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40">
          <RotateCcw className="size-4" aria-hidden="true" />Réinitialiser
        </button>
        </div>
      </div>

      {/* Le tableau défile dans son conteneur sans élargir toute la page. */}
      <div
        role="region"
        aria-label="Tableau des prospects, défilement horizontal possible"
        tabIndex={0}
        className="relative overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600"
      >
        <table className="w-full min-w-300 text-left text-sm">
          <caption className="sr-only">
            Liste des prospects : entreprise, secteur, ville, email, site internet, statut et prochaine action.
          </caption>
          <thead className="bg-slate-50/70 text-xs text-slate-500">
            <tr>

              {columns.map(({ key, label }) => (
                <th key={key} scope="col" aria-sort={sort?.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="px-4 py-3 font-medium">
                  <button type="button" onClick={() => toggleSort(key)} aria-label={`Trier par ${label} (${sort?.key === key && sort.direction === "asc" ? "décroissant" : "croissant"})`} className="inline-flex items-center gap-2 whitespace-nowrap rounded text-left hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
                    {label}
                    {sort?.key === key ? (sort.direction === "asc" ? <ArrowUp className="size-3.5 text-indigo-600" aria-hidden="true" /> : <ArrowDown className="size-3.5 text-indigo-600" aria-hidden="true" />) : <ArrowUpDown className="size-3.5 text-slate-400" aria-hidden="true" />}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageProspects.map((prospect) => (
              <tr key={prospect.id} className="hover:bg-slate-50/60">
                <th scope="row" className="px-6 py-5 text-left font-medium">
                  <div className="flex min-w-44 items-center gap-3">
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      {prospect.company.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <Link href={`/prospects/${encodeURIComponent(prospect.id)}`} className="break-words hover:text-indigo-600 hover:underline">{prospect.company}</Link>
                      {prospect.isClient && <p className="mt-1 text-xs font-medium text-emerald-700">Client obtenu</p>}
                    </div>
                  </div>
                </th>
                <td className="px-4 py-5 text-slate-500">{prospect.sector}</td>
                <td className="px-4 py-5 text-slate-500">{prospect.city}</td>
                <td className="px-4 py-5">
                  {prospect.email ? <a href={`mailto:${prospect.email}`} className="text-slate-600 underline-offset-4 hover:text-indigo-600 hover:underline">
                    {prospect.email}
                  </a> : <span className="text-slate-400">Non renseigné</span>}
                </td>
                <td className="px-4 py-5">
                  {prospect.website ? <a
                    href={prospect.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600 underline-offset-4 hover:text-indigo-600 hover:underline"
                  >
                    {new URL(prospect.website).hostname}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    <span className="sr-only"> (nouvel onglet)</span>
                  </a> : <span className="text-slate-400">Non renseigné</span>}
                </td>
                <td className="px-4 py-5"><StatusBadge status={prospect.status} /></td>
                <td className="min-w-48 px-6 py-5 text-slate-500">
                  <p className="break-words">{prospect.nextAction || "Aucune action prévue"}</p>
                  {prospect.nextActionDate && <p className="mt-1 text-xs">{formatActionDate(prospect.nextActionDate)}</p>}
                </td>
                <td className="px-4 py-5">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditing(prospect)} aria-label={`Modifier ${prospect.company}`} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="size-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => setDeleting(prospect)} aria-label={`Supprimer ${prospect.company}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" aria-hidden="true" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleProspects.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  {prospects.length === 0 ? "Aucun prospect pour le moment." : "Aucun prospect ne correspond à votre recherche."}
                  {hasChanges && <button type="button" onClick={reset} className="mx-auto mt-3 block rounded font-medium text-indigo-600 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">Réinitialiser le tableau</button>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <label htmlFor="prospect-page-size">Lignes par page</label>
          <select id="prospect-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span>Page {currentPage} sur {totalPages}</span>
          <button type="button" aria-label="Page précédente" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden="true" /></button>
          <button type="button" aria-label="Page suivante" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="size-4" aria-hidden="true" /></button>
        </div>
      </div>
      <p className="border-t border-slate-100 px-6 py-3 text-xs leading-5 text-slate-500">
        Sur petit écran, faites défiler le tableau horizontalement pour voir toutes les colonnes.
      </p>
    </section>
    {editing && <ProspectForm prospect={editing} onClose={() => setEditing(null)} />}
    {deleting && <DeleteProspectDialog prospect={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
