import "server-only";
import {
  bostadsfragornaBesvarade,
  FEL_FORSTA_AGARE,
  lagringAvBostadsfragor,
  tolkaBostadsfragesvar,
} from "@/doman/bostadsfragor";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { prisma } from "@/lib/prisma";

/**
 * Tolkar och skriver bostadsfragornas svar ur formularet
 * (src/components/bostadsfragor-formular.tsx). Delas av forsaljningsflodet och
 * klassificeringsgenomgangen, sa att de aldrig kan tolka samma svar olika.
 * Upplatelseformen avgor om ombildningsfragan stalls och lases fran bostaden –
 * aldrig fran formularet. Ett ofullstandigt svar skriver ingenting.
 *
 * Returnerar ett fel att visa, eller null nar svaret ar sparat.
 */
export async function skrivBostadsfragor(
  bostadId: string,
  formData: FormData,
  sammanhang: { sida: string; anrop: string; anvandareId: string },
): Promise<string | null> {
  const { upplatelseform } = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true },
  });
  const tolkat = tolkaBostadsfragesvar(
    String(formData.get("forsta_agare") ?? ""),
    String(formData.get("ombildning") ?? ""),
    upplatelseform,
  );
  if ("fel" in tolkat) return tolkat.fel;
  if (!bostadsfragornaBesvarade(tolkat.svar)) return FEL_FORSTA_AGARE;

  try {
    await prisma.bostad.update({
      where: { id: bostadId },
      data: lagringAvBostadsfragor(tolkat.svar),
    });
  } catch (fel) {
    return serverfelMeddelande(fel, sammanhang);
  }
  return null;
}
