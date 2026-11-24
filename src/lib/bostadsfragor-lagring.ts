import "server-only";
import {
  bostadsfragornaBesvarade,
  FEL_FORSTA_AGARE,
  lagringAvBostadsfragor,
  tolkaBostadsfragesvar,
} from "@/doman/bostadsfragor";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { prisma } from "@/lib/prisma";
import type { Underlagsbesked } from "@/lib/underlagsbesked";
import { arBekraftat, underlagsbeskedVidAndring } from "@/lib/underlagsbesked-server";

/**
 * Tolkar och skriver bostadsfragornas svar ur formularet
 * (src/components/bostadsfragor-formular.tsx). Delas av forsaljningsflodet och
 * klassificeringsgenomgangen, sa att de aldrig kan tolka samma svar olika.
 * Upplatelseformen avgor om ombildningsfragan stalls och lases fran bostaden –
 * aldrig fran formularet. Ett ofullstandigt svar skriver ingenting.
 *
 * Returnerar ett fel att visa, ett besked att bekrafta, eller null nar svaret
 * ar sparat. Beskedet (docs/design.md, "Beskedet när ett värde ändrar vilka
 * kvitton som räknas"): ett andrat svar om forsta agaren kan ta bort eller
 * lagga till varje reparationsdel – och genom troskeln mer an sa. Det sags
 * innan det sparas, med det tal underlaget da skulle visa. Ett forsta svar,
 * pa en fraga som var obesvarad, har oftast inget tal att jamfora med:
 * underlaget vantade, och beskedet uteblir da av sig sjalvt.
 */
export async function skrivBostadsfragor(
  bostadId: string,
  formData: FormData,
  sammanhang: { sida: string; anrop: string; anvandareId: string; egenAndel: number | null },
): Promise<{ fel: string } | { underlag: Underlagsbesked } | null> {
  const { upplatelseform } = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true },
  });
  const tolkat = tolkaBostadsfragesvar(
    String(formData.get("forsta_agare") ?? ""),
    String(formData.get("ombildning") ?? ""),
    upplatelseform,
  );
  if ("fel" in tolkat) return { fel: tolkat.fel };
  if (!bostadsfragornaBesvarade(tolkat.svar)) return { fel: FEL_FORSTA_AGARE };

  const besked = await underlagsbeskedVidAndring(bostadId, sammanhang.egenAndel, lagringAvBostadsfragor(tolkat.svar));
  if (besked && !arBekraftat(formData, besked)) return { underlag: besked };

  try {
    await prisma.bostad.update({
      where: { id: bostadId },
      data: lagringAvBostadsfragor(tolkat.svar),
    });
  } catch (fel) {
    return { fel: serverfelMeddelande(fel, sammanhang) };
  }
  return null;
}
