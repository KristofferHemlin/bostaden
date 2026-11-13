// Vad det betyder att ett kvitto kopplas till ett projekt. Regeln ar den som
// klassificeringsgenomgangens fas 1 alltid foljt nar en hog lades ihop, och
// som projektflodet (src/app/projekt/nytt) foljer nar kvittona hamtas till ett
// nytt projekt: varje rad som varken ar privat eller redan hor till ett
// projekt far en fordelning med andel 1. Privata rader och rader som redan ar
// fordelade rors inte – en rad som delvis hor till ett annat projekt ar inte
// var att flytta.
//
// Ren doman, sa att samma regel kan anvandas bade for att skriva kopplingen
// (src/lib/kvittokoppling.ts) och for att rakna ut i forvag vad kvittona
// bidrar med till projektets belopp – det merkostnaden ska vara mindre an.

import { projektetsBelopp } from "./atgardsberakning";
import { arOklassificerad } from "./genomgang";
import type { Kostnad, Kostnadsrad } from "./typer";

/** Raden kan kopplas: ingen fordelning alls, varken privat eller till ett projekt. */
export function radGarAttKoppla(rad: {
  fordelningar: readonly Pick<Kostnadsrad["fordelningar"][number], "privat" | "projekt_id">[];
}): boolean {
  return !rad.fordelningar.some((f) => f.privat || f.projekt_id !== null);
}

/**
 * Kvittot kan hamtas till ett projekt: det hor inte till nagot projekt an,
 * ligger inte bland det som inte hor till bostaden, och har minst en rad att
 * koppla. Ett utkast har inga rader och kan alltsa inte kopplas forran det
 * kompletterats.
 */
export function kvittoGarAttKoppla(kostnad: Kostnad): boolean {
  return arOklassificerad(kostnad) && kostnad.rader.some(radGarAttKoppla);
}

/**
 * Kvittot som det ser ut nar det kopplats till projektet – for att rakna pa,
 * aldrig for att lagra. Ett kvitto som inte gar att koppla kommer tillbaka
 * oforandrat.
 */
export function kopplatTillProjekt(kostnad: Kostnad, projektId: string): Kostnad {
  if (!kvittoGarAttKoppla(kostnad)) return kostnad;
  return {
    ...kostnad,
    rader: kostnad.rader.map((rad) =>
      radGarAttKoppla(rad)
        ? { ...rad, fordelningar: [{ projekt_id: projektId, privat: false, andel: 1 }] }
        : rad,
    ),
  };
}

// Ett id som aldrig finns i databasen – bara for att rakna pa en koppling som
// inte gjorts an.
const OSPARAT_PROJEKT = "osparat-projekt";

/**
 * Projektets belopp om de har kvittona kopplades till ett nytt projekt:
 * projektetsBelopp (src/doman/atgardsberakning.ts), fore ROT, utan privata
 * rader och utan obetalda kvitton. Det tal merkostnaden ska vara mindre an
 * och sparas mot (CLAUDE.md, steg 2) – innan projektet finns.
 */
export function beloppOmKopplade(kostnader: readonly Kostnad[]): number {
  return projektetsBelopp(
    kostnader.map((k) => kopplatTillProjekt(k, OSPARAT_PROJEKT)),
    OSPARAT_PROJEKT,
  );
}

/**
 * Stalls merkostnadsfragan nar kvitton laggs till ett projekt? Bara for
 * battre kvalitet utan svar, och bara nar projektet da far ett belopp att
 * vaga den mot (docs/design.md, "Att skapa ett projekt": fragan stalls bara
 * nar det finns ett belopp att dela).
 */
export function merkostnadFragasVid(
  projekt: { atgardstyp: string | null; battre_kvalitet: boolean | null; merkostnad: number | null },
  beloppEfter: number,
): boolean {
  return (
    projekt.atgardstyp === "utbytt" &&
    projekt.battre_kvalitet === true &&
    projekt.merkostnad === null &&
    beloppEfter > 0
  );
}
