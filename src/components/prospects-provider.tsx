"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { addProspect, clearNotice, getServerSnapshot, getSnapshot, importProspects, loadProspects, removeProspect, subscribe, updateProspect } from "@/lib/prospect-store";

type ProspectsContextValue = ReturnType<typeof getSnapshot> & {
  addProspect: typeof addProspect;
  updateProspect: typeof updateProspect;
  removeProspect: typeof removeProspect;
  importProspects: typeof importProspects;
};

const ProspectsContext = createContext<ProspectsContextValue | null>(null);

export function ProspectsProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <ProspectsContext.Provider value={{ ...snapshot, addProspect, updateProspect, removeProspect, importProspects }}>
      {children}
    </ProspectsContext.Provider>
  );
}

export function useProspects() {
  const context = useContext(ProspectsContext);
  if (!context) throw new Error("useProspects doit être utilisé dans ProspectsProvider");
  return context;
}

export function StorageFeedback() {
  const { error, notice } = useProspects();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (error) return (
    <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex-1">{error}</p>
      <button type="button" onClick={loadProspects} className="rounded font-semibold underline underline-offset-4">Actualiser les données</button>
    </div>
  );
  return notice ? (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <p role="status">{notice}</p>
      <button type="button" aria-label="Masquer le message" onClick={clearNotice} className="rounded p-1"><X className="size-4" aria-hidden="true" /></button>
    </div>
  ) : null;
}
