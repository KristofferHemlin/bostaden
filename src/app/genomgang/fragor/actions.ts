"use server";

// Klassificeringsgenomgangen, fas 2: for varje hog stalls de fyra fragorna EN
// gang (produktspec 6.2, "Klassificeringsgenomgangen"). Det ar forst har
// skatteterminologin blir relevant – da har anvandaren redan bestamt vad hogen
// ar i fas 1.
//
// En hog ar ett projekt med kategori = null. `klassificeraHog` satter kategorin
// och ovriga svar; darefter faller hogen ur fas 2:s lista. Redan klassificerade
// hogar ror vi inte har – de andras via projektets vanliga redigering (6.4).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  tolkaProjektfragor,
  type SlitetSvar,
} from "@/doman/projektfragor";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface FragorResultat {
  fel?: string;
}

export async function klassificeraHog(
  _foreg: FragorResultat,
  formData: FormData,
): Promise<FragorResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const projektId = String(formData.get("projekt_id") ?? "");
  const namn = String(formData.get("namn") ?? "").trim();
  const fanns = String(formData.get("fanns") ?? "");
  const slitet = String(formData.get("slitet") ?? "");
  const motivering = String(formData.get("motivering") ?? "").trim();

  if (!namn) return { fel: "Ge högen ett namn." };
  if (fanns !== "nytt" && fanns !== "fanns") {
    return { fel: "Svara på om det var nytt eller fanns förut." };
  }

  try {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { id: true, kategori: true, ar: true },
    });
    if (!projekt) return { fel: "Högen hittades inte." };
    if (projekt.kategori !== null) {
      return { fel: "Den högen är redan klassificerad." };
    }

    const { kategori, slitet_vid_tilltrade } = tolkaProjektfragor(
      fanns,
      slitet as SlitetSvar,
    );

    // Ar-etiketten sätts om till tidigaste betaldatum bland hogens kvitton, sa att
    // den stammer med det som faktiskt raknas. Allt som avgor tröskel och
    // femarsfonster utgar anda fran kostnadernas betaldatum, inte fran denna.
    const kopplade = await prisma.kostnad.findMany({
      where: {
        bostad_id: bostadId,
        betaldatum: { not: null },
        rader: { some: { fordelningar: { some: { projekt_id: projektId } } } },
      },
      select: { betaldatum: true },
    });
    const arKandidater = kopplade
      .map((k) => k.betaldatum?.getUTCFullYear())
      .filter((v): v is number => v !== undefined);
    const nyttAr =
      arKandidater.length > 0 ? Math.min(...arKandidater) : projekt.ar;

    await prisma.projekt.update({
      where: { id: projektId },
      data: {
        namn,
        ar: nyttAr,
        kategori,
        slitet_vid_tilltrade,
        motivering: motivering || null,
      },
    });
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, { sida: "genomgang/fragor", anrop: "klassificeraHog", anvandareId }),
    };
  }

  revalidatePath("/");
  revalidatePath("/genomgang");
  revalidatePath("/genomgang/fragor");
  revalidatePath("/projekt");
  revalidatePath("/projekt/[id]", "page");
  revalidatePath("/kostnad");
  revalidatePath("/export");
  redirect("/genomgang/fragor");
}
