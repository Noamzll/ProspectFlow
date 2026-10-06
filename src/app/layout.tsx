import type { Metadata, Viewport } from "next";
import { appleTouchIcon, PWA_ICONS_READY, pwaBackgroundColor } from "@/lib/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProspectFlow — Dashboard",
  description: "Votre espace de gestion de prospection commerciale.",
  applicationName: "ProspectFlow",
  appleWebApp: {
    capable: true,
    title: "ProspectFlow",
    statusBarStyle: "default",
  },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: PWA_ICONS_READY ? { apple: [appleTouchIcon] } : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: pwaBackgroundColor,
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Aller au contenu</a>
        {children}
      </body>
    </html>
  );
}
