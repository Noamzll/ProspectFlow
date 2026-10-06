import type { MetadataRoute } from "next";

// Les trois icônes PNG de ProspectFlow sont présentes dans public/icons/.
export const PWA_ICONS_READY = true;

export const pwaIcons: MetadataRoute.Manifest["icons"] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
];

export const appleTouchIcon = { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" };
export const pwaBackgroundColor = "#f8fafc";
