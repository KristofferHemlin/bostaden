// Ett kvitto som ingar i projektets bas men inte i avdraget (docs/design.md,
// "Ett kvitto som ingår i basen men inte i avdraget säger det på sin rad").
//
// Merkostnaden fordelas pa hela projektets belopp, ocksa kvitton som sedan
// nollas i steg 3 (CLAUDE.md, "Kostnader som faller bort senare får ändå sin
// del"). Talen ar ratt; det som fattades var att projektsidan sa det. Raden
// och summans "varav" berattar – de raknar ingenting nytt och andrar inget
// tal.
//
// Vilka kvitton: de som steg 3 nollar HELT. I dag ar det ett skal: kvittot ar
// daterat fore tilltradet – samma jamforelse som berakningen och Återstår
// (dateratForeTilltradet). Den bakre tidsgransen nollar grundforbattringsdelen,
// inte kvittot, och ar inte med (docs/design.md, rattat 2026-11-25).
// Femarsfonstret, nybyggd-regeln och troskeln nollar en del eller ett ar.
//
// Betaldatumet spelar ingen roll har (docs/design.md, "Obetald lovar något den
// inte kan hålla"): tilltradesgransen provar kvittots datum, sa ett obetalt
// kvitto fore tilltradet raknas aldrig, hur det an betalas. Tilltradet avgor
// forst – fore raden "Obetald". Arkiverade kvitton och utkast ar inte med:
// de har sina egna tillstand.

import { arUtkast, bidragForKostnad } from "@/doman/berakningar";
import { dateratForeTilltradet } from "@/doman/atgardsberakning";
import type { Kostnad } from "@/doman/typer";
import { formateraKronor } from "@/lib/format";

// Ordagrant ur docs/design.md, samma avsnitt
// (tester/projekt-raknas-inte.test.ts laser dem dar).
export const RAKNAS_INTE_FORE_TILLTRADET = "Daterat före tillträdet · räknas inte i underlaget";

/** "varav 43 807,50 kr räknas inte" – efter summan, i samma matt som den
 *  (projektSumma: utan privat del, efter ROT). */
export function varavRaknasInteText(oren: number): string {
  return `varav ${formateraKronor(oren)} räknas inte`;
}

/** Sant for ett kvitto som steg 3 nollar helt, betalt eller inte. */
export function raknasInteIUnderlaget(k: Kostnad, tilltradesdatum: string): boolean {
  if (k.arkiverad || arUtkast(k)) return false;
  return dateratForeTilltradet(k.dokumentdatum, tilltradesdatum);
}

/** Den del av projektSumma som kommer fran sadana kvitton, i oren. Ett
 *  obetalt kvitto fore tilltradet ar med: det ar med i projektSumma, som
 *  raknar oavsett betaldatum, och det raknas aldrig i underlaget. */
export function projektSummaSomRaknasInte(
  kostnader: readonly Kostnad[],
  projektId: string,
  tilltradesdatum: string,
): number {
  let summa = 0;
  for (const k of kostnader) {
    if (raknasInteIUnderlaget(k, tilltradesdatum)) summa += bidragForKostnad(k, projektId);
  }
  return summa;
}
