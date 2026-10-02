"use server";

// Vaxlaren (docs/design.md, "Att äga flera bostäder"). Bytet skriver valet pa
// anvandaren och leder till oversikten – aldrig till sidan man stod pa, som
// kan visa nagot som inte finns i den andra bostaden.
//
// Valet ar en preferens, aldrig en behorighet: medlemskapet i den valda
// bostaden provas har, och hamtaAktivBostad provar det igen vid varje
// sidladdning. Bostadens id kommer fran klienten och ar darfor bara ett
// onskemal tills medlemskapet bekraftat det.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { arGiltigtId } from "@/lib/giltigt-id";
import { prisma } from "@/lib/prisma";
import { type Bostadsval, hamtaAktivBostad, kravBostad } from "@/lib/session";

export interface BytBostadResultat {
  fel?: string;
}

export async function bytBostad(
  _foreg: BytBostadResultat,
  formData: FormData,
): Promise<BytBostadResultat> {
  const { anvandareId } = await kravBostad();
  const bostadId = String(formData.get("bostad_id") ?? "");
  if (!arGiltigtId(bostadId)) return { fel: "Bostaden hittades inte." };

  try {
    const medlemskap = await prisma.medlemskap.findUnique({
      where: { anvandare_id_bostad_id: { anvandare_id: anvandareId, bostad_id: bostadId } },
      select: { id: true },
    });
    if (!medlemskap) return { fel: "Bostaden hittades inte." };

    await prisma.anvandare.update({
      where: { id: anvandareId },
      data: { aktiv_bostad_id: bostadId },
    });
  } catch (fel) {
    return { fel: serverfelMeddelande(fel, { sida: "bostadsval", anrop: "bytBostad", anvandareId }) };
  }

  // Hela appen: toppraden ligger i rot-layouten och varje sida visar den
  // aktiva bostaden.
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Listan som den ser ut just nu, nar vaxlaren oppnas. Rot-layouten renderas
 * inte om vid navigering inom appen, och valet ligger pa anvandaren – en annan
 * flik kan ha bytt sedan sidan laddades. Utan den har fragan kunde listan
 * markera en annan bostad som aktiv an den toppraden visar.
 */
export async function hamtaBostadsval(): Promise<{ aktivId: string; bostader: Bostadsval[] } | null> {
  const aktiv = await hamtaAktivBostad();
  return aktiv ? { aktivId: aktiv.bostadId, bostader: aktiv.bostader } : null;
}
