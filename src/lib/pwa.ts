import type { MetadataRoute } from "next";

// Activer après avoir ajouté les trois vrais PNG décrits dans public/icons/README.md.
// Aucun lien vers une image manquante ni icône provisoire n'est publié jusque-là.
export const PWA_ICONS_READY = false;

export const pwaIcons: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
];

export const appleTouchIcon = { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" };
export const pwaBackgroundColor = "#f8fafc";
