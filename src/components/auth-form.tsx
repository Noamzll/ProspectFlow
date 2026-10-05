"use client";

import { useRef, useState } from "react";
import { Workflow } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const reasons: Record<string, string> = {
  confirmation: "Le lien de confirmation est invalide ou a expiré. Réessayez de vous connecter ou utilisez un nouveau lien de confirmation.",
  indisponible: "Le service de connexion est momentanément indisponible. Réessayez dans un instant.",
};

export function AuthForm({ configured, reason }: { configured: boolean; reason?: string }) {
  const [signup, setSignup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(reason ? reasons[reason] ?? null : null);
  const [message, setMessage] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !configured) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    try {
      const client = createClient();
      const result = signup
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        const code = result.error.code;
        setError(code === "invalid_credentials" ? "Email ou mot de passe incorrect."
          : code === "email_not_confirmed" ? "Confirmez votre adresse email avant de vous connecter."
          : code === "weak_password" ? "Choisissez un mot de passe plus long et plus difficile à deviner."
          : code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ? "Trop de tentatives. Patientez avant de réessayer."
          : "La connexion n’a pas abouti. Vérifiez vos informations et réessayez.");
      } else if (result.data.session) {
        // Un chargement complet force la vérification serveur et vide l’ancien cache utilisateur.
        window.location.replace("/");
      } else {
        setMessage("Consultez votre boîte mail pour confirmer votre inscription, puis connectez-vous.");
      }
    } catch {
      setError("Impossible de joindre le service de connexion. Vérifiez votre connexion internet.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-xl font-semibold tracking-tight"><span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Workflow className="size-6" aria-hidden="true" /></span>ProspectFlow</div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Créer votre compte" : "Retrouvez votre espace"}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Vos prospects et votre suivi commercial, sauvegardés dans le cloud.</p>
          {!configured && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">La connexion cloud n’est pas configurée pour cet environnement. Renseignez les deux variables Supabase indiquées dans le README, puis redémarrez ou redéployez l’application.</p>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <fieldset disabled={pending || !configured} className="space-y-4 disabled:opacity-60">
              <div><label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium">Email</label><input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} className="form-control" placeholder="vous@entreprise.fr" /></div>
              <div><label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium">Mot de passe</label><input id="auth-password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : 1} required className="form-control" />{signup && <p className="mt-2 text-xs text-slate-500">Au moins 8 caractères.</p>}</div>
              <button type="submit" className="button-primary w-full">{pending ? "Connexion en cours…" : signup ? "Créer mon compte" : "Se connecter"}</button>
            </fieldset>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{message}</p>}
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">{signup ? "Déjà un compte ? " : "Pas encore de compte ? "}<button type="button" disabled={pending} onClick={() => { setSignup(!signup); setError(null); setMessage(null); }} className="rounded font-medium text-indigo-600 hover:underline">{signup ? "Se connecter" : "S’inscrire"}</button></p>
        </section>
      </div>
    </main>
  );
}
