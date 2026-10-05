"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-2xl font-semibold">La page n’a pas pu s’afficher.</h1>
      <p className="mt-3 text-sm text-slate-500">Réessayez de charger votre espace.</p>
      <button type="button" onClick={reset} className="button-primary mt-6">Réessayer</button>
    </main>
  );
}
