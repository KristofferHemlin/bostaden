"use server";

// Frågor om bostaden (produktspec 4.1): första ägaren, och ombildningen när
// den är aktuell. En egen sida, nådd från två ställen – först av allt i
// försäljningsflödet, och från underlaget när ett tal kräver svaren. Var hon
// hamnar efteråt beror på varifrån hon kom:
//
//   * från underlaget (fran=export): tillbaka dit
//   * i försäljningsflödet: nästa steg som gäller bostaden
//     (src/doman/forsaljningsflode.ts)
//   * annars, för en osåld bostad: underlaget, som är det enda som väntar
//
// Ordningen i försäljningsflödet är oförändrad: datum → de här frågorna →
// skick → samma del → andel → underlag.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BostadsfragorResultat } from "@/components/bostadsfragor-formular";
import { skrivBostadsfragor } from "@/lib/bostadsfragor-lagring";
import { nastaSidaIForsaljningen } from "@/lib/forsaljningsflode";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export async function sparaFragorOmBostaden(
  _foreg: BostadsfragorResultat,
  formData: FormData,
): Promise<BostadsfragorResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const fel = await skrivBostadsfragor(bostadId, formData, {
    sida: "bostaden/fragor",
    anrop: "sparaFragorOmBostaden",
    anvandareId,
  });
  if (fel) return { fel };

  revalidatePath("/export");
  revalidatePath("/installningar");
  revalidatePath("/forsaljning", "layout");

  // Bara de två värdena – `nasta` är formulärdata, och ett okänt värde får
  // aldrig styra en omdirigering.
  if (formData.get("nasta") === "export") redirect("/export");
  const { forsaljningsdatum } = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { forsaljningsdatum: true },
  });
  if (forsaljningsdatum === null) redirect("/export");
  redirect(await nastaSidaIForsaljningen(bostadId, anvandareId, "bostadsfragor"));
}
