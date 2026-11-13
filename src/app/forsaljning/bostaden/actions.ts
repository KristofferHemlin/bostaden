"use server";

// Bostadsfragorna i forsaljningsflodet (produktspec 4.1): forsta steget efter
// forsaljningsdatumet, eftersom svaret avgor om skickfragan vid forsaljningen
// alls ska stallas. Efter svaret gar flodet till nasta steg som galler
// bostaden (src/doman/forsaljningsflode.ts).
//
// Sidan nas ocksa fran underlaget fore forsaljningen – berakningen vantar pa
// svaren aven da (VantarPaBostadsfragor). Ar bostaden inte sald finns inget
// flode att fortsatta i, och svaret leder tillbaka till underlaget.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BostadsfragorResultat } from "@/components/bostadsfragor-formular";
import { skrivBostadsfragor } from "@/lib/bostadsfragor-lagring";
import { nastaSidaIForsaljningen } from "@/lib/forsaljningsflode";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export async function sparaBostadsfragorVidForsaljning(
  _foreg: BostadsfragorResultat,
  formData: FormData,
): Promise<BostadsfragorResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const fel = await skrivBostadsfragor(bostadId, formData, {
    sida: "forsaljning/bostaden",
    anrop: "sparaBostadsfragorVidForsaljning",
    anvandareId,
  });
  if (fel) return { fel };

  revalidatePath("/export");
  revalidatePath("/installningar");
  revalidatePath("/forsaljning", "layout");

  const { forsaljningsdatum } = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { forsaljningsdatum: true },
  });
  if (forsaljningsdatum === null) redirect("/export");
  redirect(await nastaSidaIForsaljningen(bostadId, anvandareId, "bostadsfragor"));
}
