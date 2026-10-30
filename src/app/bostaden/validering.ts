// Regler for fragorna fran startsidans kort som bade klienten och servern
// provar – samma regel och samma mening pa bada sidor. Agarandelen provas med
// agarandelFel (src/lib/agarandel.ts).

import { oreFranKronor } from "@/lib/format";

export const KOPESKILLING_SAKNAS = "Fyll i köpeskillingen.";
export const KOPESKILLING_SOM_BELOPP = "Köpeskilling anges som ett belopp, t.ex. 3 250 000.";

/**
 * Kopeskillingen ar obligatorisk i kortets fraga men valfri i registreringen
 * (docs/design.md, "Ägarandelen frågas från startsidan"): kravet galler
 * uppgiften, inte ogonblicket. Faltet sager varfor.
 * Kortet sjalvt ar daremot inte obligatoriskt – ingenting har hindrar nagon
 * fran att lagga in ett kvitto.
 */
export function kopeskillingsfel(text: string): string | null {
  if (text.trim() === "") return KOPESKILLING_SAKNAS;
  const oren = oreFranKronor(text);
  return oren === null || oren <= 0 ? KOPESKILLING_SOM_BELOPP : null;
}
