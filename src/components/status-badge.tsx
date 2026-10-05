import type { ProspectStatus } from "@/types/prospect";

const colors: Record<ProspectStatus, string> = {
  Nouveau: "bg-slate-100 text-slate-600",
  "À vérifier": "bg-amber-50 text-amber-800",
  "Brouillon prêt": "bg-violet-50 text-violet-700",
  Envoyé: "bg-blue-50 text-blue-700",
  "Réponse reçue": "bg-emerald-50 text-emerald-700",
};

export function StatusBadge({ status, compact = false }: { status: ProspectStatus; compact?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full py-1 text-xs font-medium ${compact ? "px-2" : "px-2.5 whitespace-nowrap"} ${colors[status]}`}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}
