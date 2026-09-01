"use server";

// Bilagor pa en befintlig kostnad: lagg till och ta bort. Uppladdningen
// bekraftas mot Storage innan resultatet returneras (produktspec 12) – vid fel
// slapper klienten aldrig filen ur input-faltet. Radering sker bara pa
// uttrycklig begaran, aldrig automatiskt.

import { revalidatePath } from "next/cache";
import {
  laddaUppKostnadsbilaga,
  taBortBilaga,
} from "@/lib/lagring/bilagor";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface BilagaResultat {
  ok?: boolean;
  fel?: string;
}

export async function laddaUppBilagor(
  _foreg: BilagaResultat,
  formData: FormData,
): Promise<BilagaResultat> {
  const { bostadId } = await kravBostad();
  const kostnadId = String(formData.get("kostnad_id") ?? "");

  const kostnad = await prisma.kostnad.findFirst({
    where: { id: kostnadId, bostad_id: bostadId },
    select: { id: true },
  });
  if (!kostnad) return { fel: "Kostnaden hittades inte." };

  const filer = formData
    .getAll("bilagor")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (filer.length === 0) return { fel: "Välj minst en fil att ladda upp." };

  for (const fil of filer) {
    const resultat = await laddaUppKostnadsbilaga({
      bostadId,
      kostnadId,
      fil,
    });
    if (!resultat.ok) {
      return {
        fel: `${fil.name || "Filen"}: ${resultat.fel ?? "uppladdningen misslyckades."}`,
      };
    }
  }

  revalidatePath(`/kostnad/${kostnadId}`);
  return { ok: true };
}

export async function taBortBilagaAction(
  _foreg: BilagaResultat,
  formData: FormData,
): Promise<BilagaResultat> {
  const { anvandareId } = await kravBostad();
  const bilagaId = String(formData.get("bilaga_id") ?? "");
  const kostnadId = String(formData.get("kostnad_id") ?? "");

  const resultat = await taBortBilaga(bilagaId, anvandareId);
  if (!resultat.ok) {
    return { fel: resultat.fel ?? "Kunde inte ta bort bilagan." };
  }

  revalidatePath(`/kostnad/${kostnadId}`);
  return { ok: true };
}
