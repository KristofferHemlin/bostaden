"use server";

// Steg 3: skapa bostad. Obligatoriskt vid registrering ar ENDAST upplatelseform
// och tilltradesdatum (produktspec 5). Allt annat gar att fylla i senare.
// Onboardingen ska vara avbrytbar – darfor inga fler krav an dessa tva.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { kravAnvandare } from "@/lib/session";

export interface OnboardingResultat {
  fel?: string;
}

const GILTIGA_FORMER = new Set(["bostadsratt", "fastighet"]);

export async function skapaBostad(
  _foreg: OnboardingResultat,
  formData: FormData,
): Promise<OnboardingResultat> {
  const anvandare = await kravAnvandare();

  const namn = String(formData.get("namn") ?? "").trim();
  const upplatelseform = String(formData.get("upplatelseform") ?? "");
  const tilltradesdatum = String(formData.get("tilltradesdatum") ?? "");

  if (!GILTIGA_FORMER.has(upplatelseform)) {
    return { fel: "Välj bostadsrätt eller fastighet." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tilltradesdatum)) {
    return { fel: "Fyll i tillträdesdatum." };
  }
  if (tilltradesdatum < "1970-01-01") {
    return { fel: "Tillträdesdatum före 1970 stöds inte." };
  }

  await prisma.bostad.create({
    data: {
      namn: namn || null,
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
      medlemskap: {
        create: { anvandare_id: anvandare.id, agarandel: 100 },
      },
    },
  });

  redirect("/");
}
