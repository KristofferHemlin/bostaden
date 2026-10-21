"use server";

// Fragan om samma del av bostaden (CLAUDE.md, "Samma byggnadsdel reparerad
// två gånger"). Sparar svaret som markeringar pa projekten och som de
// kandidater fragan besvarades for. Kandidaterna raknas om har, ur samma
// berakning som underlaget – aldrig ur formularet, som kan vara inaktuellt.
//
// Att spara ar svaret, aven nar ingenting andrades: da ar svaret aktuellt
// igen for dagens kandidater (samma regel som for merkostnaden).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sammaDelSvarsfel } from "@/doman/samma-del";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { prisma } from "@/lib/prisma";
import { hamtaSammaDelVy } from "@/lib/samma-del-vy";
import { kravBostad } from "@/lib/session";

export interface SammaDelResultat {
  fel?: string;
}

export async function sparaSammaDel(
  _foreg: SammaDelResultat,
  formData: FormData,
): Promise<SammaDelResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const svar = String(formData.get("svar") ?? "");
  if (svar !== "ja" && svar !== "nej") {
    return { fel: "Svara ja eller nej." };
  }
  const ja = svar === "ja";
  const markerade = ja ? formData.getAll("markerad").map(String) : [];

  const sammanhang = {
    sida: "forsaljning/samma-del",
    anrop: "sparaSammaDel",
    anvandareId,
  };

  let vy;
  try {
    vy = await hamtaSammaDelVy(bostadId);
  } catch (fel) {
    return { fel: serverfelMeddelande(fel, sammanhang) };
  }
  // Inget svar kan andra ett tal langre (t.ex. en atgard har klassats om
  // sedan sidan oppnades): inget att spara, underlaget ar klart.
  if (!vy || vy.status === "visas_inte") redirect("/export");
  const kandidater = vy.kandidater.map((k) => k.id);

  const fel = sammaDelSvarsfel({ ja, markerade, kandidater });
  if (fel) return { fel };

  try {
    await prisma.$transaction([
      // Bara bostadens egna projekt. Markeringar som ligger kvar pa projekt
      // som inte langre ar kandidater tas bort – de nollar inget tal, men en
      // gammal markering ska inte vakna om forsaljningsdatumet andras igen.
      prisma.projekt.updateMany({
        where: { bostad_id: bostadId, id: { notIn: markerade }, tidigare_gang_samma_del: true },
        data: { tidigare_gang_samma_del: null },
      }),
      prisma.projekt.updateMany({
        where: { bostad_id: bostadId, id: { in: markerade } },
        // Ett svar som klassificeringen: det satter "Besvarat av"
        // (docs/design.md, "Samägande – medlemskapet").
        data: { tidigare_gang_samma_del: true, klassificerad_av: anvandareId },
      }),
      prisma.bostad.update({
        where: { id: bostadId },
        data: { samma_del_besvarad_for: kandidater },
      }),
    ]);
  } catch (fel) {
    return { fel: serverfelMeddelande(fel, sammanhang) };
  }

  revalidatePath("/export");
  revalidatePath("/forsaljning/samma-del");
  revalidatePath("/projekt", "layout");
  redirect("/export");
}
