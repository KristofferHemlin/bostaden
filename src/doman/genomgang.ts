// Det som lever kvar av klassificeringsgenomgangen, som revs 2026-11-13
// (docs/produktspec.md 2b). Ren doman, inga DB-anrop.
//
//   * arOklassificerad – ett kvitto som varken hor till nagot projekt eller
//     ar markerat som utanfor bostaden. Raknas av kvittolistans kort och
//     avgor vilka kvitton som gar att hamta till ett projekt
//     (src/doman/kvittokoppling.ts).
//   * hogVisningsnamn / projektnamnKarta – ett projekt utan namn heter som
//     sina kvitton. Sedan omlaggningen far varje nytt projekt ett namn, sa det
//     galler bara projekt skapade fore den (docs/design.md, "Projekt som
//     skapades före omläggningen").
//
// Sammanslagningsforslagen (foreslaHogar) togs bort med genomgangen, med flit.

import { harledKostnadstillstand } from "./berakningar";
import type { Kostnad } from "./typer";

/**
 * Ett kvitto ar "utan projekt" sa lange det varken ar markerat som utanfor
 * bostaden (arkiverat) eller redan kopplat till ett projekt. Privat-markerade
 * rader raknas inte som en koppling – ett kvitto med bara en privat rad ar fortfarande oklassificerat.
 */
export function arOklassificerad(kostnad: Kostnad): boolean {
  if (kostnad.arkiverad) return false;
  return harledKostnadstillstand(kostnad).okopplad;
}

// ---- Ett projekt utan namn --------------------------------------------------

/**
 * Ett projekt skapat fore omlaggningen kan sakna namn – genomgangens hog fick
 * sitt forst nar fragorna besvarades. Det visas da som antal och leverantorer:
 * "2 kvitton · BAUHAUS, Jysk". Leverantorer listas i den ordning de forst forekommer, utan
 * dubbletter; saknar alla kvitton leverantor (t.ex. utkast) blir det bara
 * antalet.
 */
export function hogVisningsnamn(
  kvitton: { leverantor: string | null }[],
): string {
  const antal = kvitton.length;
  const antalstext = `${antal} kvitto${antal === 1 ? "" : "n"}`;
  const leverantorer = [
    ...new Set(
      kvitton
        .map((k) => k.leverantor?.trim())
        .filter((l): l is string => !!l),
    ),
  ];
  return leverantorer.length > 0
    ? `${antalstext} · ${leverantorer.join(", ")}`
    : antalstext;
}

/** Ett kvitto som det behovs for att namnge hogarna det ligger i. */
export interface KvittoForHognamn {
  leverantor: string | null;
  betaldatum: Date | null;
  dokumentdatum: Date | null;
  rader: { fordelningar: { projekt_id: string | null }[] }[];
}

// Betaldatum, sedan dokumentdatum, tomma sist – den ordning hogen en gang
// lades ihop i. Leverantoren sist, sa att tva kvitton med samma datum alltid
// ger samma namn: lika datum ar ingen ordning (CLAUDE.md, "Lika tidsstämplar
// är ingen ordning").
function tid(d: Date | null): number {
  return d ? d.getTime() : Number.POSITIVE_INFINITY;
}
function kvittoordning(a: KvittoForHognamn, b: KvittoForHognamn): number {
  return (
    tid(a.betaldatum) - tid(b.betaldatum) ||
    tid(a.dokumentdatum) - tid(b.dokumentdatum) ||
    (a.leverantor ?? "").localeCompare(b.leverantor ?? "", "sv")
  );
}

/**
 * Namnet som visas for varje projekt: dess eget, eller – for en hog som annu
 * inte fatt ett – hogVisningsnamn av dess kvitton. En hog far sitt namn forst
 * nar fragetradets forsta fraga besvaras, och mellan att den lades ihop och
 * att fragan besvaras ar namnet tomt. Det fonstret ar normalfallet:
 * genomgangen sager sjalv att man kan avbryta nar som helst.
 *
 * Uppmatt 2026-10-20: projektlistan, kvittots sida, valen "Koppla till
 * projekt" och "Dela upp" och Återstår i underlaget skrev det tomma namnet
 * rakt av. Alla gar genom den har funktionen.
 */
export function projektnamnKarta(
  projekt: { id: string; namn: string }[],
  kvitton: KvittoForHognamn[],
): Map<string, string> {
  const sorterade = [...kvitton].sort(kvittoordning);
  return new Map(
    projekt.map((p) => {
      if (p.namn.trim() !== "") return [p.id, p.namn];
      const hogens = sorterade.filter((k) =>
        k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === p.id)),
      );
      return [p.id, hogVisningsnamn(hogens)];
    }),
  );
}
