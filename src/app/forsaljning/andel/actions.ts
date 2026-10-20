"use server";

// Bekraftelsen av agarandelen vid forsaljningen (docs/design.md, "Att bjuda in
// en delägare"). Varje medlem bekraftar sin egen andel – forifylld med den
// lagrade, och gar att andra i samma steg. Provningen mot de andras ar
// densamma som i Forvarvet, men utan undantaget for en sankning av en for hog
// summa: en bekraftad andel ingar i en summa som gar ihop (src/lib/egen-andel.ts).
//
// Bara andelen. Anskaffningsdatum och inkopspris hor till vinstberakningen,
// som appen inte gor – ingenting i berakningen laser dem, och att fraga efter
// dem vore att be om arbete som inte blir till nagot.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agarandelFel, agarandelFranText } from "@/lib/agarandel";
import { skrivEgenAndel } from "@/lib/egen-andel";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { NASTA_SIDA, nastaFran } from "./nasta";

export interface BekraftaAndelResultat {
  fel?: string;
  falt?: "agarandel";
}

export async function bekraftaAndel(
  _foreg: BekraftaAndelResultat,
  formData: FormData,
): Promise<BekraftaAndelResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { forsaljningsdatum: true },
  });
  // Steget hor till forsaljningen – innan den finns ar andelen ett utgangsvarde.
  if (bostad.forsaljningsdatum === null) redirect("/forsaljning");

  const text = String(formData.get("agarandel") ?? "");
  const agarandel = agarandelFranText(text);
  if (agarandel === undefined) {
    return { fel: agarandelFel(text) ?? "Ange ägarandelen i procent.", falt: "agarandel" };
  }

  const fel = await prisma.$transaction(
    (tx) => skrivEgenAndel(tx, { bostadId, anvandareId, agarandel, bekrafta: true }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (fel) return { fel, falt: "agarandel" };

  revalidatePath("/export");
  revalidatePath("/installningar");
  redirect(NASTA_SIDA[nastaFran(formData.get("nasta"))]);
}
