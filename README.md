# ProspectFlow

Mini SaaS de prospection commerciale avec Next.js App Router, TypeScript, Tailwind CSS et Supabase Auth/PostgreSQL. Les prospects sont désormais sauvegardés dans le compte cloud de l’utilisateur connecté.

## Fonctionnalités conservées

- Dashboard : total, à contacter, brouillons, contactés, réponses, clients et derniers ajouts.
- Tableau avec recherche, filtres combinables, tri et pagination de 50 lignes par défaut.
- Navigation en haut et en bas, choix de page, première/dernière page et compteur de lignes.
- Création, modification, suppression confirmée, fiches, notes, échéances et suivi des clients.
- Import CSV avec sélection ou collage, validation, aperçu et détection des doublons.
- Export CSV des données relues dans Supabase au moment de l’export.
- Inscription email/mot de passe, connexion, confirmation email et déconnexion.
- Session persistante par cookies, rafraîchissement des jetons et protection des routes commerciales.
- Proposition de migration des prospects locaux, uniquement après confirmation de l’utilisateur.
- Synchronisation entre onglets du même navigateur, et relecture du cloud au retour dans l’onglet.

Les URL `/`, `/prospects` et `/prospects/[id]` restent identiques. Les exemples locaux ne sont plus affichés comme des données cloud et ne sont jamais injectés automatiquement.

## Synchronisation Google Sheets (activation facultative)

Une route serveur sécurisée permet la synchronisation Google Sheet → Supabase, par lots, avec IDs stables et simulation préalable. Elle est désactivée par défaut et ne modifie pas les notes, échéances, clients ni les policies RLS. Le script relit le Sheet toutes les quinze minutes et retrouve aussi les modifications effectuées par API. Si la simulation complète ne détecte aucune création ni modification, aucun appel d'écriture n'est envoyé.

Le [guide complet](google-apps-script/README.md) contient le SQL à exécuter, les variables Netlify, le code Apps Script à installer, le rattachement des prospects existants et un parcours de test isolé. Ne pas activer les écritures avant d'avoir vérifié le compte destinataire et les IDs des prospects déjà présents.

## Installation sur iPhone

Après déploiement, ouvrir ProspectFlow dans Safari → **Partager → Sur l'écran d'accueil → Ajouter**, avec « Ouvrir comme app web » activé si proposé. L'application s'ouvre depuis l'écran d'accueil en mode standalone et nécessite internet. Le [guide iPhone](docs/iphone-pwa.md) détaille l'installation, les tests Safari et les trois vraies icônes à fournir. Aucune icône provisoire ni cache hors ligne des données privées n'est ajouté.

## Installation locale

Utiliser Node.js 22.18 ou plus récent et pnpm.

```sh
pnpm install
```

Copier `.env.example` vers `.env.local` et renseigner uniquement les valeurs publiques du projet Supabase :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Aucune valeur réelle n’est présente dans le dépôt. `.env.local` est ignoré par Git. Ne pas utiliser de clé `service_role` ou `sb_secret_` dans une variable `NEXT_PUBLIC_`.

```sh
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Ouvrir http://localhost:3000. Les variables configurées sur Netlify ne sont pas automatiquement présentes dans le terminal local. En leur absence, le build reste possible et la page de connexion explique la configuration manquante ; aucune ancienne donnée locale n’est affichée dans l’espace commercial.

## Étapes manuelles dans Supabase

### 1. Conserver les fonctionnalités déjà présentes

La table fournie possède les sept champs métier mais ne possède pas de colonnes pour les **notes**, **échéances** et **clients obtenus**. Ces trois informations existent déjà dans ProspectFlow : les omettre ferait perdre des fonctions et des données lors du transfert.

Dans le SQL Editor de Supabase, exécuter le fichier :

`supabase/migrations/20261005_preserve_prospect_details.sql`

Il ajoute uniquement `notes text`, `prochaine_action_date date` et `is_client boolean not null default false`. Il ne recrée aucune table, ne change pas les sept champs métier, ne désactive pas le RLS et ne modifie aucune policy. Le script est transactionnel et peut être exécuté à nouveau grâce à `IF NOT EXISTS`. Il recharge le cache du schéma de la Data API.

Ce script n’est pas exécuté automatiquement par l’application. Tant que ces colonnes manquent, un message explicite invite à l’appliquer ; les écritures ne perdent pas silencieusement les détails.

### 2. Vérifier Auth et les policies existantes

- Dans Authentication, activer le fournisseur Email avec inscription par mot de passe.
- Conserver la confirmation email si elle est souhaitée ; configurer l’envoi des emails dans Supabase pour la production.
- Dans Authentication > URL Configuration, définir **Site URL** sur l’URL HTTPS de l’application Netlify.
- Ajouter dans **Redirect URLs** l’URL exacte `https://votre-domaine/auth/callback` et, pour le développement, `http://localhost:3000/auth/callback`.
- Pour utiliser l’URL locale alternative ou un autre port, ajouter aussi son URL de callback exacte.
- Vérifier que les policies existantes autorisent SELECT et DELETE avec `auth.uid() = user_id`, INSERT avec ce même `WITH CHECK`, et UPDATE avec cette condition dans `USING` et `WITH CHECK`.

Aucune policy n’est créée ou remplacée par cette modification. Les clients utilisent la clé publiable et la session de l’utilisateur ; le RLS reste l’autorité pour l’accès aux lignes.

### 3. Confirmation d’email

Le callback `/auth/callback` échange le code PKCE pour une session. Il fonctionne avec le modèle d’email standard et le callback envoyé lors de l’inscription. Ce flux doit être terminé dans le navigateur ayant démarré l’inscription, car il détient le vérificateur PKCE.

Pour permettre une confirmation ouverte dans un autre navigateur, le endpoint `/auth/confirm` est également fourni. Dans Authentication > Email Templates > Confirm signup, utiliser ce lien :

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmer mon email</a>
```

Ce modèle utilise la Site URL configurée, donc pointe sur l’application de production. Les liens invalides ou expirés reviennent vers la connexion avec un message. Aucune redirection fournie par un paramètre n’est utilisée : la destination après connexion est toujours l’application.

Ces flux suivent la [configuration SSR Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs) et le [guide de confirmation email](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).

## Étapes manuelles dans Netlify

1. Vérifier les deux variables existantes, avec exactement les noms ci-dessus, pour le contexte Production. Elles doivent être disponibles au **build** et aux **Functions**. Si un aperçu de déploiement doit être testé, configurer aussi son contexte avec les mêmes valeurs publiques.
2. Conserver le runtime/adaptateur Next.js de Netlify : l’application utilise désormais du SSR et un proxy, et doit être déployée avec `pnpm build`, sans export statique.
3. Après exécution du script SQL et configuration Auth, déployer la nouvelle version. Toute modification de variable `NEXT_PUBLIC_` nécessite un nouveau build.
4. Tester inscription, confirmation email, connexion, CRUD, import de plus de 1 000 lignes, export, rechargement, connexion sur un autre appareil et déconnexion.
5. Avec deux comptes de test, vérifier que chaque compte voit uniquement ses propres prospects et ne peut pas modifier ni supprimer ceux de l’autre.

Voir la documentation officielle [Next.js sur Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) et [variables d’environnement](https://docs.netlify.com/build/configure-builds/environment-variables/).

## Architecture et fichiers modifiés

### Authentification et routes

- `.env.example` : noms des deux variables, sans clé réelle.
- `package.json`, `pnpm-lock.yaml` : bibliothèques officielles `@supabase/supabase-js` et `@supabase/ssr`.
- `src/lib/supabase/config.ts` : lecture et validation de la configuration publique.
- `src/lib/supabase/client.ts` : client navigateur utilisant les cookies SSR.
- `src/lib/supabase/server.ts` : client créé pour chaque requête serveur, avec `await cookies()`.
- `src/proxy.ts` : vérification du JWT, rafraîchissement des cookies et réponses non mises en cache.
- `src/app/layout.tsx` : structure HTML commune, sans données d’utilisateur globales.
- `src/app/(commercial)/layout.tsx` : vérification serveur de l’utilisateur, provider et sidebar protégés.
- `src/app/(commercial)/page.tsx`, `src/app/(commercial)/prospects/page.tsx`, `src/app/(commercial)/prospects/[id]/page.tsx` : déplacements des trois pages existantes, sans changement des URL.
- `src/app/connexion/page.tsx`, `src/components/auth-form.tsx` : inscription et connexion dans le design existant.
- `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts` : confirmation et établissement de session.

### Données et interface

- `src/types/database.ts` : types des lignes, insertions et mises à jour Supabase.
- `src/lib/prospect-mapping.ts` : conversion entre les noms du modèle existant et les noms SQL.
- `src/lib/prospects-service.ts` : toutes les lectures et mutations, validation, RLS, import et vérification du transfert.
- `src/lib/local-migration.ts` : lecture de la véritable clé locale, empreinte de migration et IDs stables par utilisateur.
- `src/components/prospects-provider.tsx` : état cloud partagé, chargement, erreurs, opérations asynchrones, migration et synchronisation.
- `src/components/prospect-form.tsx`, `delete-prospect-dialog.tsx`, `import-prospects-dialog.tsx` : attente de la confirmation cloud avant de fermer les fenêtres ; actions désactivées pendant l’écriture.
- `src/components/dashboard.tsx`, `prospects-workspace.tsx`, `prospect-detail.tsx` : lecture des données cloud et états de chargement/erreur.
- `src/components/sidebar.tsx`, `page-header.tsx` : compte connecté, déconnexion et indication de sauvegarde cloud.
- `supabase/migrations/20261005_preserve_prospect_details.sql` : les trois colonnes nécessaires pour conserver les fonctions existantes.
- `tests/supabase-service.test.mjs` : tests du vrai SDK avec un transport HTTP simulé, sans compte distant.
- `README.md` : procédure de configuration, architecture et vérifications.

L’ancien `src/lib/prospect-store.ts` est supprimé : il écrivait les prospects dans localStorage. Les anciens helpers de validation/sauvegarde restent pour lire le format historique et conserver les tests existants ; ils ne sont plus utilisés pour les mutations de l’application.

### Mapping

| Modèle TypeScript | Colonne Supabase |
| --- | --- |
| `company` | `entreprise` |
| `sector` | `secteur` |
| `city` | `ville` |
| `email` | `email` |
| `website` | `site_internet` |
| `status` | `statut` |
| `nextAction` | `prochaine_action` |
| `notes` | `notes` |
| `nextActionDate` | `prochaine_action_date` |
| `isClient` | `is_client` |
| `createdAt` | `created_at` |

Le modèle `Prospect` et les cinq statuts restent inchangés : Nouveau, À vérifier, Brouillon prêt, Envoyé, Réponse reçue. Une insertion utilise toujours l’id de l’utilisateur connecté. Une mise à jour ne modifie ni `user_id`, ni `created_at` ; elle renseigne `updated_at`. SELECT/UPDATE/DELETE s’appuient sur le RLS, sans filtre client servant de substitut aux policies.

## Migration des données locales

Après connexion et chargement du cloud, si ce compte ne possède aucun prospect, le provider recherche `prospectflow.prospects.v1`. Il ne prend pas les exemples comme données de migration. Si la sauvegarde est valide et non vide, une proposition explicite apparaît. **Plus tard** permet de continuer sans transférer.

Après confirmation, le service relit le cloud, élimine les doublons, écrit les nouvelles lignes et relit toutes les données pour vérifier les IDs, les champs et les dates transférés. Il conserve notes, échéances, indicateur de client et dates de création. Les IDs historiques, parfois non UUID, sont convertis en UUID stables propres à chaque utilisateur. Une coupure suivie d’une reprise ne réinsère pas le même lot.

Un repère de succès, lié à l’utilisateur et à l’empreinte de la sauvegarde, est enregistré uniquement après vérification. L’original local reste intact, y compris si la sauvegarde contient des doublons ayant d’autres informations. Les fiches cloud existantes ne sont pas écrasées. Aucune suppression automatique de la copie locale n’est réalisée ; elle peut être retirée manuellement après vérification/export du cloud.

En cas d’erreur, le transfert ne se présente pas comme réussi et aucune donnée locale n’est effacée. Les anciennes données ne sont jamais utilisées comme une réponse cloud temporaire. La migration doit être proposée depuis **le même navigateur et la même origine** que l’ancienne version : une sauvegarde de localhost n’est pas disponible sur le domaine Netlify, et inversement. Pour déplacer les données d’une autre origine, exporter le CSV depuis l’ancienne version et l’importer après connexion.

## Import, export et pagination

L’import accepte CSV UTF-8, virgules ou points-virgules, guillemets doublés et notes multilignes. Limites : 2 Mo et 5 000 lignes par fichier. Colonnes obligatoires actuelles : Entreprise, Secteur, Ville. Email, Site internet, Statut et Prochaine action sont facultatives ; les colonnes Échéance, Client et Notes restent prises en charge. Casse et accents des en-têtes sont normalisés, les noms anglais existants sont reconnus, les champs et les cinq statuts sont validés.

La détection de doublons utilise l’email ou l’entreprise + ville, sans distinction de casse et d’accents. Une relecture complète du cloud précède l’écriture. Le lot est envoyé en une requête transactionnelle. Sans contrainte unique métier supplémentaire dans le schéma, deux imports simultanés depuis des appareils différents peuvent encore créer un doublon métier : la validation applicative ne remplace pas une contrainte SQL. Les reprises de la même migration sont protégées par leurs IDs stables.

Supabase limite la taille de ses réponses. Le service lit des tranches de 500 lignes avec un comptage exact jusqu’à avoir récupéré tous les résultats, y compris si le serveur applique une limite inférieure. Cela protège le tableau, les compteurs, l’export et la détection de doublons au-delà de 1 000 prospects. Le tableau affiche ensuite uniquement 50 lignes à la fois, avec ses filtres et sa navigation habituels.

L’export relit Supabase au clic et inclut les dix champs métier. Il échappe guillemets, séparateurs et retours à la ligne, et neutralise les valeurs pouvant être interprétées comme des formules par un tableur. Exemple CSV : `public/exemple-prospects.csv`.

## Vérifications

54 tests : les 28 tests existants (CSV, modèle et service cloud) restent inchangés. Les 26 nouveaux tests couvrent la synchronisation sécurisée, les permissions et transactions PostgreSQL avec PGlite en mémoire, la conservation des champs propres au SaaS, la simulation et le script Apps Script par lots sur 1 201 lignes, dont l'absence de passe d'écriture quand le Sheet est inchangé. Aucun test n'utilise votre base Supabase ou votre Google Sheet.

Le vrai SDK Supabase est utilisé avec un faux transport HTTP dans ces tests. Aucune table ni aucun compte de production n’est modifié. Le lint, le contrôle TypeScript et le build de production doivent être exécutés après chaque modification. Les vérifications du projet Supabase réel, de l’envoi des emails, du RLS réel et du déploiement Netlify restent à effectuer une fois les paramètres et le schéma configurés.

## Petit exercice

Dans `src/lib/prospect-mapping.ts`, repérer comment `company` devient `entreprise`. Modifier le libellé du bouton **Transférer vers mon cloud** dans `src/components/prospects-provider.tsx`, puis vérifier que le transfert reste déclenché uniquement par un clic explicite.