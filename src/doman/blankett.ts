// Huvudblanketten som exportens tva tal skrivs av till (produktspec 4.9): K5
// for fastighet, K6 for bostadsratt. SKV 2197 ar samma hjalpblankett for bada.
// Exportvyn och bilagepaketets PDF hamtar texterna harifran, sa att namnet inte
// kan skilja sig mellan stallena.

import type { Upplatelseform } from "./typer";

export type Blankettnamn = "K5" | "K6";

export function blankettnamn(upplatelseform: Upplatelseform): Blankettnamn {
  return upplatelseform === "fastighet" ? "K5" : "K6";
}

export function blankettTexter(upplatelseform: Upplatelseform) {
  const blankett = blankettnamn(upplatelseform);
  return {
    blankett,
    inledning: `Sammanställningen följer Skatteverkets hjälpblankett SKV 2197 och pekar ut vad som förs till ${blankett}. Den lämnas inte in – spara den.`,
    ruta4: `Förs till ${blankett}, ruta 4`,
    ruta5: `Förs till ${blankett}, ruta 5`,
  };
}
