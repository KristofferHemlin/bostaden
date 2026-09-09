"use server";

// Installningssidan (docs/design.md, "Installningssidan"). Allt som beskriver
// bostaden men inte behovs for att komma igang: storlek, kopeskilling,
// kopkostnader, agarandel och – bara for bostadsratt – kapitaltillskott.
// Kopeskillingen gar att ange redan i registreringens bostadssteg; den som
// hoppade over den dar fyller i den har. Alla falt ar valfria. Tomt falt
// nollstaller vardet (agarandel tolkas dock som hela bostaden, 100 %).

import { revalidatePath } from "next/cache";
import { oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface InstallningarResultat {
  fel?: string;
  meddelande?: string;
}

// Positivt heltal antal kvadratmeter, eller null vid tomt falt. Returnerar
// undefined nar texten inte gar att tolka.
function storlekFranText(text: string): number | null | undefined {
  if (text === "") return null;
  const siffror = text.replace(/\D/g, "");
  const varde = siffror ? Number.parseInt(siffror, 10) : 0;
  return varde > 0 ? varde : undefined;
}

// Belopp i oren som BigInt, eller null vid tomt falt. Returnerar undefined nar
// texten inte gar att tolka som ett positivt belopp.
function beloppFranText(text: string): bigint | null | undefined {
  if (text === "") return null;
  const oren = oreFranKronor(text);
  if (oren === null || oren <= 0) return undefined;
  return BigInt(oren);
}

// Agarandel i procent (Decimal(5,2) i schemat). Tomt falt betyder att
// anvandaren ager hela bostaden, alltsa 100. Returnerar undefined nar texten
// inte gar att tolka eller ligger utanfor 0–100.
function andelFranText(text: string): number | undefined {
  if (text === "") return 100;
  const normaliserad = text.replace(/\s/g, "").replace(",", ".").replace(/%/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normaliserad)) return undefined;
  const varde = Number.parseFloat(normaliserad);
  return varde > 0 && varde <= 100 ? varde : undefined;
}

export async function sparaInstallningar(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { anvandareId, bostadId } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true },
  });
  const arBostadsratt = bostad.upplatelseform === "bostadsratt";

  const las = (nyckel: string) => String(formData.get(nyckel) ?? "").trim();

  const storlek = storlekFranText(las("storlek"));
  if (storlek === undefined) {
    return { fel: "Storlek anges i kvadratmeter, t.ex. 72." };
  }

  const kopeskilling = beloppFranText(las("kopeskilling"));
  if (kopeskilling === undefined) {
    return { fel: "Köpeskilling anges som ett belopp, t.ex. 3 250 000." };
  }

  const kopkostnader = beloppFranText(las("kopkostnader"));
  if (kopkostnader === undefined) {
    return { fel: "Köpkostnader anges som ett belopp, t.ex. 45 000." };
  }

  // Kapitaltillskott finns bara for bostadsratt (docs/produktspec.md 4.8) –
  // falt visas inte for fastighet och lases da inte in.
  let kapitaltillskott: bigint | null | undefined = undefined;
  if (arBostadsratt) {
    kapitaltillskott = beloppFranText(las("kapitaltillskott"));
    if (kapitaltillskott === undefined) {
      return { fel: "Kapitaltillskott anges som ett belopp, t.ex. 60 000." };
    }
  }

  const agarandel = andelFranText(las("agarandel"));
  if (agarandel === undefined) {
    return { fel: "Ägarandel anges som ett tal mellan 1 och 100 procent, t.ex. 50." };
  }

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      storlek,
      kopeskilling,
      kopkostnader,
      ...(arBostadsratt ? { kapitaltillskott } : {}),
    },
  });

  // Agarandelen tillhor relationen person–bostad, inte bostaden (CLAUDE.md).
  await prisma.medlemskap.updateMany({
    where: { anvandare_id: anvandareId, bostad_id: bostadId },
    data: { agarandel },
  });

  revalidatePath("/installningar");
  revalidatePath("/");
  return { meddelande: "Sparat." };
}
