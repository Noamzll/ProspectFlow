# ProspectFlow

Mini SaaS pédagogique de prospection commerciale construit avec Next.js, TypeScript et Tailwind CSS. Cette version complète fonctionne localement dans le navigateur.

## Fonctionnalités

- Dashboard avec six indicateurs calculés et les cinq derniers prospects.
- Tableau : entreprise, secteur, ville, email, site, statut et prochaine action, avec boutons de modification et de suppression.
- Recherche sans distinction d’accents ou de majuscules, dans les sept colonnes et les notes.
- Filtres combinables de statut, secteur, ville et relation prospect/client.
- Tri croissant et décroissant sur chaque colonne ; les statuts suivent le parcours commercial.
- Pagination de 50 lignes par défaut (10 et 25 disponibles), navigation en haut et en bas du tableau, choix direct de page et compteur des lignes affichées.
- Ajout et modification avec validation des champs.
- Suppression après confirmation et possibilité d’annuler avant de confirmer.
- Fiche individuelle, notes, échéance de prochaine action et suivi des clients obtenus.
- Sauvegarde locale, mise à jour du dashboard et synchronisation entre onglets.
- Export de tous les prospects en CSV compatible avec les tableurs.
- Import CSV avec sélection de fichier ou collage, aperçu, validation des lignes et détection des doublons.
- Interface responsive, navigation clavier, fenêtres modales natives, pages d’erreur et cas sans résultat.

## Démarrer

Utiliser Node.js 22.18 ou une version plus récente (Node.js 24 recommandé), avec pnpm installé.

```sh
pnpm install
pnpm dev
```

Ouvrir http://localhost:3000. Arrêter le serveur avec Ctrl+C.

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Dans un environnement où pnpm n’est pas accessible mais où les dépendances sont déjà installées :

```sh
node node_modules/next/dist/bin/next dev
node --experimental-strip-types --test tests/prospect-core.test.mjs
```

## Architecture

Les routes restent de petits composants Next.js ; les interactions vivent dans les composants React. Un état partagé fournit la même liste au tableau, aux fiches et au dashboard.

```text
src/
  app/
    layout.tsx                 Structure commune et provider
    page.tsx                   Route du dashboard
    prospects/page.tsx         Route du tableau
    prospects/[id]/page.tsx    Route d’une fiche
    not-found.tsx              Page 404
    error.tsx                  Erreur de rendu
    globals.css                Tailwind et styles communs
  components/
    dashboard.tsx              Indicateurs et derniers prospects
    prospects-workspace.tsx    Actions d’ajout et d’export
    prospects-table.tsx        Recherche, filtres, tri et pagination
    prospects-pagination.tsx   Navigation partagée en haut et en bas du tableau
    prospect-detail.tsx        Coordonnées, notes et prochaine action
    prospect-form.tsx          Formulaire commun d’ajout et d’édition
    delete-prospect-dialog.tsx Confirmation de suppression
    import-prospects-dialog.tsx Fenêtre d’import et aperçu CSV
    modal.tsx                  Fenêtre native et focus clavier
    prospects-provider.tsx    Contexte React partagé
    sidebar.tsx                Navigation
    page-header.tsx            En-tête commun
    stat-card.tsx              Carte d’indicateur
    status-badge.tsx           Badge de statut
  lib/
    prospect-store.ts          Lecture, écriture et notifications
    prospect-validation.ts    Validation des formulaires et sauvegardes
    export-prospects.ts        Génération et téléchargement du CSV
    import-prospects.ts        Lecture CSV, validation et doublons
  data/prospects.ts            Huit exemples et calcul des indicateurs
  types/prospect.ts            Modèle TypeScript
tests/prospect-core.test.mjs   Tests de logique et de sauvegarde
tests/csv-import.test.mjs      Tests de l’import CSV
public/exemple-prospects.csv   Exemple à personnaliser
```

### Comment les changements circulent

1. Le formulaire lit ses champs avec `FormData` et les valide.
2. Le store relit la sauvegarde courante et calcule la nouvelle liste sans modifier l’ancienne.
3. Il écrit dans `localStorage`. Il confirme l’opération uniquement si l’écriture réussit.
4. `useSyncExternalStore` informe React du changement. Le provider partage la nouvelle liste à toutes les pages.
5. Le dashboard recalcule ses valeurs ; le tableau recalcule ses filtres et sa pagination.

Les composants utilisant `useState`, des événements ou le contexte partagé portent `"use client"`. `filter()` crée une nouvelle liste et `sort()` trie cette copie. Les options uniques sont obtenues avec `Set`. `aria-sort` décrit le tri aux lecteurs d’écran. Le dialogue natif bloque le focus dans la fenêtre ; Échap ferme celle-ci et le focus revient au bouton d’origine.

## Données et sauvegarde

Au premier démarrage, les huit exemples de `src/data/prospects.ts` sont affichés. Les domaines `.example` servent uniquement à la démonstration. L’ajout, l’édition ou la suppression enregistrent la liste dans la clé `prospectflow.prospects.v1` de `localStorage`.

Une fois une liste enregistrée, modifier le fichier d’exemples ne remplace plus les données sauvegardées. Une liste vide sauvegardée reste vide après rechargement. Les valeurs lues sont validées ; une sauvegarde invalide reste intacte et un message explique l’échec. Les échecs de stockage ne sont pas présentés comme des enregistrements réussis.

Les données appartiennent à ce navigateur et à cette origine (adresse et port). Elles restent après un rechargement ; elles ne sont pas partagées entre appareils. Effacer les données du site supprime cette sauvegarde. L’export CSV peut être réimporté pour ajouter les prospects absents ; il n’écrase pas les fiches existantes. Les filtres et le tri sont temporaires et reviennent à leur état initial après rechargement.

Les onglets de la même origine se synchronisent via l’événement `storage`. Le store relit les données avant chaque modification. En cas de modifications simultanées du même prospect, la dernière écriture gagne : cette version n’a pas de gestion de conflits multi-utilisateur.

Cette version fonctionne sans connexion de compte, envoi d’email, serveur de données, facturation ni déploiement. Les statuts de contact décrivent le suivi saisi manuellement. Une vraie base de données et une authentification pourront remplacer la couche de stockage dans une étape ultérieure.

## Modèle et indicateurs

Statuts : Nouveau, À vérifier, Brouillon prêt, Envoyé, Réponse reçue.

`isClient` suit la conversion en client sans ajouter un sixième statut. `notes` et `nextActionDate` sont facultatifs. Les dates d’action sont au format `YYYY-MM-DD` et affichées sans décalage de fuseau ; la date de création est un horodatage ISO affiché à l’heure de Paris.

- Total : toutes les entrées, clients inclus.
- À contacter : non-clients Nouveau, À vérifier ou Brouillon prêt.
- Brouillons prêts : non-clients Brouillon prêt.
- Contactés : Envoyé, Réponse reçue ou client obtenu.
- Réponses : statut Réponse reçue.
- Clients : `isClient` à `true`.

Les compteurs se recoupent. Avec les exemples : **8 / 5 / 2 / 3 / 2 / 1**.

## Vérifications

Les tests vérifient les compteurs, les dates impossibles, les coordonnées facultatives, les protocoles de liens, les sauvegardes corrompues et dupliquées, les listes vides, les erreurs d’écriture et l’échappement du CSV. Le CSV inclut les dix champs métier et neutralise les valeurs qui pourraient être interprétées comme des formules par un tableur.

Le parcours navigateur a été vérifié : création, erreurs de formulaire, édition, fiche individuelle, rechargement, compteurs synchronisés, annulation et confirmation de suppression, recherche dans les notes, filtre clients, pagination et synchronisation entre onglets. Les prospects temporaires de vérification ont été retirés.

La génération du CSV est testée. Le navigateur intégré n’a pas fourni de confirmation de téléchargement lors du contrôle automatisé ; la réception du fichier reste à vérifier dans un navigateur classique.

## Petit exercice

### Importer un CSV

1. Dans la page Prospects, cliquer sur **Importer CSV**.
2. Choisir un fichier `.csv`, ou ouvrir **Ou coller le contenu CSV**, coller le texte et cliquer sur **Prévisualiser le CSV collé**.
3. Lire l’aperçu et les détails des lignes invalides et des doublons.
4. Cliquer sur **Importer N prospects valides** pour enregistrer les nouvelles fiches.

Le traitement reste dans le navigateur : le fichier n’est pas envoyé à un service externe. Formats acceptés : CSV UTF-8, virgules ou points-virgules, guillemets doublés, notes sur plusieurs lignes. Taille maximale : 2 Mo, 5 000 lignes de prospects. Les lignes entièrement vides sont ignorées.

Colonnes obligatoires : **Entreprise**, **Secteur**, **Ville**. Colonnes facultatives : **Email**, **Site internet**, **Statut**, **Prochaine action**, **Échéance**, **Client**, **Notes**. Leur ordre est libre. Les noms anglais du modèle sont aussi reconnus. Les colonnes inconnues sont signalées puis ignorées ; deux en-têtes correspondant au même champ sont refusés.

Le statut absent devient Nouveau. La casse et les accents des statuts sont ignorés. Une adresse de site sans protocole reçoit `https://`. L’échéance accepte `YYYY-MM-DD` ou `JJ/MM/AAAA`. Le champ Client accepte Oui/Non, true/false, yes/no ou 1/0 ; vide signifie Non.

Les doublons sont reconnus par le même email, ou la même entreprise et la même ville, sans distinction de casse ou d’accents. Cela s’applique aux prospects déjà sauvegardés et aux répétitions dans le fichier. Les fiches existantes ne sont pas modifiées. Le store relit la sauvegarde au moment de valider et vérifie à nouveau les doublons, pour tenir compte d’un autre onglet. Tout le lot est écrit en une seule opération ; un échec de stockage conserve les anciennes données.

Une erreur de structure CSV bloque l’aperçu. Une erreur dans une ligne (ville absente, email invalide, etc.) exclut cette ligne et affiche son numéro. Les lignes valides restent importables après confirmation explicite. Une réimportation du même fichier n’ajoute pas de doublons. Les apostrophes de protection des formules dans un export restent du texte lors de l’import.

Exemple : `public/exemple-prospects.csv`, également accessible via le lien de téléchargement dans la fenêtre. Il contient trois entreprises fictives à personnaliser.

Les 18 tests couvrent notamment la compatibilité export/import, les notes multilignes, les guillemets, les formats de date, les erreurs, les limites et les doublons. Le parcours par collage a été vérifié dans le navigateur avec rechargement, conservation des notes et de l’échéance et réimportation. Le sélecteur de fichier du navigateur intégré n’a pas pu être piloté par le test automatisé ; la sélection manuelle d’un fichier reste à vérifier.

**Exercice CSV :** change le nom et la ville d’une entreprise dans `public/exemple-prospects.csv`, puis importe le fichier. Réimporte-le et observe les doublons détectés.

### Pagination

Le tableau affiche 50 prospects par page par défaut. Les commandes au-dessus et au-dessous du tableau permettent d’avancer, de reculer, d’aller à la première ou à la dernière page et de choisir directement un numéro de page. Le compteur indique la plage affichée parmi les résultats, par exemple **51–100 sur 1 201**. Une recherche, un filtre ou un tri revient à la première page ; changer de page conserve ces critères. Après une suppression, la page reste dans les limites des résultats disponibles.

Dans `src/components/prospects-pagination.tsx`, ajoute **5** aux choix de taille de page, actuellement `[10, 25, 50]`. Vérifie ensuite les deux pages avec les huit exemples et le comportement du bouton Suivant. Les valeurs de taille sont numériques et le nombre de pages dépend de `Math.ceil(nombreDeRésultats / pageSize)`.
