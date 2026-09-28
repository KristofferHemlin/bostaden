// Ett tomt utkast finns inte (docs/design.md, "Kvittolistan"). Utkastet skapas
// forst nar det finns nagot att spara – ett filval (src/app/kostnad/nytt/
// form.tsx, sakerstallUtkast). Men ett filval kan avbrytas eller en uppladdning
// misslyckas, och da ligger en rad kvar utan bade bilaga och falt. Den raden
// raknas inte i "N kvitton att klassificera", visas inte i kvittolistan, inte
// bland de sex senaste pa startskarmen och inte i genomgangen. Har utkastet ett
// paborjat varde ligger det kvar och syns – det ar arbete som annars gar
// forlorat.
//
// Befintliga rader rors inte: regeln styr vad som VISAS, den stadar ingenting.
//
// Tva former av samma regel: ett predikat for testerna och ett Prisma-villkor
// for fragorna, sa att listor och raknare filtrerar i databasen och en kapad
// lista (take: 6) inte fylls ut med rader som sedan slangs.

import type { Prisma } from "@prisma/client";

export interface UtkastUppgifter {
  totalbelopp: number | null;
  leverantor: string | null;
  dokumentdatum: Date | null;
  betaldatum: Date | null;
  anteckning: string | null;
  rot_utnyttjat: number | null;
  forsakringsersattning: number | null;
  antalBilagor: number;
}

/** Sant for ett utkast som varken har en bilaga eller ett ifyllt falt. */
export function arTomtUtkast(k: UtkastUppgifter): boolean {
  return (
    k.totalbelopp === null &&
    k.leverantor === null &&
    k.dokumentdatum === null &&
    k.betaldatum === null &&
    k.rot_utnyttjat === null &&
    k.forsakringsersattning === null &&
    (k.anteckning ?? "").trim() === "" &&
    k.antalBilagor === 0
  );
}

/**
 * Samma regel som arTomtUtkast, som villkor i en kostnadsfraga. NOT over ett
 * objekt ar NOT(A AND B AND ...) – bara rader dar ALLT ar tomt utesluts.
 * Anteckningen trimmas redan vid sparningen, sa tom strang racker har.
 */
export const INTE_TOMT_UTKAST = {
  NOT: {
    totalbelopp: null,
    leverantor: null,
    dokumentdatum: null,
    betaldatum: null,
    rot_utnyttjat: null,
    forsakringsersattning: null,
    bilagor: { none: {} },
    OR: [{ anteckning: null }, { anteckning: { equals: "" } }],
  },
} satisfies Prisma.kostnadWhereInput;
