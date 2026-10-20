// Huvudblanketten som exportens tva tal skrivs av till (produktspec 4.9): K5
// for fastighet, K6 for bostadsratt. SKV 2197 ar samma hjalpblankett for bada.
// Exportvyn och bilagepaketets PDF hamtar texterna harifran, sa att namnet inte
// kan skilja sig mellan stallena.

import type { K6aExport } from "./export-k6a";
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

export interface RutaForLasaren {
  /** "Förs till K5, ruta 4", eller null nar talet inte ar lasarens eget. */
  etikett: string | null;
  /** Oren. */
  belopp: number;
}

/**
 * Vad exportvyns tva rutor visar. Etiketten "Förs till K5, ruta x" ar en
 * instruktion och far bara sta bredvid ett tal som ar lasarens eget (CLAUDE.md,
 * "Agarandel"). Ar andelen kand ar det den individuella summan; ar den null –
 * medlemmarnas andelar gar inte ihop – visas hela bostadens summa utan
 * etiketten.
 */
export function rutorForLasaren(
  ex: K6aExport,
  upplatelseform: Upplatelseform,
  andel: number | null,
): { ruta4: RutaForLasaren; ruta5: RutaForLasaren } {
  const texter = blankettTexter(upplatelseform);
  const kand = andel !== null;
  return {
    ruta4: {
      etikett: kand ? texter.ruta4 : null,
      belopp: kand ? ex.ruta4_individuellt : ex.ruta4_brutto,
    },
    ruta5: {
      etikett: kand ? texter.ruta5 : null,
      belopp: kand ? ex.ruta5_individuellt : ex.ruta5_brutto,
    },
  };
}
