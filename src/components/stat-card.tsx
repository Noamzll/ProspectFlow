import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, description, icon: Icon }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-600">{label}</h2>
        <Icon className="size-4 text-slate-400" aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </article>
  );
}
