# Synchronisation Google Sheet → ProspectFlow

Cette intégration est **désactivée par défaut**. Elle ne renvoie aucune modification commerciale vers Google Sheets et ne supprime aucun prospect. Le script écrit seulement les identifiants manquants dans la colonne `Prospect ID` du Sheet.

## Fonctionnement

`syncNow()` lit les sept colonnes et `Prospect ID`, puis envoie des lots de **200 lignes maximum** à `POST /api/sync/google-sheet`. Une relecture toutes les cinq minutes détecte les modifications manuelles, les formules recalculées et les changements faits par API ; elle ne dépend pas de `onEdit`.

Chaque lot est validé et enregistré dans **une transaction PostgreSQL**, grâce à la RPC `sync_google_sheet_prospects`, accessible exclusivement au rôle serveur. Les 1 200 lignes ne forment pas une transaction globale : un incident après plusieurs lots peut laisser les premiers enregistrés. Relancer `syncNow()` reprend sans doublonner, car les IDs sont conservés. Tous les lots sont d'abord simulés avant d'écrire le premier.

La route utilise uniquement le compte et la source configurés sur Netlify ; le JSON ne peut pas choisir un autre propriétaire. Pas de cookies d'authentification utilisateur, de CORS permissif, de clé Supabase dans Apps Script ou de suppression exposée.

`sheet_external_id` correspond à l'UUID de `Prospect ID` et à `prospects.id`. L'index unique `(user_id, sheet_external_id)` est indépendant des policies RLS existantes. Les lignes actuelles gardent cette colonne à `NULL` jusqu'à leur rattachement explicite. Aucun rattachement approximatif automatique par email n'est effectué.

`sheet_payload_hash` mémorise l'empreinte SHA-256 des **sept champs normalisés reçus du Sheet**. Une ligne inchangée ne réécrit pas une édition ultérieure dans ProspectFlow. Quand le Sheet change vraiment, ses sept champs remplacent ceux du prospect. Les notes, échéances, `is_client`, le propriétaire et `created_at` restent toujours inchangés pour un prospect existant. `updated_at` avance seulement lors d'une synchronisation effective.

Les lignes complètement vides sont ignorées. Un email, site ou prochaine action vide devient `NULL`, un statut vide devient `Nouveau`. Entreprise, Secteur et Ville restent obligatoires, comme dans le formulaire et le CSV actuels. Les espaces sont normalisés, l'email passe en minuscules et les sites sans protocole reçoivent `https://`. Seuls les cinq statuts actuels sont acceptés, avec tolérance sur casse et accents.

## 1. SQL à exécuter une seule fois

Copier **l'intégralité** de [`../supabase/migrations/20261005_google_sheet_sync.sql`](../supabase/migrations/20261005_google_sheet_sync.sql) dans Supabase → SQL Editor, puis exécuter.

Le script ajoute deux colonnes nullable, un index unique et une fonction avec droits limités. Il n'actualise aucune ligne métier et ne change aucune policy. Il est réexécutable. Les colonnes `notes`, `prochaine_action_date`, `is_client` de la précédente intégration sont déjà supposées présentes.

Ne pas ajouter de `GRANT EXECUTE` à `anon` ou `authenticated`. Ne pas désactiver RLS. Aucun SQL n'a été exécuté contre votre projet pendant le développement.

## 2. Variables Netlify

Dans Project configuration → Environment variables, ajouter les variables suivantes **côté Functions**, dans le contexte du déploiement concerné. Cocher « Contains secret values » pour les deux secrets. Ne pas leur donner de préfixe `NEXT_PUBLIC_`.

| Variable | Valeur |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Clé **secrète** Supabase `sb_secret_…` depuis Settings → API Keys ; l'ancienne clé JWT `service_role` est également acceptée. Jamais la clé publishable. |
| `GOOGLE_SHEET_SYNC_SECRET` | Secret aléatoire de 64 caractères généré avec votre gestionnaire de mots de passe ; ne le coller ni dans GitHub, ni dans ce chat, ni dans les logs. |
| `GOOGLE_SHEET_SYNC_USER_ID` | UUID de l'utilisateur destinataire dans Supabase → Authentication → Users. Ce n'est ni son email, ni votre ID de compte Supabase administrateur. |
| `GOOGLE_SHEET_SPREADSHEET_ID` | ID du fichier, entre `/d/` et `/edit` dans son URL Google Sheets. |
| `GOOGLE_SHEET_TAB_ID` | Numéro `gid` de l'onglet, par exemple `0` ; conserver `0` comme texte. |
| `GOOGLE_SHEET_SYNC_ENABLED` | `false` pendant les simulations ; `true` uniquement après les essais. |

Les deux variables publiques Supabase existantes restent inchangées. `NEXT_PUBLIC_SUPABASE_URL` doit également être disponible pour la fonction Netlify. Redéployer après configuration. Aucun service externe n'est appelé au build ; une configuration manquante donne un HTTP 503 uniquement sur l'API de synchronisation.

**Une configuration = un compte et un onglet.** Pour changer de fichier, repartir d'une configuration explicitement vérifiée ; ne pas recopier arbitrairement les IDs d'un autre compte.

## 3. Installer Apps Script

1. Créer un **projet Apps Script autonome** sur [script.google.com](https://script.google.com/). Limiter ses éditeurs à vous-même : les éditeurs du projet peuvent accéder aux propriétés et au secret. Le script autonome évite de donner ce secret à tous les éditeurs du Sheet.
2. Remplacer le contenu de `Code.gs` par **l'intégralité** de [`Code.gs`](Code.gs).
3. Dans Paramètres du projet, activer l'affichage de `appsscript.json` et y mettre le contenu de [`appsscript.json`](appsscript.json). Le moteur V8 est requis.
4. Dans Propriétés du script, ajouter :

| Propriété | Valeur |
| --- | --- |
| `PROSPECTFLOW_SYNC_URL` | `https://prospect-floww.netlify.app/api/sync/google-sheet` ou l'URL du déploiement de test, sans slash final. |
| `GOOGLE_SHEET_SYNC_SECRET` | Exactement le même secret que celui du contexte Netlify utilisé. |
| `GOOGLE_SHEET_SPREADSHEET_ID` | Exactement le même ID de fichier que sur Netlify. |
| `GOOGLE_SHEET_TAB_ID` | Exactement le même `gid` que sur Netlify. |
| `DRY_RUN` | `true` pour la simulation, `false` pour autoriser les envois d'écriture. Absente, cette propriété vaut `true`. |

5. Dans l'onglet, garder les en-têtes sur la **ligne 1** : `Entreprise`, `Secteur`, `Ville`, `Email`, `Site internet`, `Statut`, `Prochaine action` ; ajouter une colonne `Prospect ID`. L'ordre est libre, les noms doivent être uniques et correspondre à ces libellés. Les autres colonnes sont ignorées et conservées.
6. Sélectionner `syncNow` dans l'éditeur puis cliquer Exécuter. Autoriser l'accès Google demandé avec votre compte ayant accès au Sheet. **Ne pas déployer le projet Apps Script comme web app** : ce n'est pas nécessaire.

Une simulation n'écrit **rien dans Supabase**, mais peut remplir les IDs manquants dans le Sheet. Faire ces essais sur une copie. Les ID doivent rester des valeurs stables : ne pas les recalculer avec une formule, ne pas les effacer lors d'une mise à jour API, et déplacer **la ligne complète, ID compris** lors d'un tri. Ne pas trier les sept colonnes séparément de `Prospect ID`. Éviter de modifier/trier le Sheet pendant la première attribution des ID ; le script détecte un changement intervenu entre ses lectures, mais ne verrouille pas les utilisateurs humains.

## 4. Tester sans toucher aux 1 200+ prospects

1. Garder la PR non fusionnée pendant ces essais. Préférer un **projet Supabase de test** et un déploiement Netlify de la branche `codex/google-sheet-sync`. Appliquer les migrations au projet de test.
2. Sinon, utiliser un **nouveau compte utilisateur de test**, une copie du Sheet avec seulement trois entreprises fictives `.example`, et un déploiement de branche Netlify configuré **uniquement pour ce compte de test**. Ne pas modifier les variables du contexte Production. Vérifier l'UUID dans Authentication → Users avant tout essai d'écriture.
3. Laisser `GOOGLE_SHEET_SYNC_ENABLED=false` côté Netlify et `DRY_RUN=true` côté script. Exécuter `syncNow()` : le résultat indique `created: 3`, `dryRun: true`, mais aucun prospect n'est créé dans Supabase.
4. Passer la variable Netlify du **contexte de test** à `true`, redéployer, puis passer `DRY_RUN=false` dans ce script de test. Exécuter `syncNow()` : trois prospects doivent apparaître dans le compte de test, lors du prochain chargement ou après « Actualiser les données ».
5. Modifier l'entreprise ou le statut d'une ligne du Sheet, relancer : toujours trois prospects, dont un modifié. Relancer encore : `unchanged: 3`.
6. Ajouter notes, échéance et client à un prospect dans ProspectFlow, modifier le Sheet puis relancer : ces trois informations restent conservées.
7. Modifier le statut dans ProspectFlow sans toucher au Sheet, relancer : le statut du SaaS reste. Puis modifier réellement une ligne du Sheet : ses sept champs reprennent la priorité pour ce prospect.
8. Déplacer une ligne entière, ID compris, puis relancer : pas de doublon. Modifier ensuite une ligne via votre API Google Sheets : le prochain `syncNow()` ou passage périodique retrouve ce changement.
9. Retirer une ligne du Sheet : le prospect reste dans Supabase. Si vous le supprimez manuellement du SaaS alors que sa ligne existe encore, une synchronisation le recréera ; pour une suppression durable, retirer la ligne du Sheet puis supprimer le prospect manuellement.
10. Sur ce déploiement de test, envoyer un mauvais secret : HTTP 401. Un statut `Client` est refusé avec HTTP 422. Aucun de ces appels ne modifie les données.

Les tests automatisés (`pnpm test`) utilisent un PostgreSQL PGlite **en mémoire** et un faux transport HTTP du véritable SDK Supabase. Ils n'utilisent jamais vos variables de production, votre Sheet ou vos prospects.

## 5. Rattacher les prospects déjà présents avant la production

**Ne pas activer la synchronisation en laissant tous les ID des 1 200 prospects existants vides.** Le script créerait de nouveaux UUID ; la route refusera les entreprises/emails déjà présents avec `identity_conflict_link_existing_id` pour éviter des doublons. Aucun rattachement arbitraire n'est effectué.

Exporter en CSV le résultat de cette requête **en lecture seule** depuis Supabase → SQL Editor, après avoir remplacé `UUID_UTILISATEUR` par l'UUID du compte de production :

```sql
select id::text as "Prospect ID", entreprise as "Entreprise", secteur as "Secteur",
       ville as "Ville", email as "Email", site_internet as "Site internet",
       statut as "Statut", prochaine_action as "Prochaine action"
from public.prospects
where user_id = 'UUID_UTILISATEUR'::uuid
order by entreprise, ville;
```

Cette requête ne modifie pas la base. Garder cet export et votre export CSV habituel comme sauvegardes.

Dans une copie du Sheet, reporter chaque **ID existant** sur la bonne entreprise, en vérifiant email ou entreprise + ville. Ne pas copier simplement toute la colonne d'IDs selon le numéro de ligne : les ordres peuvent différer. En cas de doublon ambigu, faire le rattachement manuellement après vérification. On peut aussi partir d'un onglet créé à partir de cet export (qui contient déjà les IDs) et y reporter les modifications du Sheet.

Pour une entreprise réellement nouvelle, laisser `Prospect ID` vide : le script la remplit une seule fois. Lorsqu'une ligne a déjà un UUID généré mais correspond à un ancien prospect, remplacer ce nouvel UUID par **l'ID existant** avant de réessayer. Ne jamais utiliser l'ID d'un autre compte.

## 6. Activer la production

1. Après revue, fusionner la PR. Exécuter la migration SQL additive dans le projet de production et configurer ses variables Netlify avec `GOOGLE_SHEET_SYNC_ENABLED=false`.
2. Vérifier le compte, le fichier, l'onglet et tous les rattachements d'IDs. Garder `DRY_RUN=true` dans le script de production et lancer `syncNow()`.
3. Vérifier les compteurs. Toute erreur arrête l'opération ; aucun lot d'écriture n'est envoyé tant qu'un lot de simulation échoue.
4. Passer `GOOGLE_SHEET_SYNC_ENABLED=true` en production, redéployer, puis passer `DRY_RUN=false` dans le script. Lancer `syncNow()` manuellement et vérifier le résultat dans ProspectFlow via actualisation.
5. Lancer `installSyncTrigger()` une fois : un déclencheur temporel exécute `syncNow()` **toutes les cinq minutes**. Ce délai est approximatif, dépend des quotas Google et n'est pas du temps réel.

Ne créer le déclencheur qu'après un envoi manuel réussi. Il s'exécute avec le compte Google qui l'a installé ; ce compte doit garder son accès au Sheet. Consulter Apps Script → Exécutions en cas d'échec. Pour arrêter : lancer `removeSyncTriggers()` et remettre `GOOGLE_SHEET_SYNC_ENABLED=false`. Pour tourner le secret, remplacer sa valeur dans Netlify et dans les propriétés du script, puis redéployer ; aucun changement de code requis.

## Diagnostic

| Erreur | Action |
| --- | --- |
| `401 unauthorized` | Vérifier que les deux secrets correspondent, sans les journaliser. |
| `403 source_not_allowed` | Vérifier le fichier et le `gid` dans les deux configurations. |
| `409 writes_disabled` | Conserver la simulation ou activer explicitement les écritures dans le bon contexte Netlify. |
| `409 identity_conflict_link_existing_id` | Vérifier les `Prospect ID` du lot et rattacher l'entreprise à son ID existant ; jamais celui d'un autre compte. |
| `422 invalid_status` / `invalid_row` | Corriger la ligne du lot indiquée. Les champs autorisés sont les sept colonnes ; notes/client/échéance ne sont pas envoyés. |
| `503 migration_required` | Exécuter la migration dans le projet Supabase utilisé par ce déploiement. |
| `503 sync_not_configured` / `server_database_not_configured` | Vérifier les variables Functions de ce contexte et redéployer. |
| `502 database_sync_failed` / `sync_failed` | Vérifier la configuration serveur et réessayer ; aucune erreur SQL brute ni donnée n'est renvoyée. |

Maximum 5 000 lignes par onglet, 200 par requête et 512 Kio par corps JSON. Les erreurs réseau/429/5xx sont réessayées trois fois avec délai croissant. Les exécutions du même projet Apps Script sont verrouillées ; la RPC sérialise les requêtes d'un même compte. Plusieurs projets Apps Script envoyant des versions divergentes d'un même Sheet restent à éviter : utiliser un seul déclencheur de référence.

Références : [déclencheurs Google et modifications par API](https://developers.google.com/apps-script/guides/triggers/installable), [clé secrète Supabase et RLS](https://supabase.com/docs/guides/getting-started/api-keys), [transactions et ON CONFLICT PostgreSQL](https://www.postgresql.org/docs/current/sql-insert.html).
