# Installer ProspectFlow sur iPhone

Cette PR prépare le site existant pour une installation depuis Safari, avec une fenêtre standalone, sans barre de navigation Safari. Une connexion internet reste nécessaire. Aucun service worker, cache hors ligne de prospects, changement Supabase, variable d'environnement ni modification Google Sheet n'est ajouté.

## Installation après déploiement

1. Ouvrir **Safari** sur l'iPhone et aller sur [ProspectFlow](https://prospect-floww.netlify.app/).
2. Toucher **Partager**, puis **Sur l'écran d'accueil**. Si l'action n'apparaît pas, regarder les actions supplémentaires ou « Modifier les actions ».
3. Garder le nom **ProspectFlow** et activer **Ouvrir comme app web** si iOS propose cette option, puis toucher **Ajouter**.
4. Ouvrir ProspectFlow depuis sa nouvelle icône et se connecter si nécessaire. La session de Safari et celle de l'app installée peuvent différer ; aucun transfert de cookies n'est forcé.

Voir le [guide officiel Apple](https://support.apple.com/fr-fr/guide/iphone/iphea86e5236/ios). L'installation ne nécessite pas l'App Store. Tant que la PR n'est pas déployée en production, tester son URL HTTPS de prévisualisation Netlify avec un compte de test déjà configuré ; l'installation est attachée à ce domaine.

## Icônes à finaliser

Les vrais fichiers de marque restent à fournir : `public/icons/icon-192.png`, `public/icons/icon-512.png` et `public/icons/apple-touch-icon.png` (180 × 180). Le [guide des icônes](../public/icons/README.md) explique leur activation. Aucune icône temporaire n'est générée ; le manifest ne référence pas d'images absentes. L'installation iPhone fonctionne sans ces images, mais iOS choisit son propre visuel jusqu'à leur ajout.

Après remplacement de l'icône ou d'une ancienne installation, retirer uniquement le raccourci de l'écran d'accueil puis l'ajouter à nouveau pour retrouver les métadonnées à jour. Les prospects cloud restent dans le compte utilisateur.

## Ce qui est configuré

- Manifest Next.js public `/manifest.webmanifest` : nom, identifiant, départ `/`, scope `/`, standalone, orientation `portrait-primary`, français et couleurs `#f8fafc`, assorties au fond actuel.
- Métadonnées de toutes les pages : capacité iOS, titre ProspectFlow, barre d'état iOS `default`, thème clair et viewport `device-width`, échelle initiale 1, `viewport-fit=cover`. Le zoom utilisateur reste disponible. L'orientation est une préférence du manifest ; iOS peut autoriser la rotation.
- Marges `env(safe-area-inset-*)` autour du contenu et des dialogs ; hauteur dynamique, navigation mobile sur deux rangées, en-tête adaptable et champs d'au moins 16 px sur petit écran pour éviter le zoom automatique Safari.
- Aucun intercepteur de navigation ni modification des cookies : `/`, `/prospects`, `/prospects/[id]`, `/connexion` et les routes de confirmation gardent leur fonctionnement. Les liens vers des sites externes peuvent ouvrir Safari.
- Aucun cache PWA, aucun appel supplémentaire à Supabase. L'actualisation existante continue de relire les données. Le tableau conserve son défilement **dans son conteneur** sur petit écran, sans élargir la page et sans supprimer de colonne.

## Vérification sur un vrai iPhone

Les tests automatisés et la vérification du HTML ne remplacent pas Safari iOS. Après déploiement, vérifier avec un compte de test :

1. Installer depuis Safari puis ouvrir l'icône : aucune barre d'adresse/navigation Safari ; la barre d'état iOS reste normale.
2. Se connecter, consulter Dashboard → Prospects → fiche → retour. Fermer et rouvrir l'app, vérifier la session et le bouton d'actualisation. Vérifier aussi la déconnexion.
3. Sur un iPhone avec encoche et barre Home, vérifier les premiers et derniers boutons, puis ouvrir un formulaire et son clavier. Faire défiler le dialog pour atteindre Annuler/Enregistrer ; fermer avec la croix.
4. Vérifier portrait et paysage, recherche, filtres, pagination et aperçu CSV. Le document ne doit pas défiler latéralement ; le tableau peut défiler à l'intérieur de son cadre.
5. Vérifier le lien de confirmation d'un **compte de test** : iOS peut l'ouvrir dans Safari, puis demander une connexion dans l'app installée. La configuration Auth actuelle reste inchangée.
6. En mode avion, constater que le site demande une connexion réseau et ne présente pas une copie hors ligne de données privées.

Netlify utilise le build Next.js actuel. Le manifest est une route statique Next.js et les images définitives seront servies depuis `public/icons/` ; aucune redirection SPA, intégration native ou nouvelle variable n'est nécessaire.

Références : [WebKit, mode standalone](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [WebKit, safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
