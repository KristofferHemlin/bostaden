"use server";

// Steg 7: markera bostaden som sald. `forsaljningsdatum` ar ankaret for
// femarsfonstret och skickbedomningen – exportens sida 2 kan inte raknas ut
// innan dess (sida 1 och exportvyn i ovrigt fungerar anda, se
// src/app/export/page.tsx).
//
// Fraga 7 (skick_forsaljning per reparation) satts inte har utan i
// src/app/forsaljning/skick. Dit gar redirecten nedan efter att datumet
// sparats – via bekraftelsen av agarandelen (src/app/forsaljning/andel) nar
// den egna andelen annu inte ar bekraftad.
//
// Flodet far inte blockera. Datum kravs for att exporten alls ska ga att
// skapa, men priset far lamnas tomt.

import { redirect } from "next/navigation";
import { lasAndel } from "@/lib/andelar";
import { isoDatum, oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { arAndelenBekraftad } from "@/lib/samagande";
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
  const { bostadId, anvandareId } = await kravBostad();

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
  if (forsaljningsdatum > isoDatum(new Date())) {
    return { fel: "Försäljningsdatum kan inte ligga i framtiden." };
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

  // Forst agarandelen, om den inte redan ar bekraftad (docs/design.md, "Att
  // bjuda in en delägare"): efter datum och pris, fore skickfragorna. Steget
  // gar vidare till skickfragorna sjalvt (src/app/forsaljning/andel).
  const medlemskap = await prisma.medlemskap.findFirst({
    where: { bostad_id: bostadId, anvandare_id: anvandareId },
    select: { agarandel: true, bekraftad_andel: true },
  });
  const bekraftad =
    medlemskap !== null &&
    arAndelenBekraftad(lasAndel(medlemskap.agarandel), lasAndel(medlemskap.bekraftad_andel));
  if (!bekraftad) redirect("/forsaljning/andel");

  // Fraga 7 stalls direkt (produktspec 4.1, CLAUDE.md "Vid markering som
  // sald"). Sidan sjalv hoppar vidare till /export om inget behover bedomas.
  redirect("/forsaljning/skick");
}
