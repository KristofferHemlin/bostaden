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

// Ordagrant ur docs/design.md, citatet under "Beskedet när ett värde ändrar
// vilka kvitton som räknas" (tester/underlagsbesked.test.ts laser det dar).
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

/**
 * Orsakerna, inte kvittona (docs/design.md: "Andra raden namnger orsakerna").
 * Ental ordagrant ur design.md; flertalet ("2 kvitton hamnar …", "2 år faller
 * …") ar agentens, 2026-11-24, och star inte i design.md. Null nar ingen av de
 * tva orsakerna galler – da star bara talet.
 */
export function orsaksraden(b: Pick<Underlagsandring, "kvittonUtanforInnehavet" | "arUnderTroskeln">): string | null {
  const delar: string[] = [];
  const n = b.kvittonUtanforInnehavet;
  if (n === 1) delar.push("ett kvitto hamnar utanför ditt innehav");
  else if (n > 1) delar.push(`${formateraAntal(n)} kvitton hamnar utanför ditt innehav`);
  if (b.arUnderTroskeln) {
    const { antal, troskelbelopp } = b.arUnderTroskeln;
    delar.push(`${antal === 1 ? "ett år faller" : `${formateraAntal(antal)} år faller`} under ${gransen(troskelbelopp)}-gränsen`);
  }
  if (delar.length === 0) return null;
  const text = delar.join(", och ");
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

/** Agentens lydelse 2026-11-24, inte i design.md: design.md sager att
 *  upplatelseformen "säger en sak till" men inte med vilka ord. Sidan heter
 *  Frågor om bostaden, och dit leder underlaget sedan. */
export const BOSTADSFRAGOR_NOLLSTALLS = "Frågorna om bostaden behöver besvaras igen.";
