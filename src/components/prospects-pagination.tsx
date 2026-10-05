"use client";

import { useId } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function ProspectsPagination({ page, pageSize, total, label, onPageChange, onPageSizeChange }: PaginationProps) {
  // Deux navigations partagent le même état, avec des identifiants distincts.
  const id = useId();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const buttonClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40";

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-600 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" aria-atomic="true" className="font-medium">Prospects {first}–{last} sur {total}</p>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-size`}>Lignes par page</label>
          <select id={`${id}-size`} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2">
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Première page" disabled={page === 1} onClick={() => onPageChange(1)} className={buttonClass}><ChevronFirst className="size-4" aria-hidden="true" /></button>
        <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)} className={buttonClass}><ChevronLeft className="size-4" aria-hidden="true" />Précédent</button>
        <div className="flex items-center gap-1.5">
          <label htmlFor={`${id}-page`}>Page</label>
          <select id={`${id}-page`} value={page} onChange={(event) => onPageChange(Number(event.target.value))} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number}</option>)}
          </select>
          <span>sur {totalPages}</span>
        </div>
        <button type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className={buttonClass}>Suivant<ChevronRight className="size-4" aria-hidden="true" /></button>
        <button type="button" aria-label="Dernière page" disabled={page === totalPages} onClick={() => onPageChange(totalPages)} className={buttonClass}><ChevronLast className="size-4" aria-hidden="true" /></button>
      </div>
    </nav>
  );
}
