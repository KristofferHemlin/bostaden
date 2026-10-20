// Återstår: det som lagts in men inte ingar i talen (docs/design.md,
// Exportvyn: "redovisar varje krona som lagts in"). Ett stalle for raderna,
// deras namn och deras skal – exportvyn och PDF:en visar samma sak med samma
// ord. PDF:en saknade avsnittet helt till 2026-10-19, och det dokument som
// sparas i atta ar tego da om det som inte raknats med (produktspec 8: "Ett
// paket med ett tyst hål är värre än ett paket som säger var hålet finns").
//
// Ren modul utan databas, sa att den gar att anvanda i webblasaren dar PDF:en
// byggs.

import type { AterstaendeKvitto, K6aExport } from "@/doman/export-k6a";

export const ATERSTAR_RUBRIK = "Återstår";

export const ATERSTAR_INLEDNING =
  "Det här har du lagt in, men det ingår inte i talen ovan.";

/** Skalet under varje rad – samma ord i exportvyn och i PDF:en. */
export const ATERSTAR_ORSAK: Record<
  AterstaendeKvitto["orsak"] | "vantar_pa_fragor",
  string
> = {
  vantar_pa_fragor: "Väntar på frågor",
  utan_hog: "Hör inte till något projekt än",
  utan_betaldatum: "Saknar betaldatum",
  utan_belopp: "Saknar belopp",
  fore_tilltradet: "Daterat före tillträdet",
};

export interface Aterstarrad {
  /** Stabil nyckel for listor. */
  nyckel: string;
  namn: string;
  orsakKod: keyof typeof ATERSTAR_ORSAK;
  orsak: string;
  ar: number | null;
  /** Oren, eller null for ett utkast – inget belopp finns, och en nolla vore
   *  ett pahittat tal. */
  belopp: number | null;
  /** Kvittot raden galler, eller null for en hog. */
  kostnadId: string | null;
}

/** Ett kvittos namn i listan: anteckningen, annars leverantoren. */
export function kvittonamn(k: {
  anteckning: string | null;
  leverantor: string | null;
}): string {
  return k.anteckning?.trim() || k.leverantor?.trim() || "Kvitto";
}

/**
 * Raderna i Återstår: forst hogar som vantar pa fragor, sedan kvitton utanfor
 * sidorna – i den ordning exportvyn alltid visat dem.
 */
export function aterstarRader(
  ex: Pick<K6aExport, "oklassificerade_hogar" | "aterstaende_kvitton">,
  kvittonamnFor: (kostnadId: string) => string,
  /** Hogens namn. En hog som annu inte fatt ett heter som i fas 1
   *  (projektnamnKarta i src/doman/genomgang.ts) – obligatorisk, sa att ingen
   *  anropare skriver ut det tomma namnet rakt av. */
  hognamnFor: (projektId: string) => string,
): Aterstarrad[] {
  return [
    ...ex.oklassificerade_hogar.map((h) => ({
      // Projektets id, inte namnet: tva namnlosa hogar fran samma ar fick
      // forut samma nyckel ("hog--2025"), och React aterstallde fel rad.
      nyckel: `hog-${h.projekt_id}-${h.ar}`,
      namn: hognamnFor(h.projekt_id),
      orsakKod: "vantar_pa_fragor" as const,
      orsak: ATERSTAR_ORSAK.vantar_pa_fragor,
      ar: h.ar,
      belopp: h.belopp_brutto,
      kostnadId: null,
    })),
    ...ex.aterstaende_kvitton.map((k) => ({
      nyckel: `kvitto-${k.kostnad_id}`,
      namn: kvittonamnFor(k.kostnad_id),
      orsakKod: k.orsak,
      orsak: ATERSTAR_ORSAK[k.orsak],
      ar: k.ar,
      belopp: k.belopp_brutto,
      kostnadId: k.kostnad_id,
    })),
  ];
}

/** Raden pa PDF:ens forsattssida som pekar till Återstår – PDF:en har inte
 *  exportvyns dampade summor, sa signalen att talen ar ofullstandiga maste
 *  sta i ord, forst i dokumentet. */
export const ATERSTAR_HANVISNING =
  "Det finns kostnader som inte ingår i talen. De står under Återstår, efter sammanställningen.";
