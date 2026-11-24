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
  /** Kvitton som lag fore tilltradet och inte gor det med det nya vardet. */
  kvittonInnanforInnehavet: number;
  /** Ar som klarade troskeln och faller under den med det nya vardet, med
   *  troskelbeloppet for det forsta av dem. */
  arUnderTroskeln: Arsvandning | null;
  /** Ar som lag under troskeln och nar over den med det nya vardet – den
   *  farliga riktningen (docs/design.md, "Och orsaksraden finns också när
   *  underlaget växer"). */
  arOverTroskeln: Arsvandning | null;
}

export interface Arsvandning {
  antal: number;
  troskelbelopp: number;
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
  let kvittonInnanforInnehavet = 0;
  let arUnderTroskeln: Arsvandning | null = null;
  let arOverTroskeln: Arsvandning | null = null;
  if (f.ex && e.ex) {
    const utanfor = (ex: K6aExport) =>
      new Set(ex.aterstaende_kvitton.filter((k) => k.orsak === "fore_tilltradet").map((k) => k.kostnad_id));
    const foreUtanfor = utanfor(f.ex);
    const efterUtanfor = utanfor(e.ex);
    kvittonUtanforInnehavet = [...efterUtanfor].filter((id) => !foreUtanfor.has(id)).length;
    kvittonInnanforInnehavet = [...foreUtanfor].filter((id) => !efterUtanfor.has(id)).length;
    // Ett ar har vant nar det byter lista: klarade forut och faller nu,
    // eller fall forut och klarar nu. Ett ar som uppstar eller forsvinner
    // har inte vant – det fanns inte att prova pa ena sidan.
    // Troskelbeloppet tas fran sidan dar aret lag under: dar provades det.
    const vande = (under: { ar: number; troskelbelopp: number }[], over: number[]): Arsvandning | null => {
      const ar = under.filter((a) => over.includes(a.ar));
      return ar.length > 0 ? { antal: ar.length, troskelbelopp: ar[0].troskelbelopp } : null;
    };
    arUnderTroskeln = vande(e.ex.ar_under_troskeln, f.ex.ar_over_troskeln);
    arOverTroskeln = vande(f.ex.ar_under_troskeln, e.ex.ar_over_troskeln);
  }
  return { summor, kvittonUtanforInnehavet, kvittonInnanforInnehavet, arUnderTroskeln, arOverTroskeln };
}
