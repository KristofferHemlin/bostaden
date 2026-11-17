// Knapparna for "Vad rörde projektet?", ur tabellen i docs/design.md ("Vad
// projektet rörde"): tva grupper per upplatelseform, med rubrikerna ur
// tabellens huvud. Delas av proven av domanen och av den renderade fragan,
// sa att bada laser tabellen pa samma satt.
//
// Lases nar funktionen anropas, inne i testet – aldrig pa modulniva.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Knapptabell {
  /** Gruppernas rubriker, i tabellens ordning: rum och platser, delar och system. */
  rubriker: [string, string];
  bostadsratt: [string[], string[]];
  /** Det en fastighet har utover en bostadsratt, per grupp. */
  fastighetPlus: [string[], string[]];
}

export function knapptabellen(): Knapptabell {
  const d = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  // Huvudet direkt ovanfor Bostadsrätt-raden – det finns andra tabeller
  // med tom forsta kolumn i filen.
  const huvud = d.match(/^\| \| ([^|]+) \| ([^|]+) \|\n\|---\|---\|---\|\n\| Bostadsrätt \|/m);
  const br = d.match(/^\| Bostadsrätt \| ([^|]+) \| ([^|]+) \|$/m);
  const fa = d.match(/^\| Fastighet \| Alla ovan, plus ([^|]+) \| Alla ovan, plus ([^|]+) \|$/m);
  if (!huvud || !br || !fa) throw new Error("design.md saknar knapptabellen med två grupper");
  const lista = (t: string) => t.trim().split(", ");
  return {
    rubriker: [huvud[1].trim(), huvud[2].trim()],
    bostadsratt: [lista(br[1]), lista(br[2])],
    fastighetPlus: [lista(fa[1]), lista(fa[2])],
  };
}

/** Radens etikett pa projektsidan, ur design.md. */
export function radensEtikett(): string {
  const m = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").match(
    /som raden \*\*"([^"]+)"\*\* bredvid \*Räknas som\*/,
  );
  if (!m) throw new Error("design.md saknar radens etikett");
  return m[1];
}
