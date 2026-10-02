// Vilken bostad som ar aktiv (docs/design.md, "Att äga flera bostäder"). Ren
// funktion – medlemskapen och valet slas upp av anroparen (hamtaAktivBostad i
// src/lib/session.ts).
//
// Valet pa anvandaren ar en preferens, aldrig en behorighet. Det galler bara
// om det pekar pa en bostad anvandaren ar medlem i. Ar det tomt, eller pekar
// det pa en bostad hon inte langre ar medlem i, faller valet tillbaka
// deterministiskt: det aldsta medlemskapet, med id som andra nyckel sa att
// tva medlemskap med samma skapad_at inte lamnas at databasens godtycke.

export interface Medlemskapsrad {
  id: string;
  bostad_id: string;
  skapad_at: Date;
}

function aldstForst(a: Medlemskapsrad, b: Medlemskapsrad): number {
  const tid = a.skapad_at.getTime() - b.skapad_at.getTime();
  if (tid !== 0) return tid;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Medlemskapet som ar aktivt, eller null nar anvandaren saknar medlemskap.
 * Sorterar sjalv i stallet for att lita pa att anroparen gjort det – ordningen
 * ar hela poangen med aterfallet.
 */
export function valjAktivtMedlemskap<M extends Medlemskapsrad>(
  aktivBostadId: string | null,
  medlemskap: readonly M[],
): M | null {
  if (aktivBostadId) {
    const valt = medlemskap.find((m) => m.bostad_id === aktivBostadId);
    if (valt) return valt;
  }
  return [...medlemskap].sort(aldstForst)[0] ?? null;
}
