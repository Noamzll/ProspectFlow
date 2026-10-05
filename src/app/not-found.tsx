import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-3 text-3xl font-semibold">Page introuvable</h1>
      <p className="mt-3 text-sm text-slate-500">Retrouvez votre espace de prospection depuis le dashboard.</p>
      <Link href="/" className="button-primary mt-6">Retour au dashboard</Link>
    </main>
  );
}
