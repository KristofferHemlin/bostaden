"use server";

// Steg 7: markera bostaden som sald. `forsaljningsdatum` ar ankaret for
// femarsfonstret och skickbedomningen – exportens sida 2 kan inte raknas ut
// innan dess (sida 1 och exportvyn i ovrigt fungerar anda, se
// src/app/export/page.tsx).
//
// Efter datumet gar flodet vidare i den ordning som src/doman/
// forsaljningsflode.ts haller: bostadsfragorna, skicket vid forsaljningen,
// samma del, agarandelen, underlaget.
//
// Flodet far inte blockera. Datum kravs for att exporten alls ska ga att
// skapa, men priset far lamnas tomt.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { idagISverige } from "@/lib/datum";
import { forsaljningsdatumFel } from "./validering";
import { sparadDag, oreFranKronor } from "@/lib/format";
import { nastaSidaIForsaljningen } from "@/lib/forsaljningsflode";
import { prisma } from "@/lib/prisma";
import type { Underlagsbesked } from "@/lib/underlagsbesked";
import { arBekraftat, underlagsbeskedVidAndring } from "@/lib/underlagsbesked-server";
import { kravBostad } from "@/lib/session";

export interface ForsaljningResultat {
  fel?: string;
  /** Faltet felet galler – meningen visas vid det (docs/design.md, "När ett formulär vägrar"). */
  falt?: "forsaljningsdatum" | "forsaljningspris";
  /** Ett andrat forsaljningsdatum flyttar underlaget och ar inte bekraftat:
   *  ingenting ar sparat (docs/design.md, "Beskedet när ett värde ändrar
   *  vilka kvitton som räknas"). */
  underlag?: Underlagsbesked;
}

export async function markeraSald(
  _foreg: ForsaljningResultat,
  formData: FormData,
): Promise<ForsaljningResultat> {
  const { bostadId, anvandareId, agarandel: egenAndel } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { tilltradesdatum: true, forsaljningsdatum: true },
  });
  const tilltrade = sparadDag(bostad.tilltradesdatum);

  const forsaljningsdatum = String(formData.get("forsaljningsdatum") ?? "").trim();
  const prisText = String(formData.get("forsaljningspris") ?? "").trim();

  // Samma regler och meningar som formularet (./validering.ts).
  const datumfel = forsaljningsdatumFel(forsaljningsdatum, idagISverige());
  if (datumfel) return { fel: datumfel, falt: "forsaljningsdatum" };
  if (forsaljningsdatum < tilltrade) {
    return {
      fel: `Försäljningsdatum kan inte ligga före tillträdet (${tilltrade}).`,
      falt: "forsaljningsdatum",
    };
  }

  // oreFranKronor ger ett heltal (number) som ar exakt for alla realistiska
  // belopp; kolumnen ar BigInt, sa vardet gors om till bigint fore skrivningen.
  let forsaljningsprisOren: number | null = null;
  if (prisText !== "") {
    forsaljningsprisOren = oreFranKronor(prisText);
    if (forsaljningsprisOren === null || forsaljningsprisOren <= 0) {
      return {
        fel: "Försäljningspriset går inte att tolka. Lämna tomt eller ange t.ex. 3 450 000.",
        falt: "forsaljningspris",
      };
    }
  }
  const forsaljningspris =
    forsaljningsprisOren === null ? null : BigInt(forsaljningsprisOren);

  // Ett datum som andras EFTER forsaljningen flyttar femarsfonstret, och det
  // sags innan det sparas. Den forsta registreringen ar forsaljningen sjalv –
  // dar ar det underlaget hon ska se, inte ett besked om det.
  if (bostad.forsaljningsdatum !== null) {
    const besked = await underlagsbeskedVidAndring(bostadId, egenAndel, {
      forsaljningsdatum: new Date(`${forsaljningsdatum}T00:00:00.000Z`),
    });
    if (besked && !arBekraftat(formData, besked)) return { underlag: besked };
  }

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      forsaljningsdatum: new Date(`${forsaljningsdatum}T00:00:00.000Z`),
      forsaljningspris,
    },
  });

  // Vidare till forsta steget som galler bostaden (src/doman/
  // forsaljningsflode.ts): bostadsfragorna om de ar obesvarade, sedan
  // skicket, samma del, andelen och underlaget (produktspec 4.1).
  redirect(await nastaSidaIForsaljningen(bostadId, anvandareId, "datum"));
}

export interface AngraResultat {
  fel?: string;
}

/**
 * "Bostaden är inte såld" (docs/design.md, "En försäljning går att ta
 * bort"). Beslutat av Kristoffer 2026-11-27: en markering som sald gick inte
 * att ta tillbaka, och ett felklick, ett test eller en affar som sprack lamnade
 * bostaden sald for gott.
 *
 * Allt som sparades for forsaljningen tas bort, och bara det: datum och pris,
 * skicket vid forsaljningen och svaret om samma del pa varje projekt, vilka
 * projekt samma del-fragan besvarades for, och varje delagares bekraftade
 * andel – sa att alla bekraftar pa nytt om bostaden markeras som sald igen.
 * Agarandelen, bostadsfragorna, kvitton och projekt rors inte. Allt i en
 * transaktion: en halvt borttagen forsaljning vore en bostad som ar sald pa
 * ett stalle och inte pa ett annat.
 */
export async function angraForsaljningen(
  _foreg: AngraResultat,
  _formData: FormData,
): Promise<AngraResultat> {
  const { bostadId } = await kravBostad();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.bostad.update({
        where: { id: bostadId },
        data: { forsaljningsdatum: null, forsaljningspris: null, samma_del_besvarad_for: [] },
      });
      await tx.projekt.updateMany({
        where: { bostad_id: bostadId },
        data: { skick_forsaljning: null, tidigare_gang_samma_del: null },
      });
      await tx.medlemskap.updateMany({
        where: { bostad_id: bostadId },
        data: { bekraftad_andel: null },
      });
    });
  } catch {
    return { fel: "Försäljningen gick inte att ta bort. Försök igen." };
  }
  revalidatePath("/");
  revalidatePath("/export");
  revalidatePath("/installningar");
  revalidatePath("/forsaljning");
  redirect("/forsaljning");
}
