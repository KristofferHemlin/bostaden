/**
 * Ren valideringslogik for agarandelsfaltet – bruten ur faltkomponenten
 * (@/components/agarandel-falt, en "use client"-komponent) och atervinns av
 * servern (installningar/actions.ts) sa att bada sidor provar exakt samma
 * regel (produktspec 4.7, CLAUDE.md "Samma kontroll pa servern som i
 * granssnittet, av samma skal som for tilltradesdatumet").
 *
 * Andelen ligger i intervallet 0 < andel <= 100 (Decimal(5,2) i schemat).
 * Noll avvisas – det betyder att ingenting ar anvandarens och ar nastan
 * alltid ett skrivfel. Ett tomt falt betyder daremot fortfarande att
 * anvandaren ager hela bostaden.
 */

const ANDEL_MONSTER = /^\d+(?:[.,]\d{1,2})?$/;

function normalisera(text: string): string {
  return text.trim().replace(/\s/g, "").replace(",", ".").replace(/%/g, "");
}

/**
 * Felmeddelande for faltets nuvarande text, eller null om texten ar giltig –
 * ett tomt falt racknas som giltigt (hela bostaden), inte som ett fel.
 */
export function agarandelFel(text: string): string | null {
  if (text.trim() === "") return null;
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
 * Agarandel i procent for faltets text, eller 100 vid tomt falt (hela
 * bostaden). Returnerar undefined nar texten inte gar att tolka eller ligger
 * utanfor 0–100.
 */
export function agarandelFranText(text: string): number | undefined {
  if (text.trim() === "") return 100;
  if (agarandelFel(text) !== null) return undefined;
  return Number.parseFloat(normalisera(text));
}
