// Vart bekraftelsen av agarandelen gar efterat: i flodet "Markera som såld"
// vidare till skickfragorna, fran underlaget tillbaka dit. Bara de tva –
// ett okant varde blir flodets, sa att parametern aldrig styr en omdirigering
// till en godtycklig adress.

export type AndelNasta = "skick" | "export";

export function nastaFran(varde: unknown): AndelNasta {
  return varde === "export" ? "export" : "skick";
}

export const NASTA_SIDA: Record<AndelNasta, string> = {
  skick: "/forsaljning/skick",
  export: "/export",
};
