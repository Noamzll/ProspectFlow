"use client";

import { Modal } from "@/components/modal";
import { useProspects } from "@/components/prospects-provider";
import type { Prospect } from "@/types/prospect";

export function DeleteProspectDialog({ prospect, onClose, onDeleted }: { prospect: Prospect; onClose: () => void; onDeleted?: () => void }) {
  const { removeProspect, error } = useProspects();
  return (
    <Modal title="Supprimer ce prospect ?" onClose={onClose}>
      <div className="p-6">
        <p className="text-sm leading-6 text-slate-600">Vous allez retirer <strong>{prospect.company}</strong> et ses notes de votre espace. Cette action est définitive.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus onClick={onClose} className="button-secondary">Annuler</button>
          <button type="button" onClick={() => { if (removeProspect(prospect.id)) { onClose(); onDeleted?.(); } }} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700">Supprimer définitivement</button>
        </div>
      </div>
    </Modal>
  );
}
