"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button type="button" aria-label="Fermer la fenêtre" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" aria-hidden="true" /></button>
      </div>
      {children}
    </dialog>
  );
}
