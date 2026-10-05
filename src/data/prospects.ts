import type { Prospect } from "@/types/prospect";

// Entreprises et coordonnées fictives. Les domaines .example sont réservés aux exemples.
export const prospects: Prospect[] = [
  { id: "p1", company: "Atelier Forma", sector: "Architecture", city: "Lyon", email: "bonjour@forma.example", website: "https://forma.example", status: "Nouveau", nextAction: "Identifier le bon interlocuteur", createdAt: "2026-10-05T09:00:00Z", isClient: false },
  { id: "p2", company: "Maison Bloom", sector: "E-commerce", city: "Paris", email: "contact@bloom.example", website: "https://bloom.example", status: "À vérifier", nextAction: "Vérifier les coordonnées", createdAt: "2026-10-04T14:00:00Z", isClient: false },
  { id: "p3", company: "Studio Norden", sector: "Design", city: "Bordeaux", email: "hello@norden.example", website: "https://norden.example", status: "Brouillon prêt", nextAction: "Relire le premier email", createdAt: "2026-10-03T10:00:00Z", isClient: false },
  { id: "p4", company: "Clair Conseil", sector: "Conseil", city: "Nantes", email: "contact@clair.example", website: "https://clair.example", status: "Envoyé", nextAction: "Préparer une relance", createdAt: "2026-10-02T08:00:00Z", isClient: false },
  { id: "p5", company: "Nova Énergie", sector: "Énergie", city: "Lille", email: "bonjour@nova.example", website: "https://nova.example", status: "Réponse reçue", nextAction: "Proposer un rendez-vous", createdAt: "2026-10-01T12:00:00Z", isClient: false },
  { id: "p6", company: "Collectif Alto", sector: "Communication", city: "Toulouse", email: "hello@alto.example", website: "https://alto.example", status: "Réponse reçue", nextAction: "Démarrer la mission", createdAt: "2026-09-30T09:00:00Z", isClient: true },
  { id: "p7", company: "Luma Tech", sector: "Logiciel", city: "Paris", email: "contact@luma.example", website: "https://luma.example", status: "Brouillon prêt", nextAction: "Personnaliser l’objet du mail", createdAt: "2026-09-29T16:00:00Z", isClient: false },
  { id: "p8", company: "Les Jardins Urbains", sector: "Paysagisme", city: "Rennes", email: "bonjour@jardins.example", website: "https://jardins.example", status: "Nouveau", nextAction: "Consulter le site internet", createdAt: "2026-09-28T11:00:00Z", isClient: false },
];

export function getDashboardStats(items: Prospect[]) {
  return {
    total: items.length,
    // À contacter = prospects dont le premier email reste à envoyer.
    toContact: items.filter((p) => !p.isClient && ["Nouveau", "À vérifier", "Brouillon prêt"].includes(p.status)).length,
    drafts: items.filter((p) => !p.isClient && p.status === "Brouillon prêt").length,
    contacted: items.filter((p) => ["Envoyé", "Réponse reçue"].includes(p.status) || p.isClient).length,
    replies: items.filter((p) => p.status === "Réponse reçue").length,
    clients: items.filter((p) => p.isClient).length,
  };
}
