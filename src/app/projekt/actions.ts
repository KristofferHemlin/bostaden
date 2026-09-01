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

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import {
  tolkaProjektfragor,
  type SlitetSvar,
} from "@/doman/projektfragor";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface ProjektResultat {
  fel?: string;
}

function revalideraProjektvyer(projektId: string): void {
  revalidatePath("/");
  revalidatePath("/projekt");
  revalidatePath(`/projekt/${projektId}`);
  revalidatePath("/kostnad");
  revalidatePath("/kostnad/[id]", "page");
  revalidatePath("/export");
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

// Steg 6.4: rattning i efterhand. Andra namn, de fyra fragornas svar och
// kopplingen till baslinjepost. Omklassificering (fraga 2/3) andrar `kategori`
// och `slitet_vid_tilltrade`, vilket slaar igenom i arets troskelsumma sa fort
// vyerna revalideras – inget lagras harlett.
export async function redigeraProjekt(
  _foreg: ProjektResultat,
  formData: FormData,
): Promise<ProjektResultat> {
  const { bostadId } = await kravBostad();
  const id = String(formData.get("projekt_id") ?? "");

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true },
  });
  if (!projekt) return { fel: "Projektet hittades inte." };

  const namn = String(formData.get("namn") ?? "").trim();
  const fanns = String(formData.get("fanns") ?? "");
  const slitet = String(formData.get("slitet") ?? "");
  const motivering = String(formData.get("motivering") ?? "").trim();
  const baslinjepostId = String(formData.get("baslinjepost_id") ?? "").trim();

  if (!namn) return { fel: "Skriv vad du gjorde." };
  if (fanns !== "nytt" && fanns !== "fanns") {
    return { fel: "Svara på om det var nytt eller fanns förut." };
  }

  const { kategori, slitet_vid_tilltrade } = tolkaProjektfragor(
    fanns,
    slitet as SlitetSvar,
  );

  let kopplatBaslinjepost: string | null = null;
  if (baslinjepostId !== "") {
    const baslinjepost = await prisma.baslinjepost.findFirst({
      where: { id: baslinjepostId, bostad_id: bostadId },
      select: { id: true },
    });
    if (!baslinjepost) return { fel: "Den valda baslinjeposten finns inte." };
    kopplatBaslinjepost = baslinjepost.id;
  }

  await prisma.projekt.update({
    where: { id },
    data: {
      namn,
      kategori,
      slitet_vid_tilltrade,
      motivering: motivering || null,
      baslinjepost_id: kopplatBaslinjepost,
    },
  });

  revalideraProjektvyer(id);
  redirect(`/projekt/${id}`);
}

// Ett projekt med kopplade kostnader far inte tas bort forran de flyttats eller
// kopplats loss – annars avklassificeras de tyst via cascaden pa radfordelning.
// Sidan visar listan pa vad som blockerar; har ar det bara den sista grinden.
export async function taBortProjekt(
  _foreg: ProjektResultat,
  formData: FormData,
): Promise<ProjektResultat> {
  const { bostadId } = await kravBostad();
  const id = String(formData.get("projekt_id") ?? "");

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true },
  });
  if (!projekt) return { fel: "Projektet hittades inte." };

  const kostnadRader = await prisma.kostnad.findMany({
    where: { bostad_id: bostadId },
    include: { rader: { include: { fordelningar: true } } },
  });
  const blockerande = kostnaderKoppladeTillProjekt(
    kostnadRader.map(tillDomanKostnad),
    id,
  );
  if (blockerande.length > 0) {
    return {
      fel: "Projektet har kopplade kostnader. Flytta eller koppla loss dem först.",
    };
  }

  await prisma.projekt.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/projekt");
  revalidatePath("/kostnad");
  revalidatePath("/kostnad/[id]", "page");
  revalidatePath("/export");
  redirect("/projekt");
}
