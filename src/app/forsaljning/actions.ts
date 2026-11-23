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

import { redirect } from "next/navigation";
import { idagISverige } from "@/lib/datum";
import { forsaljningsdatumFel } from "./validering";
import { isoDatum, oreFranKronor } from "@/lib/format";
import { nastaSidaIForsaljningen } from "@/lib/forsaljningsflode";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface ForsaljningResultat {
  fel?: string;
  /** Faltet felet galler – meningen visas vid det (docs/design.md, "När ett formulär vägrar"). */
  falt?: "forsaljningsdatum" | "forsaljningspris";
}

export async function markeraSald(
  _foreg: ForsaljningResultat,
  formData: FormData,
): Promise<ForsaljningResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { tilltradesdatum: true },
  });
  const tilltrade = isoDatum(bostad.tilltradesdatum);

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
