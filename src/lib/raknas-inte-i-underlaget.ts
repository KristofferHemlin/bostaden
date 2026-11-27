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

import { arUtkast, bidragForKostnad, summeraInlagt } from "@/doman/berakningar";
import { dateratForeTilltradet } from "@/doman/atgardsberakning";
import type { Kostnad } from "@/doman/typer";
import { formateraKronor } from "@/lib/format";

// Ordagrant ur docs/design.md, samma avsnitt
// (tester/projekt-raknas-inte.test.ts laser dem dar). Hart mellanslag i
// "räknas inte": annars bryts raden vid 360 px som "… · räknas" / "inte i
// underlaget", och forsta raden lases som sin motsats bredvid beloppet
// (docs/design.md, "Tillträdesraden bryter på negationen").
export const RAKNAS_INTE_FORE_TILLTRADET = "Daterat före tillträdet · räknas\u00a0inte i underlaget";

// Raden for ett arkiverat kvitto, samma lydelse som kvittolistan
// (docs/design.md, "Raden visar tillståndet i stället för talet").
export const HOR_INTE_TILL_BOSTADEN = "Hör inte till bostaden";

/** "varav 43 807,50 kr räknas inte" – efter summan, i samma matt som den
 *  (projektSumma: utan privat del, efter ROT). Tva harda mellanslag, inte
 *  fler (docs/design.md, "Två mellanslag, inte fler"): mellan "varav" och
 *  talet, sa att ordet aldrig blir sist pa en rad skilt fran sitt belopp, och
 *  inuti "räknas inte", sa att negationen aldrig star ensam pa nasta rad och
 *  raden ovanfor lases som sin motsats. Beloppet haller ihop av sina egna;
 *  mellanslaget mellan beloppet och "räknas" ska kunna brytas – hela satsen
 *  som block ar 241 px och svammar over vid 360 px. */
export function varavRaknasInteText(oren: number): string {
  return `varav\u00a0${formateraKronor(oren)} räknas\u00a0inte`;
}

/**
 * Vilket tillstand en kvittorad i ett projekt bar. Det som gor kvittot
 * permanent utanfor vinner over det som bara drojer (docs/design.md, "Ett
 * arkiverat kvitto i ett projekt säger ingenting om att det är arkiverat"):
 *
 * 1. arkiverat – ligger utanfor basen, sa tilltradesraden ("ingår i basen men
 *    inte i avdraget") vore osann om det
 * 2. daterat fore tilltradet – raknas aldrig, hur det an betalas
 * 3. obetald – raknas den dag det betalas
 *
 * Varje steg provar sitt eget villkor och inte de andras uteslutningar, sa
 * att en omkastad ordning andrar utfallet och faller i sitt prov.
 */
export type ProjektradensTillstand = "hor_inte_till_bostaden" | "fore_tilltradet" | "obetald" | null;

export function projektradensTillstand(k: Kostnad, tilltradesdatum: string): ProjektradensTillstand {
  if (k.arkiverad) return "hor_inte_till_bostaden";
  if (!arUtkast(k) && dateratForeTilltradet(k.dokumentdatum, tilltradesdatum)) return "fore_tilltradet";
  if (!k.betaldatum) return "obetald";
  return null;
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

/** Den del av en arsrubriks summa i kvittolistan som kommer fran kvitton
 *  daterade fore tilltradet, i oren. Samma matt som summan (summeraInlagt:
 *  utan privat del, efter ROT), sa att "varav" ar en del av talet bredvid
 *  (docs/design.md, "Årsrubriken säger vad som inte räknas"). Arsrubriken
 *  raknar dem, liksom "Inlagt {ar}" – de ar inlagda – men de raknas aldrig i
 *  underlaget. */
export function arssummaSomRaknasInte(kostnader: readonly Kostnad[], tilltradesdatum: string): number {
  return summeraInlagt(kostnader.filter((k) => raknasInteIUnderlaget(k, tilltradesdatum)));
}
