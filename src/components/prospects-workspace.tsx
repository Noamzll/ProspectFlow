"use client";

import { useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospect-form";
import { ProspectsTable } from "@/components/prospects-table";
import { StorageFeedback, useProspects } from "@/components/prospects-provider";
import { downloadProspects } from "@/lib/export-prospects";
import { ImportProspectsDialog } from "@/components/import-prospects-dialog";

export function ProspectsWorkspace() {
  const { prospects, ready } = useProspects();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  return (
    <>
      <PageHeader label="Prospects" />
      <main id="main-content" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-widest text-indigo-600 uppercase">Votre réseau commercial</p>
            <h1 className="text-3xl font-semibold tracking-tight">Prospects</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Retrouvez vos entreprises, leurs coordonnées et la prochaine action à mener.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setImporting(true)} disabled={!ready} className="button-secondary"><Upload className="size-4" aria-hidden="true" />Importer CSV</button>
            <button type="button" onClick={() => downloadProspects(prospects)} disabled={!ready || prospects.length === 0} className="button-secondary"><Download className="size-4" aria-hidden="true" />Exporter CSV</button>
            <button type="button" onClick={() => setAdding(true)} disabled={!ready} className="button-primary"><Plus className="size-4" aria-hidden="true" />Ajouter un prospect</button>
          </div>
        </div>
        <StorageFeedback />
        {ready ? <ProspectsTable prospects={prospects} /> : <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Chargement de vos prospects…</p>}
        <p className="mt-5 text-xs leading-5 text-slate-500">Vos données sont enregistrées dans ce navigateur. Les exemples utilisent des entreprises et des coordonnées fictives.</p>
      </main>
      {adding && <ProspectForm onClose={() => setAdding(false)} />}
      {importing && <ImportProspectsDialog onClose={() => setImporting(false)} />}
    </>
  );
}
