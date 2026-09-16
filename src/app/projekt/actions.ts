"use server";

// Steg 6.4: rattning i efterhand for ett befintligt projekt. Sjalva skapandet
// sker inte via nagon egen sida langre (rutten /projekt/nytt ar borttagen) utan
// i klassificeringsgenomgangen och i kostnadsformularet.
//
// Fragetradet (produktspec 4.1) fraga 1-6 och fraga 8 tolkas av den delade
// hjalparen tolkaFragetradetFormData – samma tolkning som genomgangens fas 2
// anvander, sa en omklassificering aldrig kan glida isar fran hur hogen
// klassificerades forsta gangen.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { tolkaFragetradetFormData } from "@/lib/fragetradet-formdata";
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

// Omklassificering andrar atgardstyp/battre_kvalitet/merkostnad/skick_forvarv,
// vilket slaar igenom i arets troskelsumma sa fort vyerna revalideras – inget
// lagras harlett. skick_forsaljning ror vi aldrig har; det satts bara i
// src/app/forsaljning/skick.
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

  const tolkat = tolkaFragetradetFormData(formData);
  if ("fel" in tolkat) return tolkat;

  await prisma.projekt.update({
    where: { id },
    data: {
      namn: tolkat.namn,
      atgardstyp: tolkat.atgardstyp,
      battre_kvalitet: tolkat.battre_kvalitet,
      merkostnad: tolkat.merkostnad,
      skick_forvarv: tolkat.skick_forvarv,
      motivering: tolkat.motivering,
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
