// Beskedet fore ett sparande som andrar vilka kvitton som raknas (docs/design.md,
// "Beskedet när ett värde ändrar vilka kvitton som räknas"). Ren modul utan
// databas: typen gar fran servern till webblasaren, och texterna byggs pa
// samma satt pa bada sidor.

import type { Underlagsandring } from "@/doman/underlagsandring";
import { formateraAntal, formateraKronor } from "@/lib/format";

/** Det servern svarar i stallet for att spara, tills hon bekraftat. */
export interface Underlagsbesked extends Underlagsandring {
  /** Byts upplatelseformen blir lagrade svar om bostaden obesvarade igen –
   *  en forlust som inte syns i talen. */
  bostadsfragorNollstalls: boolean;
  /** Vad bekraftelsen galler: de nya vardena. Skickas tillbaka med "Spara
   *  ändå", och sparandet gar igenom bara om det ar samma varden – andrar hon
   *  nagot efter "Avbryt" fragar appen igen. Ingen sakerhet, en bekraftelse. */
  bekraftelse: string;
}

/** Faltet "Spara ändå" skickar bekraftelsen i. */
export const BEKRAFTAD_ANDRING = "bekraftad_andring";

// Ordagrant ur docs/design.md, citatet och tabellen under "Beskedet när ett
// värde ändrar vilka kvitton som räknas" (tester/underlagsbesked.test.ts
// laser dem dar).
export const UNDERLAGSBESKED_RUBRIK = "Ändringen påverkar ditt underlag";
export const UNDERLAGSBESKED_SPARA = "Spara ändå";
export const UNDERLAGSBESKED_AVBRYT = "Avbryt";

/** "Sida 1 blir ", talet efter, " i stället för ", talet fore, "." – i delar,
 *  sa att talet efter kan sta i fetstil som i design.md. */
export function summaradensDelar(s: { sida: 1 | 2; fore: number; efter: number }) {
  return { fore: `Sida ${s.sida} blir `, efter: formateraKronor(s.efter), mellan: " i stället för ", sist: `${formateraKronor(s.fore)}.` };
}

/** "5 000" ur 500 000 oren – beloppet i "5 000-gränsen", utan "kr". */
function gransen(oren: number): string {
  return formateraAntal(Math.round(oren / 100));
}

/** Antalet i ord till och med tolv, annars med siffror (docs/design.md,
 *  "Antalet skrivs med bokstäver till och med tolv"). Neutrum: kvitto och år. */
const ORD = ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"];
function antal(n: number): string {
  return n <= 12 ? ORD[n] : formateraAntal(n);
}

/**
 * Orsakerna, inte kvittona (docs/design.md: "Andra raden namnger orsakerna"),
 * med lydelserna ur tabellen under "Beskedet när ett värde ändrar vilka
 * kvitton som räknas" – också när underlaget växer, den farliga riktningen.
 * Ordningen: kvitton ut, kvitton in, år under, år över. Null när ingen av de
 * fyra gäller – då står bara talet.
 */
export function orsaksraden(
  b: Pick<Underlagsandring, "kvittonUtanforInnehavet" | "kvittonInnanforInnehavet" | "arUnderTroskeln" | "arOverTroskeln">,
): string | null {
  const kvitton = (n: number) => `${antal(n)} ${n === 1 ? "kvitto" : "kvitton"}`;
  const delar: string[] = [];
  if (b.kvittonUtanforInnehavet > 0) delar.push(`${kvitton(b.kvittonUtanforInnehavet)} hamnar utanför ditt innehav`);
  if (b.kvittonInnanforInnehavet > 0) delar.push(`${kvitton(b.kvittonInnanforInnehavet)} kommer innanför ditt innehav`);
  if (b.arUnderTroskeln) {
    delar.push(`${antal(b.arUnderTroskeln.antal)} år faller under ${gransen(b.arUnderTroskeln.troskelbelopp)}-gränsen`);
  }
  if (b.arOverTroskeln) {
    delar.push(`${antal(b.arOverTroskeln.antal)} år når över ${gransen(b.arOverTroskeln.troskelbelopp)}-gränsen`);
  }
  if (delar.length === 0) return null;
  const text = delar.join(", och ");
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

/** Ordagrant ur tabellen i design.md, raden "Upplåtelseformen byts". Sidan
 *  heter Frågor om bostaden, och dit leder underlaget sedan. */
export const BOSTADSFRAGOR_NOLLSTALLS = "Frågorna om bostaden behöver besvaras igen.";
