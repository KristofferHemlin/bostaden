// Bilageforteckningen och bilagepaketets radurval (docs/produktspec.md
// avsnitt 8, "Bilagepaketet som PDF"; docs/k6a-faltlista.md avsnitt 9,
// "Bilage-PDF – ordning"). Ren doman-logik: sjalva PDF-byggandet sker i
// webblasaren (byggordningen steg 13), har avgors bara VILKA bilagor som
// kommer med och i VILKEN ordning.
//
// Bara rader som bidrar med ett belopp storre an noll far bilagor – en rad som
// redovisas med 0 kr star kvar i sammanstallningen men har ingen bevisborda
// (produktspec 8). Arkiverade och privatmarkerade kostnader ar redan uteslutna
// har eftersom byggK6aExport (./export-k6a.ts) aldrig later dem bidra till
// nagon rads kostnad_ider – den har modulen behover darfor inte kanna till
// nagotdera begreppet.
//
// Ordningen ar last i docs/k6a-faltlista.md avsnitt 9:
//   1. Rader i den ordning sammanstallningen redan sorterat dem (sida, ar, atgard).
//   2. Per rad: kostnaderna som bidrog, sorterade pa betaldatum, sedan id.
//   3. Per kostnad: bilagorna i uppladdningsordning (skapad_at) – anroparen
//      levererar redan `bilagaIder` i den ordningen.

import type { K6aExportrad } from "./export-k6a";

export interface BilagepaketKostnad {
  /** "YYYY-MM-DD", eller null – forekommer inte i praktiken (en kostnad utan
   *  betaldatum bidrar aldrig till nagon rad, se export-k6a.ts), men typen
   *  tillater det for sakerhets skull. */
  betaldatum: string | null;
  /** Bilagornas id, redan i uppladdningsordning (skapad_at). */
  bilagaIder: string[];
}

export interface BilagepaketPost {
  /** Lopnummer genom hela dokumentet, 1-baserat – sidhuvudets "Bilaga N". */
  nummer: number;
  bilagaId: string;
  kostnadId: string;
  sida: 1 | 2;
  atgard: string;
  ar: number;
}

type Bilageforteckningsrad = Pick<
  K6aExportrad,
  "sida" | "atgard" | "ar" | "belopp_brutto" | "kostnad_ider"
>;

/**
 * Bygger bilageforteckningen: en post per bilaga, i den ordning de ska ligga i
 * PDF-paketet. `rader` ar sida1 sedan sida2 fran K6aExport, i den ordningen –
 * de ar redan sorterade (sida, ar, atgard) av byggK6aExport. En rad utan
 * bidrag (`belopp_brutto <= 0`) far inga bilagor, och en kostnad som saknas i
 * `kostnader`-kartan (eller helt saknar bilagor) bidrar inte heller.
 */
export function byggBilageforteckning(
  rader: Bilageforteckningsrad[],
  kostnader: Map<string, BilagepaketKostnad>,
): BilagepaketPost[] {
  const poster: BilagepaketPost[] = [];
  let nummer = 0;

  for (const rad of rader) {
    if (rad.belopp_brutto <= 0) continue;

    const kIder = [...rad.kostnad_ider].sort((a, b) => {
      const da = kostnader.get(a)?.betaldatum ?? "";
      const db = kostnader.get(b)?.betaldatum ?? "";
      return da === db ? a.localeCompare(b) : da.localeCompare(db);
    });

    for (const kostnadId of kIder) {
      const k = kostnader.get(kostnadId);
      if (!k) continue;
      for (const bilagaId of k.bilagaIder) {
        nummer += 1;
        poster.push({
          nummer,
          bilagaId,
          kostnadId,
          sida: rad.sida,
          atgard: rad.atgard,
          ar: rad.ar,
        });
      }
    }
  }

  return poster;
}
