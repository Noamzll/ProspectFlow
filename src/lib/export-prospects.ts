import type { Prospect } from "@/types/prospect";

export function exportProspectsCsv(prospects: Prospect[]) {
  // Encadrer chaque cellule gère les virgules, guillemets et sauts de ligne.
  // Neutraliser les formules évite qu'un tableur exécute une valeur saisie.
  const cell = (value: string) => {
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [
    ["Entreprise", "Secteur", "Ville", "Email", "Site internet", "Statut", "Prochaine action", "Échéance", "Client", "Notes"],
    ...prospects.map((p) => [p.company, p.sector, p.city, p.email, p.website, p.status, p.nextAction, p.nextActionDate ?? "", p.isClient ? "Oui" : "Non", p.notes ?? ""]),
  ];
  return `\uFEFF${rows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}

export function downloadProspects(prospects: Prospect[]) {
  const blob = new Blob([exportProspectsCsv(prospects)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "prospectflow-prospects.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
