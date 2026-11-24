// Vad en andring av ett bostadsvarde gor med underlaget (CLAUDE.md, "Ett fält
// som ändrar vilka kvitton som räknas ska säga vad det kostar"; docs/design.md,
// "Beskedet när ett värde ändrar vilka kvitton som räknas").
//
// Talet ar SKILLNADEN I UNDERLAGET: hela berakningen kors tva ganger, en gang
// pa bostaden som den ar och en gang pa en kopia med det nya vardet, och de
// tal exportvyn visar jamfors. Aldrig summan av de kvitton andringen ror – ett
// tilltrade tva manader fram tog ett kvitto pa 2 000 kr ur underlaget och
// sida 1 sjonk 6 000 kr, eftersom aret da foll under troskeln (uppmatt
// 2026-11-24).
//
// Ren: ingen databas, inga sidoeffekter. Det nya vardet sparas aldrig for att
// raknas – berakningen tar bostaden som ett varde, och kopian lever bara har.

import { rutorForLasaren } from "./blankett";
import {
  byggK6aExport,
  OgiltigAgarandel,
  VantarPaBostadsfragor,
  type K6aExport,
  type K6aIndata,
} from "./export-k6a";
import { vantandeUnderlag } from "./vantande-underlag";

/** En summa som andras: sida 1 (ruta 4) eller sida 2 (ruta 5), i oren, som
 *  exportvyn visar den – med lasarens andel och avrundad som dar. */
export interface Summaandring {
  sida: 1 | 2;
  fore: number;
  efter: number;
}

export interface Underlagsandring {
  summor: Summaandring[];
  /** Kvitton som hamnar fore tilltradet med det nya vardet men inte gjorde
   *  det forut. */
  kvittonUtanforInnehavet: number;
  /** Ar som faller under troskeln med det nya vardet men inte gjorde det
   *  forut, med troskelbeloppet for det forsta av dem. */
  arUnderTroskeln: { antal: number; troskelbelopp: number } | null;
}

interface Talen {
  sida1: number | null;
  sida2: number | null;
  ex: K6aExport | null;
}

/** De tal exportvyn visar for den har indatan, eller null nar den inte visar
 *  nagra (en ogiltig andel). Vantar bostadsfragorna pa svar visas bara det
 *  som ar lika for bada svaren – samma vag som exportvyn gar. */
function talen(indata: K6aIndata, andelarnaGarIhop: boolean): Talen | null {
  const form = indata.bostad.upplatelseform;
  try {
    const ex = byggK6aExport(indata);
    const rutor = rutorForLasaren(ex, form, andelarnaGarIhop);
    return { sida1: rutor.ruta4.belopp, sida2: ex.sald ? rutor.ruta5.belopp : null, ex };
  } catch (fel) {
    if (fel instanceof OgiltigAgarandel) return null;
    if (!(fel instanceof VantarPaBostadsfragor)) throw fel;
  }
  try {
    const v = vantandeUnderlag(indata, form, andelarnaGarIhop);
    return { sida1: v.ruta4?.ruta.belopp ?? null, sida2: v.sald ? (v.ruta5?.ruta.belopp ?? null) : null, ex: null };
  } catch (fel) {
    if (fel instanceof OgiltigAgarandel) return null;
    throw fel;
  }
}

/**
 * Underlaget fore mot underlaget efter. Null nar inget tal hon kan se andras –
 * ett andrat varde som inte flyttar nagon summa har inget pris att visa.
 * En summa som inte gar att visa pa ena sidan (den vantar pa bostadsfragorna)
 * jamfors inte: ett tal mot ett streck ar ingen skillnad att namna.
 */
export function jamforUnderlag(
  fore: K6aIndata,
  efter: K6aIndata,
  andelarnaGarIhop: boolean,
): Underlagsandring | null {
  const f = talen(fore, andelarnaGarIhop);
  const e = talen(efter, andelarnaGarIhop);
  if (!f || !e) return null;

  const summor: Summaandring[] = [];
  for (const [sida, a, b] of [
    [1, f.sida1, e.sida1],
    [2, f.sida2, e.sida2],
  ] as const) {
    if (a !== null && b !== null && a !== b) summor.push({ sida, fore: a, efter: b });
  }
  if (summor.length === 0) return null;

  let kvittonUtanforInnehavet = 0;
  let arUnderTroskeln: Underlagsandring["arUnderTroskeln"] = null;
  if (f.ex && e.ex) {
    const foreUtanfor = new Set(
      f.ex.aterstaende_kvitton.filter((k) => k.orsak === "fore_tilltradet").map((k) => k.kostnad_id),
    );
    kvittonUtanforInnehavet = e.ex.aterstaende_kvitton.filter(
      (k) => k.orsak === "fore_tilltradet" && !foreUtanfor.has(k.kostnad_id),
    ).length;
    const foreUnder = new Set(f.ex.ar_under_troskeln.map((a) => a.ar));
    const nyaUnder = e.ex.ar_under_troskeln.filter((a) => !foreUnder.has(a.ar));
    if (nyaUnder.length > 0) {
      arUnderTroskeln = { antal: nyaUnder.length, troskelbelopp: nyaUnder[0].troskelbelopp };
    }
  }
  return { summor, kvittonUtanforInnehavet, arUnderTroskeln };
}
