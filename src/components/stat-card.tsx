import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, description, icon: Icon }: StatCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex min-h-10 items-start justify-between gap-2">
        <h2 className="min-w-0 text-sm font-medium text-slate-600">{label}</h2>
        <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}
