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
import { tolkaSkickForvarv } from "@/doman/fragetradet";
import { hamtaProjektetsBelopp, tillDomanKostnad } from "@/lib/doman-fran-db";
import { kravBostadsfragorBesvarade } from "@/lib/bostadsfragor-sparr";
import {
  tolkaFragetradetFormData,
  type FragetradetFaltnamn,
} from "@/lib/fragetradet-formdata";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface ProjektResultat {
  fel?: string;
  /** Fragan felet galler, nar det galler en – visas dar i stallet for
   *  ovanfor knappen (docs/design.md, "Nar ett formular vagrar"). */
  falt?: FragetradetFaltnamn;
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
// lagras harlett.
//
// skick_forsaljning (fraga 7) satts har bara nar bostaden ar sald. Har stod
// forut att faltet aldrig rors har, eftersom fragan stalls forst i
// forsaljningsflodet – fore forsaljningen finns inget att svara om, och det
// skalet galler fortfarande. Men flodet fragar bara om obesvarade atgarder,
// sa ett feltryck dar gick inte att rata nagonstans: varje tillstand appen
// kan hamna i ska ha en vag ut (CLAUDE.md). Redigeringen ar den vagen.
export async function redigeraProjekt(
  _foreg: ProjektResultat,
  formData: FormData,
): Promise<ProjektResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  await kravBostadsfragorBesvarade(bostadId);
  const id = String(formData.get("projekt_id") ?? "");

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true },
  });
  if (!projekt) return { fel: "Projektet hittades inte." };

  // Fraga 7: bara nar faltet skickats, bostaden ar sald och atgarden har en
  // reparationsdel. Ett tomt falt lamnar vardet orort – en obesvarad fraga
  // besvaras i forsaljningsflodet, och ett svar tas aldrig bort harifran.
  const skickText = formData.get("skick_forsaljning");
  let skickForsaljning: number | undefined;
  if (skickText !== null && String(skickText) !== "") {
    const bostad = await prisma.bostad.findUniqueOrThrow({
      where: { id: bostadId },
      select: { forsaljningsdatum: true },
    });
    if (bostad.forsaljningsdatum !== null) {
      const tolkatSkick = tolkaSkickForvarv(String(skickText));
      if (tolkatSkick === null) return { fel: "Ange skicket vid försäljningen, 0–5." };
      skickForsaljning = tolkatSkick;
    }
  }

  // Projektets belopp: merkostnaden maste vara mindre (CLAUDE.md, steg 2).
  // Att spara svaret – aven oforandrat – ar att bekrafta det: beloppet sparas
  // pa nytt, och en tidigare upplysning om att projektet andrats forsvinner.
  const belopp = await hamtaProjektetsBelopp(bostadId, id);
  const tolkat = tolkaFragetradetFormData(formData, { belopp });
  if ("fel" in tolkat) return tolkat;

  await prisma.projekt.update({
    where: { id },
    data: {
      namn: tolkat.namn,
      atgardstyp: tolkat.atgardstyp,
      battre_kvalitet: tolkat.battre_kvalitet,
      merkostnad: tolkat.merkostnad,
      merkostnad_bas: tolkat.merkostnad !== null ? belopp : null,
      skick_forvarv: tolkat.skick_forvarv,
      ...(skickForsaljning !== undefined && tolkat.atgardstyp === "utbytt"
        ? { skick_forsaljning: skickForsaljning }
        : {}),
      motivering: tolkat.motivering,
      klassificerad_av: anvandareId,
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
      fel: "Projektet har kvitton kopplade. Flytta eller koppla loss dem först.",
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
