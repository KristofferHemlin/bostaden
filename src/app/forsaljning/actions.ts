"use server";

// Steg 7: markera bostaden som sald. `forsaljningsdatum` ar ankaret for
// femarsfonstret och forslitningen – exportens sida 2 kan inte raknas ut innan
// dess (sida 1 och exportvyn i ovrigt fungerar anda, se src/app/export/page.tsx).
// I samma veva satts de tva projektuppgifter som ocksa ar null fram till
// forsaljningen:
//
//   - battre_skick_vid_forsaljning : bekraftas av anvandaren nu (produktspec 4.1)
//   - kvarvarande_andel            : forslitningens kvarvarande del (produktspec 4.5)
//
// Bada galler bara reparationer – grundforbattringar har varken skick-provning
// eller forslitning (docs/k6a-faltlista.md avsnitt 4). Ingen ny domanregel har:
// falten matas bara in, berakningen bor kvar i src/doman.
//
// Flodet far inte blockera. Datum kravs for att exporten alls ska ga att skapa,
// men skick och andel far lamnas tomma och sparas da som null (open post).

import { redirect } from "next/navigation";
import { andelFranProcent, isoDatum, oreFranKronor } from "@/lib/format";
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

  // Reparationsprojekten hamtas fran DB – klientens id:n valideras darmed mot
  // agarskapet. Grundforbattringar ror vi inte.
  const reparationer = await prisma.projekt.findMany({
    where: { bostad_id: bostadId, kategori: "reparation" },
    select: { id: true },
  });

  const projektUppdateringar = [];
  for (const p of reparationer) {
    const battreVal = String(formData.get(`battre_${p.id}`) ?? "");
    const kvarText = String(formData.get(`kvar_${p.id}`) ?? "");

    const battre_skick_vid_forsaljning =
      battreVal === "ja" ? true : battreVal === "nej" ? false : null;

    let kvarvarande_andel: number | null = null;
    if (kvarText.trim() !== "") {
      kvarvarande_andel = andelFranProcent(kvarText);
      if (kvarvarande_andel === null) {
        return {
          fel: "Kvarvarande andel anges i procent, 0–100 (t.ex. 80). Lämna tomt om du inte vet än.",
        };
      }
    }

    projektUppdateringar.push(
      prisma.projekt.update({
        where: { id: p.id },
        data: { battre_skick_vid_forsaljning, kvarvarande_andel },
      }),
    );
  }

  await prisma.$transaction([
    prisma.bostad.update({
      where: { id: bostadId },
      data: {
        forsaljningsdatum: new Date(`${forsaljningsdatum}T00:00:00.000Z`),
        forsaljningspris,
      },
    }),
    ...projektUppdateringar,
  ]);

  redirect("/export");
}
