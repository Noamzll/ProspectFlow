"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/modal";
import { useProspects } from "@/components/prospects-provider";
import { prospectStatuses, validateProspect, type FormErrors } from "@/lib/prospect-validation";
import type { Prospect, ProspectInput } from "@/types/prospect";

const fields = [
  { name: "company", label: "Entreprise", required: true, maxLength: 120, placeholder: "Atelier Forma" },
  { name: "sector", label: "Secteur", required: true, maxLength: 120, placeholder: "Architecture" },
  { name: "city", label: "Ville", required: true, maxLength: 120, placeholder: "Lyon" },
  { name: "email", label: "Email", type: "email", maxLength: 254, placeholder: "contact@entreprise.fr" },
  { name: "website", label: "Site internet", type: "url", maxLength: 2048, placeholder: "https://entreprise.fr" },
  { name: "nextAction", label: "Prochaine action", maxLength: 300, placeholder: "Proposer un rendez-vous" },
  { name: "nextActionDate", label: "Date de la prochaine action", type: "date" },
] as const;

export function ProspectForm({ prospect, onClose, onSaved }: { prospect?: Prospect; onClose: () => void; onSaved?: () => void }) {
  const { addProspect, updateProspect, error, busy } = useProspects();
  const [errors, setErrors] = useState<FormErrors>({});
  const prefix = useId();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const input: ProspectInput = {
      company: text("company"), sector: text("sector"), city: text("city"),
      email: text("email"), website: text("website"),
      status: text("status") as ProspectInput["status"], nextAction: text("nextAction"),
      nextActionDate: text("nextActionDate"), notes: text("notes"), isClient: data.get("isClient") === "on",
    };
    const validationErrors = validateProspect(input);
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      const field = form.elements.namedItem(firstInvalid);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    const saved = await (prospect ? updateProspect(prospect.id, input) : addProspect(input));
    if (saved) { onClose(); onSaved?.(); }
  }

  return (
    <Modal title={prospect ? "Modifier le prospect" : "Ajouter un prospect"} onClose={onClose}>
      <form onSubmit={submit} noValidate className="p-6">
        <p className="mb-5 text-xs text-slate-500">Les champs marqués d’un * sont obligatoires.</p>
        <fieldset disabled={busy} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
          {fields.map((field) => {
            const id = `${prefix}-${field.name}`;
            return (
              <div key={field.name} className={field.name === "company" || field.name === "nextAction" ? "sm:col-span-2" : ""}>
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{field.label}{"required" in field && field.required ? " *" : ""}</label>
                <input id={id} name={field.name} type={"type" in field ? field.type : "text"} required={"required" in field && field.required} maxLength={"maxLength" in field ? field.maxLength : undefined} placeholder={"placeholder" in field ? field.placeholder : undefined} defaultValue={prospect?.[field.name] ?? ""} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${id}-error` : undefined} className="form-control" />
                {errors[field.name] && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{errors[field.name]}</p>}
              </div>
            );
          })}
          <div>
            <label htmlFor={`${prefix}-status`} className="mb-1.5 block text-sm font-medium text-slate-700">Statut</label>
            <select id={`${prefix}-status`} name="status" defaultValue={prospect?.status ?? "Nouveau"} className="form-control">
              {prospectStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${prefix}-notes`} className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
            <textarea id={`${prefix}-notes`} name="notes" rows={3} maxLength={5000} defaultValue={prospect?.notes ?? ""} className="form-control h-auto py-2" placeholder="Contexte, besoin identifié, compte rendu…" />
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:col-span-2">
            <input type="checkbox" name="isClient" defaultChecked={prospect?.isClient ?? false} className="size-4 accent-indigo-600" />
            <span>Ce prospect est devenu client</span>
          </label>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={onClose} className="button-secondary">Annuler</button>
          <button type="submit" disabled={busy} className="button-primary">{busy ? "Sauvegarde en cours…" : prospect ? "Enregistrer les modifications" : "Créer le prospect"}</button>
        </div>
      </form>
    </Modal>
  );
}
