"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LayoutDashboard, Users, Workflow } from "lucide-react";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex border-b border-slate-200 bg-white p-4 lg:fixed lg:inset-y-0 lg:w-60 lg:flex-col lg:border-r lg:border-b-0 lg:p-5">
      <Link href="/" aria-label="ProspectFlow — Dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><Workflow className="size-5" aria-hidden="true" /></span>
        <span>ProspectFlow<span className="block text-[10px] font-medium tracking-widest text-slate-400 uppercase">Votre espace commercial</span></span>
      </Link>
      <nav aria-label="Navigation principale" className="ml-auto flex items-center gap-2 lg:mt-10 lg:ml-0 lg:block lg:space-y-2">
        {navigation.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sr-only sm:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:block">
        <p className="flex items-center gap-2 text-sm font-medium">Un prospect à la fois <ArrowUpRight className="size-4 text-indigo-500" aria-hidden="true" /></p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Une vue claire pour faire avancer vos prochaines conversations.</p>
      </div>
      <div className="mt-5 hidden items-center gap-3 border-t border-slate-100 pt-5 lg:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">PF</span>
        <div><p className="text-xs font-medium">Mon espace commercial</p><p className="mt-0.5 text-xs text-slate-500">Sauvegarde dans ce navigateur</p></div>
      </div>
    </aside>
  );
}
