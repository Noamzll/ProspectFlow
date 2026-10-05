"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cloudError, createProspectsService } from "@/lib/prospects-service";
import { detectLocalMigration, markLocalMigration } from "@/lib/local-migration";
import type { ImportRow } from "@/lib/import-prospects";
import type { Prospect, ProspectInput } from "@/types/prospect";
import { downloadProspects } from "@/lib/export-prospects";

type Account = { id: string; email: string };
type LocalMigration = NonNullable<Awaited<ReturnType<typeof detectLocalMigration>>>;
type CloudState = {
  prospects: Prospect[];
  ready: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  migration: LocalMigration | null;
  migrationWarning: string | null;
};
type Change = { apply: (items: Prospect[]) => Prospect[]; notice: string; confirmed?: () => string | void };
type ProspectsContextValue = CloudState & {
  user: Account;
  loadProspects: () => Promise<void>;
  clearNotice: () => void;
  addProspect: (input: ProspectInput) => Promise<boolean>;
  updateProspect: (id: string, input: ProspectInput) => Promise<boolean>;
  removeProspect: (id: string) => Promise<boolean>;
  importProspects: (rows: ImportRow[]) => Promise<boolean>;
  exportProspects: () => Promise<boolean>;
  migrateLocal: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const ProspectsContext = createContext<ProspectsContextValue | null>(null);
const emptyState: CloudState = { prospects: [], ready: false, busy: false, error: null, notice: null, migration: null, migrationWarning: null };

export function ProspectsProvider({ user, children }: { user: Account; children: React.ReactNode }) {
  const [state, setState] = useState<CloudState>(emptyState);
  const client = useMemo(() => createClient(), []);
  const service = useMemo(() => createProspectsService(client, user.id), [client, user.id]);
  const generation = useRef(0);
  const busy = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const loadProspects = useCallback(async () => {
    if (busy.current) return;
    const request = ++generation.current;
    setState((current) => ({ ...current, error: null }));
    try {
      const prospects = await service.list();
      let migration: LocalMigration | null = null;
      let migrationWarning: string | null = null;
      if (prospects.length === 0) {
        try { migration = await detectLocalMigration(window.localStorage, user.id); }
        catch { migrationWarning = "La sauvegarde locale n’a pas pu être lue. Elle reste intacte. Vérifiez son contenu avant de la transférer."; }
      }
      if (request === generation.current) setState((current) => ({ ...current, prospects, ready: true, error: null, migration, migrationWarning }));
    } catch (error) {
      if (request === generation.current) setState((current) => ({ ...current, error: cloudError(error).message }));
    }
  }, [service, user.id]);

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== user.id) {
        generation.current += 1;
        setState(emptyState);
        window.location.replace("/connexion");
      }
    });
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("prospectflow.cloud-prospects");
      channel.current.onmessage = (event) => { if (event.data === user.id) void loadProspects(); };
    }
    const onFocus = () => { void loadProspects(); };
    window.addEventListener("focus", onFocus);
    void loadProspects();
    return () => {
      generation.current += 1;
      data.subscription.unsubscribe();
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", onFocus);
    };
  }, [client, user.id, loadProspects]);

  const clearNotice = useCallback(() => setState((current) => ({ ...current, notice: null })), []);

  async function mutate(change: () => Promise<Change>) {
    if (busy.current || !state.ready) return false;
    busy.current = true;
    // Invalider une lecture en cours évite qu’elle écrase ensuite une sauvegarde confirmée.
    const request = ++generation.current;
    setState((current) => ({ ...current, busy: true, error: null, notice: null }));
    try {
      const result = await change();
      if (request !== generation.current) return false;
      const warning = result.confirmed?.();
      setState((current) => {
        const prospects = result.apply(current.prospects);
        return { ...current, prospects, notice: result.notice + (warning ?? ""), migration: prospects.length > 0 ? null : current.migration };
      });
      channel.current?.postMessage(user.id);
      return true;
    } catch (error) {
      if (request === generation.current) setState((current) => ({ ...current, error: cloudError(error).message }));
      return false;
    } finally {
      busy.current = false;
      if (request === generation.current) setState((current) => ({ ...current, busy: false }));
    }
  }

  const addProspect = (input: ProspectInput) => mutate(async () => {
    const prospect = await service.add(input);
    return { apply: (items) => [prospect, ...items], notice: `${prospect.company} a été sauvegardé dans le cloud.` };
  });
  const updateProspect = (id: string, input: ProspectInput) => mutate(async () => {
    const prospect = await service.update(id, input);
    return { apply: (items) => items.map((item) => item.id === id ? prospect : item), notice: `${prospect.company} a été mis à jour.` };
  });
  const removeProspect = (id: string) => mutate(async () => {
    await service.remove(id);
    return { apply: (items) => items.filter((item) => item.id !== id), notice: "Le prospect a été supprimé du cloud." };
  });
  const importProspects = (rows: ImportRow[]) => mutate(async () => {
    const result = await service.importRows(rows);
    return { apply: () => result.prospects, notice: `${result.added} prospects importés dans le cloud · ${result.skipped} doublons ignorés.` };
  });
  const exportProspects = () => mutate(async () => {
    const prospects = await service.list();
    return { apply: () => prospects, confirmed: () => downloadProspects(prospects), notice: "L’export CSV a été préparé à partir de votre sauvegarde cloud." };
  });
  const migrateLocal = () => mutate(async () => {
    if (!state.migration) throw new Error("Aucune sauvegarde locale à transférer.");
    const local = state.migration;
    const result = await service.importRows(local.prospects.map((input, index) => ({ input, line: index + 1 })), local.prospects);
    return {
      apply: () => result.prospects,
      confirmed: () => {
        try { markLocalMigration(window.localStorage, user.id, local.fingerprint); }
        catch { return " Le repère de migration n’a pas pu être enregistré dans ce navigateur."; }
      },
      notice: `${result.added} prospects transférés et vérifiés · ${result.skipped} doublons ignorés. La copie locale est conservée.`,
    };
  });

  async function signOut() {
    if (busy.current) return;
    busy.current = true;
    generation.current += 1;
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      generation.current += 1;
      setState(emptyState);
      window.location.replace("/connexion");
    } catch {
      setState((current) => ({ ...current, busy: false, error: "La déconnexion n’a pas abouti. Réessayez." }));
    } finally { busy.current = false; }
  }

  return <ProspectsContext.Provider value={{ ...state, user, loadProspects, clearNotice, addProspect, updateProspect, removeProspect, importProspects, exportProspects, migrateLocal, signOut }}>{children}</ProspectsContext.Provider>;
}

export function useProspects() {
  const context = useContext(ProspectsContext);
  if (!context) throw new Error("useProspects doit être utilisé dans ProspectsProvider");
  return context;
}

export function StorageFeedback() {
  const { error, notice, busy, migration, migrationWarning, clearNotice, loadProspects, migrateLocal } = useProspects();
  const [later, setLater] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 12000);
    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);

  return (
    <>
      {migration && <section aria-label="Transfert des prospects locaux" className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
        <p className="font-medium">Des prospects enregistrés localement ont été détectés.</p>
        {!later && <p className="mt-2 leading-6">Voulez-vous transférer ces {migration.prospects.length} prospects vers la sauvegarde cloud de votre compte ? Votre copie locale sera conservée. Les doublons seront ignorés.</p>}
        <div className="mt-3 flex flex-wrap gap-3">
          {later ? <button type="button" onClick={() => setLater(false)} className="button-secondary">Voir la proposition de transfert</button> : <>
            <button type="button" disabled={busy} onClick={() => { void migrateLocal(); }} className="button-primary"><CloudUpload className="size-4" aria-hidden="true" />{busy ? "Transfert en cours…" : "Transférer vers mon cloud"}</button>
            <button type="button" disabled={busy} onClick={() => setLater(true)} className="button-secondary">Plus tard</button>
          </>}
        </div>
      </section>}
      {migrationWarning && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{migrationWarning}</p>}
      {error && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="flex-1">{error}</p><button type="button" disabled={busy} onClick={() => { void loadProspects(); }} className="rounded font-semibold underline underline-offset-4">Actualiser les données</button></div>}
      {busy && <p role="status" className="mb-4 text-sm text-slate-500">Synchronisation avec le cloud en cours…</p>}
      {notice && <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p role="status">{notice}</p><button type="button" aria-label="Masquer le message" onClick={clearNotice} className="rounded p-1"><X className="size-4" aria-hidden="true" /></button></div>}
    </>
  );
}
