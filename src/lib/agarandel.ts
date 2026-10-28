/**
 * Ren valideringslogik for agarandelsfaltet – bruten ur faltkomponenten
 * (@/components/agarandel-falt, en "use client"-komponent) och atervinns av
 * servern (installningar/actions.ts) sa att bada sidor provar exakt samma
 * regel (produktspec 4.7, CLAUDE.md "Samma kontroll pa servern som i
 * granssnittet, av samma skal som for tilltradesdatumet").
 *
 * Andelen ligger i intervallet 0 < andel <= 100 (Decimal(5,2) i schemat).
 * Noll avvisas – det betyder att ingenting ar anvandarens och ar nastan
 * alltid ett skrivfel, och sa lange noll ar ogiltigt ar varje nolla som nar
 * berakningen ett bevis pa att en null lasts som ett tal.
 *
 * Ett tomt falt ar ett fel (CLAUDE.md, "Andelen ar null tills den
 * besvarats"). Det betydde hela bostaden till 2026-10-28. Anvandaren kan inte
 * ange null: null uppstar bara av att fragan aldrig besvarats.
 */

const ANDEL_MONSTER = /^\d+(?:[.,]\d{1,2})?$/;

function normalisera(text: string): string {
  return text.trim().replace(/\s/g, "").replace(",", ".").replace(/%/g, "");
}

/** Meningen for ett tomt falt. */
export const ANDEL_SAKNAS = "Ange ägarandelen i procent, t.ex. 100 om du äger hela bostaden.";

/** Felmeddelande for faltets nuvarande text, eller null om texten ar giltig. */
export function agarandelFel(text: string): string | null {
  if (text.trim() === "") return ANDEL_SAKNAS;
  const normaliserad = normalisera(text);
  if (!ANDEL_MONSTER.test(normaliserad)) {
    return "Ägarandel anges som ett tal mellan 0 och 100, t.ex. 50 eller 33,33.";
  }
  const varde = Number.parseFloat(normaliserad);
  if (varde <= 0) return "Ägarandel kan inte vara noll.";
  if (varde > 100) return "Ägarandel kan inte vara mer än 100.";
  return null;
}

/**
 * Agarandel i procent for faltets text. Returnerar undefined nar faltet ar
 * tomt, nar texten inte gar att tolka eller nar den ligger utanfor 0–100.
 */
export function agarandelFranText(text: string): number | undefined {
  if (agarandelFel(text) !== null) return undefined;
  return Number.parseFloat(normalisera(text));
}
