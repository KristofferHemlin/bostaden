// Underlaget medan bostadsfragorna ar obesvarade (docs/design.md, Exportvyn,
// "Och sidan väntar på bostadsfrågorna också före försäljningen").
//
// Berakningen kraver nybyggd_vid_forvarv och kastar VantarPaBostadsfragor
// utan det – det ar ratt och star kvar. Svaret avgor om reparationerna
// raknas, och darmed vilka ar som passerar troskeln, sa varken sida 1 eller
// sida 2 har en summa att visa. Men raderna finns oavsett svaret: vilka
// atgarder, vilka ar, och vad de kostade.
//
// Har gissas ingenting. Berakningen kors med bada svaren – nybyggd och inte
// nybyggd – och bara det som ar lika i bada tas med. Det som skiljer sig ar
// precis det som svaret avgor, och det visas inte. Skulle en rad skilja sig i
// sitt belopp far den inget belopp, hellre an ett som bara ar sant for ett av
// svaren.

import { byggK6aExport, type AterstaendeKvitto, type K6aExportrad, type K6aIndata, type OklassificeradHog } from "./export-k6a";

export interface VantandeRad {
  atgard: string;
  ar: number;
  /** Vad atgarden kostade (kolumnen Belopp), eller null om talet beror av
   *  svaret pa bostadsfragorna. */
  belopp: number | null;
}

export interface VantandeUnderlag {
  sald: boolean;
  sida1: VantandeRad[];
  sida2: VantandeRad[];
  /** Det som star i Återstår oavsett svaret. */
  oklassificerade_hogar: OklassificeradHog[];
  aterstaende_kvitton: AterstaendeKvitto[];
  /** Varningar som galler oavsett svaret. */
  varningar: string[];
}

function med(indata: K6aIndata, nybyggd: boolean) {
  return byggK6aExport({
    ...indata,
    // Ombildningen ar inte heller besvarad; utan den ar nybyggd-regeln som
    // strangast, vilket ar det ena ytterlaget. Det andra ar "inte nybyggd".
    bostad: { ...indata.bostad, nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: false },
  });
}

/** Exporterad for testet av skyddsnatet: berakningen kan inte framkalla rader
 *  som skiljer sig, sa det provas med rader byggda for hand. */
export function sammaRader(
  a: Pick<K6aExportrad, "atgard" | "ar" | "kostnad_brutto">[],
  b: Pick<K6aExportrad, "atgard" | "ar" | "kostnad_brutto">[],
): VantandeRad[] {
  // Radernas forekomst beror inte av svaret (src/doman/export-k6a.ts,
  // visarSida1/visarSida2), men skulle de inte motsvara varandra en till en
  // tas inget belopp med alls.
  const parade = a.length === b.length && a.every((r, i) => r.atgard === b[i].atgard && r.ar === b[i].ar);
  return a.map((r, i) => ({
    atgard: r.atgard,
    ar: r.ar,
    belopp: parade && r.kostnad_brutto === b[i].kostnad_brutto ? r.kostnad_brutto : null,
  }));
}

export function vantandeUnderlag(indata: K6aIndata): VantandeUnderlag {
  const nej = med(indata, false);
  const ja = med(indata, true);
  const hogar = new Set(ja.oklassificerade_hogar.map((h) => `${h.projekt_id}:${h.ar}:${h.belopp_brutto}`));
  const kvitton = new Set(ja.aterstaende_kvitton.map((k) => JSON.stringify(k)));
  return {
    sald: nej.sald,
    sida1: sammaRader(nej.sida1.rader, ja.sida1.rader),
    sida2: sammaRader(nej.sida2.rader, ja.sida2.rader),
    oklassificerade_hogar: nej.oklassificerade_hogar.filter((h) =>
      hogar.has(`${h.projekt_id}:${h.ar}:${h.belopp_brutto}`),
    ),
    aterstaende_kvitton: nej.aterstaende_kvitton.filter((k) => kvitton.has(JSON.stringify(k))),
    varningar: nej.varningar.filter((v) => ja.varningar.includes(v)),
  };
}
