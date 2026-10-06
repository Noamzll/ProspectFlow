import type { MetadataRoute } from "next";
import { PWA_ICONS_READY, pwaBackgroundColor, pwaIcons } from "../lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ProspectFlow",
    short_name: "ProspectFlow",
    description: "Votre espace de gestion de prospection commerciale.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: pwaBackgroundColor,
    theme_color: pwaBackgroundColor,
    orientation: "portrait-primary",
    icons: PWA_ICONS_READY ? pwaIcons : [],
  };
}
