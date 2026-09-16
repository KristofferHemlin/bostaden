"use server";

// Steg 7: markera bostaden som sald. `forsaljningsdatum` ar ankaret for
// femarsfonstret och skickbedomningen – exportens sida 2 kan inte raknas ut
// innan dess (sida 1 och exportvyn i ovrigt fungerar anda, se
// src/app/export/page.tsx).
//
// Fraga 7 (skick_forsaljning per reparation) satts inte har utan i
// src/app/forsaljning/skick – dit gar redirecten nedan direkt efter att
// datumet sparats.
//
// Flodet far inte blockera. Datum kravs for att exporten alls ska ga att
// skapa, men priset far lamnas tomt.

import { redirect } from "next/navigation";
import { isoDatum, oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface ForsaljningResultat {
  fel?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const TIDIGASTE_DATUM = "1970-01-01";

export async function markeraSald(
  _foreg: ForsaljningResultat,
  formData: FormData,
): Promise<ForsaljningResultat> {
  const { bostadId } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { tilltradesdatum: true },
  });
  const tilltrade = isoDatum(bostad.tilltradesdatum);

  const forsaljningsdatum = String(formData.get("forsaljningsdatum") ?? "").trim();
  const prisText = String(formData.get("forsaljningspris") ?? "").trim();

  if (!DATUM.test(forsaljningsdatum)) {
    return { fel: "Fyll i försäljningsdatum." };
  }
  if (forsaljningsdatum < TIDIGASTE_DATUM) {
    return { fel: "Försäljningsdatum före 1970 stöds inte." };
  }
  if (forsaljningsdatum < tilltrade) {
    return {
      fel: `Försäljningsdatum kan inte ligga före tillträdet (${tilltrade}).`,
    };
  }

  // oreFranKronor ger ett heltal (number) som ar exakt for alla realistiska
  // belopp; kolumnen ar BigInt, sa vardet gors om till bigint fore skrivningen.
  let forsaljningsprisOren: number | null = null;
  if (prisText !== "") {
    forsaljningsprisOren = oreFranKronor(prisText);
    if (forsaljningsprisOren === null || forsaljningsprisOren <= 0) {
      return { fel: "Försäljningspriset går inte att tolka. Lämna tomt eller ange t.ex. 3 450 000." };
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

  // Fraga 7 stalls direkt (produktspec 4.1, CLAUDE.md "Vid markering som
  // sald"). Sidan sjalv hoppar vidare till /export om inget behover bedomas.
  redirect("/forsaljning/skick");
}
