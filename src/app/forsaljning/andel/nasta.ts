// Vart bekraftelsen av agarandelen gar efterat: i flodet "Markera som såld"
// till nasta steg i forsaljningsflodet (src/doman/forsaljningsflode.ts) –
// andelen ar sedan 2026-11-13 det sista steget fore underlaget – och fran
// underlaget tillbaka dit. Bara de tva; ett okant varde blir flodets, sa att
// parametern aldrig styr en omdirigering till en godtycklig adress.

export type AndelNasta = "flode" | "export";

export function nastaFran(varde: unknown): AndelNasta {
  return varde === "export" ? "export" : "flode";
}
