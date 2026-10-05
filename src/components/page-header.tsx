export function PageHeader({ label }: { label: string }) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 sm:px-8">
      <p className="text-sm text-slate-500">Espace commercial <span className="mx-2 text-slate-300">/</span><span className="font-medium text-slate-800">{label}</span></p>
      <span className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">Sauvegarde cloud</span>
    </header>
  );
}
