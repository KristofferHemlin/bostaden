"use server";

// Steg 6.4: rattning i efterhand for ett befintligt projekt. Sjalva skapandet
// sker inte via nagon egen sida langre (rutten /projekt/nytt ar borttagen) utan
// i klassificeringsgenomgangen och i kostnadsformularet.
//
// De fyra fragorna (produktspec 6.2), pa vanlig svenska:
//
//   1. Vad gjorde du?                      -> namn (fritext)
//   2. Fanns det forut, eller ar det nytt? -> nytt => grundforbattring
//   3. Var det slitet nar du FLYTTADE IN?  -> slitet_vid_tilltrade
//   4. Hur vet du det?                     -> motivering (fritext, blockerar aldrig)

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import { tolkaProjektfragor, type SlitetSvar } from "@/doman/projektfragor";
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

// Omklassificering (fraga 2/3) andrar `kategori` och `slitet_vid_tilltrade`,
// vilket slaar igenom i arets troskelsumma sa fort vyerna revalideras – inget
// lagras harlett. Fraga 4:s fritext (`motivering`) ar det enda som bar
// bevisningen.
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

  if (!namn) return { fel: "Skriv vad du gjorde." };
  if (fanns !== "nytt" && fanns !== "fanns") {
    return { fel: "Svara på om det var nytt eller fanns förut." };
  }

  const { kategori, slitet_vid_tilltrade } = tolkaProjektfragor(
    fanns,
    slitet as SlitetSvar,
  );

  await prisma.projekt.update({
    where: { id },
    data: {
      namn,
      kategori,
      slitet_vid_tilltrade,
      motivering: motivering || null,
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
