"use server";

// Steg 4: skapa projekt via de fyra fragorna (produktspec 6.2). Fragorna stalls
// EN gang per projekt, aldrig per kvitto, och pa vanlig svenska – anvandaren ska
// aldrig behova veta vad en grundforbattring heter.
//
//   1. Vad gjorde du?                         -> namn (fritext)
//   2. Fanns det forut, eller ar det nytt?    -> nytt => grundforbattring
//   3. Var det slitet nar du FLYTTADE IN?     -> slitet_vid_tilltrade
//   4. Har du nagot som visar det?            -> motivering (blockerar aldrig)
//
// baslinjepost och bilagor hor till etapp B (steg 13). Utan baslinjepost blir
// harledd underlagsstyrka "svagt", precis som seed-projektet "Mala sovrum".

import { redirect } from "next/navigation";
import {
  tolkaProjektfragor,
  type SlitetSvar,
} from "@/doman/projektfragor";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface ProjektResultat {
  fel?: string;
}

export async function skapaProjekt(
  _foreg: ProjektResultat,
  formData: FormData,
): Promise<ProjektResultat> {
  const { bostadId } = await kravBostad();

  const namn = String(formData.get("namn") ?? "").trim();
  const fanns = String(formData.get("fanns") ?? ""); // "nytt" | "fanns"
  const slitet = String(formData.get("slitet") ?? ""); // "ja" | "nej" | "vet-inte"
  const motivering = String(formData.get("motivering") ?? "").trim();

  if (!namn) return { fel: "Skriv vad du gjorde." };
  if (fanns !== "nytt" && fanns !== "fanns") {
    return { fel: "Svara på om det var nytt eller fanns förut." };
  }

  // Fraga 3 stalls bara nar det fanns forut; for en grundforbattring blir
  // slitet_vid_tilltrade alltid null aven om ett svar rakar folja med.
  const { kategori, slitet_vid_tilltrade } = tolkaProjektfragor(
    fanns,
    slitet as SlitetSvar,
  );

  const projekt = await prisma.projekt.create({
    data: {
      bostad_id: bostadId,
      namn,
      // Etikett for gruppering. Auktoritativt ar kommer fran betaldatum.
      ar: new Date().getUTCFullYear(),
      kategori,
      slitet_vid_tilltrade,
      motivering: motivering || null,
    },
  });

  redirect(`/projekt/${projekt.id}`);
}
