// Huvudblanketten som exportens tva tal skrivs av till (produktspec 4.9): K5
// for fastighet, K6 for bostadsratt. SKV 2197 ar samma hjalpblankett for bada.
// Exportvyn och bilagepaketets PDF hamtar texterna harifran, sa att namnet inte
// kan skilja sig mellan stallena.

import { avrundaUppatTillKronor } from "./berakningar";
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
  /** Oren. Hela kronor nar etiketten finns. */
  belopp: number;
  /** Sant nar talet avrundats och darfor skiljer sig fran raderna ovan. */
  avrundat: boolean;
}

/** Raden under ett avrundat Förs till-tal: varfor det inte ar summan av raderna. */
export const AVRUNDAT_TILL_HELA_KRONOR =
  "Avrundat uppåt till hela kronor – blanketten tar inte ören. Raderna ovan är exakta, så summan av dem kan sluta några ören lägre.";

/**
 * Vad exportvyns tva rutor visar. Etiketten "Förs till K5, ruta x" ar en
 * instruktion och far bara sta bredvid ett tal som ar lasarens eget (CLAUDE.md,
 * "Agarandel"). Talet ar alltid den individuella summan – den ar hela
 * bostadens nar underlaget inte multiplicerats.
 *
 * `andelarnaGarIhop` falskt – medlemmarnas angivna andelar ar over 100 % –
 * ger hela bostadens summa utan etiketten. En andel som bara inte ar angiven
 * ar ett annat lage: talet ar hela bostadens men etiketten och avrundningen
 * star kvar (CLAUDE.md, "Andelen ar null tills den besvarats").
 *
 * Talet bredvid etiketten ar det enda som skrivs av, och blanketten tar hela
 * krontal: det avrundas uppat, sist av allt och efter agarandelen (CLAUDE.md,
 * "Blanketten tar hela kronor"). Raderna och summan utan etikett behaller sina
 * oren – de ar dokumentation och ska stamma exakt mot berakningen.
 */
export function rutorForLasaren(
  ex: K6aExport,
  upplatelseform: Upplatelseform,
  andelarnaGarIhop: boolean,
): { ruta4: RutaForLasaren; ruta5: RutaForLasaren } {
  const texter = blankettTexter(upplatelseform);
  const ruta = (etikett: string, individuellt: number, brutto: number): RutaForLasaren => {
    if (!andelarnaGarIhop) return { etikett: null, belopp: brutto, avrundat: false };
    const belopp = avrundaUppatTillKronor(individuellt);
    return { etikett, belopp, avrundat: belopp !== individuellt };
  };
  return {
    ruta4: ruta(texter.ruta4, ex.ruta4_individuellt, ex.ruta4_brutto),
    ruta5: ruta(texter.ruta5, ex.ruta5_individuellt, ex.ruta5_brutto),
  };
}
