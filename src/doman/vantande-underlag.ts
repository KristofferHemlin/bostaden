// Underlaget medan bostadsfragorna ar obesvarade (docs/design.md, Exportvyn;
// CLAUDE.md, "Ett okänt svar döljer bara det det ändrar").
//
// Berakningen kraver nybyggd_vid_forvarv och kastar VantarPaBostadsfragor
// utan det – det ar ratt och star kvar. Har gissas ingenting i stallet:
// berakningen kors en gang for varje mojligt svar – nybyggd och inte nybyggd –
// och varje tal som visas ar ett tal som blir lika i bada. Det som skiljer
// sig ar precis det svaret avgor, och dar star strecket (null).
//
// Det galler varje tal pa sidan: radens belopp, dess avdragsgilla del, den
// egna andelens kolumn och de tva summorna. En grundforbattring vars ar
// passerar troskeln oavsett svaret ar sann redan nu och visas; ett ar som bara
// passerar om reparationerna raknas visas inte.

import { rutorForLasaren, type RutaForLasaren } from "./blankett";
import {
  byggK6aExport,
  type AterstaendeKvitto,
  type K6aExport,
  type K6aExportrad,
  type K6aIndata,
  type OklassificeradHog,
} from "./export-k6a";
import type { Upplatelseform } from "./typer";

export interface VantandeRad {
  atgard: string;
  ar: number;
  /** Vad atgarden kostade (kolumnen Belopp). Null nar talet beror av svaret. */
  belopp: number | null;
  /** Kolumnen Avdragsgill del. Null nar talet beror av svaret. */
  avdragsgill: number | null;
  /** Kolumnen Din andel (bara nar underlaget ar gemensamt). Null nar talet
   *  beror av svaret. */
  individuellt: number | null;
  /** Forklaringen under raden, bara nar den ar densamma for bada svaren. */
  forklaring: string | null;
  /** Varningarna under raden som galler for bada svaren. */
  varningar: string[];
}

/** En summa som den visas: det lasaren ser (etikett, tal, avrundning) och
 *  hela bostadens brutto. */
export interface VantandeSumma {
  ruta: RutaForLasaren;
  brutto: number;
}

export interface VantandeUnderlag {
  sald: boolean;
  /** Gemensamt underlag med andel – beror bara av andelarna, inte av svaret. */
  gemensam: boolean;
  agarandel_procent: number | null;
  sida1: VantandeRad[];
  sida2: VantandeRad[];
  /** Null nar summan beror av svaret. */
  ruta4: VantandeSumma | null;
  /** Null fore forsaljningen, och nar summan beror av svaret. */
  ruta5: VantandeSumma | null;
  /** Det som star i Återstår oavsett svaret. */
  oklassificerade_hogar: OklassificeradHog[];
  aterstaende_kvitton: AterstaendeKvitto[];
  /** Varningar som galler oavsett svaret. */
  varningar: string[];
}

function med(indata: K6aIndata, nybyggd: boolean): K6aExport {
  return byggK6aExport({
    ...indata,
    // Ombildningen ar inte heller besvarad; utan den ar nybyggd-regeln som
    // strangast, vilket ar det ena ytterlaget. Det andra ar "inte nybyggd".
    bostad: { ...indata.bostad, nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: false },
  });
}

const lika = <T>(a: T, b: T): T | null => (JSON.stringify(a) === JSON.stringify(b) ? a : null);

/**
 * Raderna med de tal som ar lika i bada korningarna. Radernas forekomst och
 * ordning beror inte av svaret (src/doman/export-k6a.ts, visarSida1/
 * visarSida2), men skulle de inte motsvara varandra en till en tas inget tal
 * med alls – hellre streck an ett tal parat med fel rad.
 *
 * Talen ar de exportvyn visar (src/app/export/page.tsx, SidaBlock): Belopp ar
 * kostnad_brutto, Avdragsgill del ar avdragsgill_del_brutto, och Din andel ar
 * den avdragsgilla delens andel nar den kolumnen visas, annars beloppets.
 */
export function sammaRader(
  a: K6aExportrad[],
  b: K6aExportrad[],
  visaAvdragsgill: boolean,
): VantandeRad[] {
  const parade =
    a.length === b.length && a.every((r, i) => r.atgard === b[i].atgard && r.ar === b[i].ar);
  const individuellt = (r: K6aExportrad) =>
    visaAvdragsgill ? (r.avdragsgill_del_individuellt ?? 0) : r.belopp_individuellt;
  return a.map((r, i) => {
    const s = parade ? b[i] : null;
    return {
      atgard: r.atgard,
      ar: r.ar,
      belopp: s ? lika(r.kostnad_brutto, s.kostnad_brutto) : null,
      avdragsgill: s ? lika(r.avdragsgill_del_brutto ?? 0, s.avdragsgill_del_brutto ?? 0) : null,
      individuellt: s ? lika(individuellt(r), individuellt(s)) : null,
      forklaring: s ? lika(r.forklaring, s.forklaring) : null,
      varningar: s ? r.varningar.filter((v) => s.varningar.includes(v)) : [],
    };
  });
}

export function vantandeUnderlag(
  indata: K6aIndata,
  upplatelseform: Upplatelseform,
  andelarnaGarIhop: boolean,
): VantandeUnderlag {
  const nej = med(indata, false);
  const ja = med(indata, true);
  const rutorNej = rutorForLasaren(nej, upplatelseform, andelarnaGarIhop);
  const rutorJa = rutorForLasaren(ja, upplatelseform, andelarnaGarIhop);
  const hogar = new Set(ja.oklassificerade_hogar.map((h) => JSON.stringify(h)));
  const kvitton = new Set(ja.aterstaende_kvitton.map((k) => JSON.stringify(k)));
  return {
    sald: nej.sald,
    gemensam: nej.delagarvariant === "gemensam_med_andel",
    agarandel_procent: nej.agarandel_procent,
    sida1: sammaRader(nej.sida1.rader, ja.sida1.rader, true),
    sida2: sammaRader(nej.sida2.rader, ja.sida2.rader, nej.sald),
    ruta4: lika(
      { ruta: rutorNej.ruta4, brutto: nej.ruta4_brutto },
      { ruta: rutorJa.ruta4, brutto: ja.ruta4_brutto },
    ),
    ruta5: nej.sald
      ? lika(
          { ruta: rutorNej.ruta5, brutto: nej.ruta5_brutto },
          { ruta: rutorJa.ruta5, brutto: ja.ruta5_brutto },
        )
      : null,
    oklassificerade_hogar: nej.oklassificerade_hogar.filter((h) => hogar.has(JSON.stringify(h))),
    aterstaende_kvitton: nej.aterstaende_kvitton.filter((k) => kvitton.has(JSON.stringify(k))),
    varningar: nej.varningar.filter((v) => ja.varningar.includes(v)),
  };
}
