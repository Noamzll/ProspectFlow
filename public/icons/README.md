# Icônes définitives à fournir

Aucune image d'icône de marque ProspectFlow n'existe dans le dépôt. Aucune image provisoire ou fichier PNG vide n'est ajouté et aucun lien cassé n'est publié.

Ajouter dans **ce dossier** les trois exports PNG de la même icône définitive :

| Fichier à ajouter | Dimensions exactes | URL publique |
| --- | --- | --- |
| `icon-192.png` | 192 × 192 px | `/icons/icon-192.png` |
| `icon-512.png` | 512 × 512 px | `/icons/icon-512.png` |
| `apple-touch-icon.png` | 180 × 180 px | `/icons/apple-touch-icon.png` |

Pour iOS, utiliser un fond opaque, un logo centré et ne pas dessiner de coins arrondis : iOS les applique. Ne pas déclarer `maskable` sans une version conçue avec sa zone de sécurité.

Une fois **les trois vrais fichiers ajoutés**, passer `PWA_ICONS_READY` à `true` dans [`src/lib/pwa.ts`](../../src/lib/pwa.ts), lancer les validations et redéployer Netlify. Le manifest annoncera les deux icônes PWA et les pages auront le lien `apple-touch-icon` 180 × 180. D'ici là, l'installation Safari reste disponible ; l'image de l'écran d'accueil est choisie par iOS, sans icône de marque fournie par le site.
