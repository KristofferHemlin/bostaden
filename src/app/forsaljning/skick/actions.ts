"use server";

// Steg 4: fraga 7, skicket vid forsaljningen, per atgard (produktspec 4.1,
// 4.4). Stalls forst har – i skillnad fran fraga 6 (skick_forvarv), som
// klassificeringsgenomgangen redan satter. Bara atgarder med en
// reparationsdel (atgardstyp = "utbytt") behover svaret; se
// behoverSkickForsaljning i src/doman/fragetradet.ts for urvalet.
//
// En atgard i taget, precis som genomgangens fas 2: sparaSkickForsaljning
// redirectar tillbaka till /forsaljning/skick, som da hamtar en atgard
// farre. Flodet ar darmed avbrytbart och gar att ta vid – ingenting kravs i
// en foljd.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { tolkaSkickForvarv } from "@/doman/fragetradet";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface SkickForsaljningResultat {
  fel?: string;
}

function revalideraSkickvyer(projektId: string): void {
  revalidatePath("/");
  revalidatePath("/export");
  revalidatePath("/forsaljning");
  revalidatePath("/forsaljning/skick");
  revalidatePath("/projekt");
  revalidatePath(`/projekt/${projektId}`);
}

export async function sparaSkickForsaljning(
  _foreg: SkickForsaljningResultat,
  formData: FormData,
): Promise<SkickForsaljningResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const projektId = String(formData.get("projekt_id") ?? "");

  // Samma "0".."5"-tolkning som fraga 6 – formatet ar identiskt, bara
  // tidpunkten skiljer (produktspec 4.4, skickskalan).
  const skickForsaljning = tolkaSkickForvarv(
    String(formData.get("skick_forsaljning") ?? ""),
  );
  if (skickForsaljning === null) {
    return { fel: "Ange skicket vid försäljningen, 0–5." };
  }

  try {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { atgardstyp: true, skick_forsaljning: true },
    });
    if (!projekt) return { fel: "Åtgärden hittades inte." };
    if (projekt.atgardstyp !== "utbytt") {
      return { fel: "Den här åtgärden har ingen reparationsdel att bedöma." };
    }
    if (projekt.skick_forsaljning !== null) {
      return { fel: "Skicket vid försäljningen är redan bedömt för den här åtgärden." };
    }

    await prisma.projekt.update({
      where: { id: projektId },
      data: { skick_forsaljning: skickForsaljning },
    });
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, {
        sida: "forsaljning/skick",
        anrop: "sparaSkickForsaljning",
        anvandareId,
      }),
    };
  }

  revalideraSkickvyer(projektId);
  redirect("/forsaljning/skick");
}
