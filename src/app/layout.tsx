import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { ProspectsProvider } from "@/components/prospects-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProspectFlow — Dashboard",
  description: "Votre espace de gestion de prospection commerciale.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Aller au contenu</a>
        <ProspectsProvider>
          <Sidebar />
          <div className="lg:ml-60">{children}</div>
        </ProspectsProvider>
      </body>
    </html>
  );
}
