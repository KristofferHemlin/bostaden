// Beskedet fore ett sparande, raknat pa servern (docs/design.md, "Beskedet när
// ett värde ändrar vilka kvitton som räknas"). Det nya vardet laggs pa en
// kopia av bostadens rad i minnet och gors om till domanens bostad pa samma
// satt som den sparade raden (tillDomanBostad) – sa att talet efter ar det
// underlaget skulle visa om andringen sparades, utan att nagot sparas.

import type { Prisma } from "@prisma/client";
import { jamforUnderlag } from "@/doman/underlagsandring";
import { tillDomanBostad } from "@/lib/doman-fran-db";
import { BEKRAFTAD_ANDRING, type Underlagsbesked } from "@/lib/underlagsbesked";
import { hamtaUnderlagetsIndata } from "@/lib/underlagets-indata";

type PrismaBostad = Prisma.bostadGetPayload<Record<string, never>>;

export type Bostadsandring = Partial<
  Pick<
    PrismaBostad,
    "tilltradesdatum" | "forsaljningsdatum" | "upplatelseform" | "nybyggd_vid_forvarv" | "ombildning_fran_hyresratt"
  >
>;

/** De nya vardena som en jamforbar strang: nycklarna i ordning, datum som dag. */
function bekraftelseFor(andring: Bostadsandring): string {
  return JSON.stringify(
    Object.keys(andring)
      .sort()
      .map((k) => {
        const v = andring[k as keyof Bostadsandring];
        return [k, v instanceof Date ? v.toISOString().slice(0, 10) : v];
      }),
  );
}

/**
 * Beskedet for `andring`, eller null nar inget behover sagas: ingen summa hon
 * kan se andras, och inga svar nollstalls.
 *
 * `forTalen` ar det som laggs pa kopian nar talen raknas, om det skiljer sig
 * fran det som sparas. Ett byte av upplatelseform nollstaller bostadsfragorna;
 * raknades talen med de nollstallda svaren skulle beskedet visa vantelagets
 * streck i stallet for vad sjalva bytet kostar. Bytets pris raknas darfor med
 * svaren kvar, och nollstallningen sags for sig.
 */
export async function underlagsbeskedVidAndring(
  bostadId: string,
  egenAndel: number | null,
  andring: Bostadsandring,
  { forTalen = andring, bostadsfragorNollstalls = false }: { forTalen?: Bostadsandring; bostadsfragorNollstalls?: boolean } = {},
): Promise<Underlagsbesked | null> {
  const { bostad, kostnadRader, indata, andelarnaGarIhop } = await hamtaUnderlagetsIndata(bostadId, egenAndel);
  // Utan ett enda kvitto visar underlaget inga tal (exportvyns tomma lage).
  const jamforelse =
    kostnadRader.length === 0
      ? null
      : jamforUnderlag(indata, { ...indata, bostad: tillDomanBostad({ ...bostad, ...forTalen }) }, andelarnaGarIhop);
  if (!jamforelse && !bostadsfragorNollstalls) return null;
  return {
    summor: jamforelse?.summor ?? [],
    kvittonUtanforInnehavet: jamforelse?.kvittonUtanforInnehavet ?? 0,
    arUnderTroskeln: jamforelse?.arUnderTroskeln ?? null,
    bostadsfragorNollstalls,
    bekraftelse: bekraftelseFor(andring),
  };
}

/** Sant nar formularet bar en bekraftelse av just det har beskedet. */
export function arBekraftat(formData: FormData, besked: Underlagsbesked): boolean {
  return String(formData.get(BEKRAFTAD_ANDRING) ?? "") === besked.bekraftelse;
}
