"use server";

// Kompletteringssteget fore bilagepaketet (docs/produktspec.md avsnitt 8,
// "Ett kompletteringssteg ligger fore genereringen"). Ägarandel och
// tilltradesdatum ar harda krav och sparas har innan paketet byggs;
// identifiering ar mjuk och far lamnas tom. Ingen ny domanregel – falten
// sparas bara pa samma satt som installningssidan
// (src/app/installningar/actions.ts).
//
// Lyckas sparningen hamtas bilagepaketets data direkt (src/lib/bilagepaket/
// hamta.ts) i samma anrop, sa att klienten kan borja bygga PDF:en utan ett
// extra race mellan "sparat" och "hamtat".

import { serverfelMeddelande } from "@/lib/databas-fel";
import { hamtaBilagepaketdata, type BilagepaketResultat } from "@/lib/bilagepaket/hamta";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const TIDIGASTE_DATUM = "1970-01-01";

// Till skillnad fran installningssidans andelFranText ar faltet har ett hart
// krav (produktspec 8): tomt ar ett fel, inte "hela bostaden".
function agarandelFranText(text: string): number | undefined {
  const normaliserad = text.replace(/\s/g, "").replace(",", ".").replace(/%/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normaliserad)) return undefined;
  const varde = Number.parseFloat(normaliserad);
  return varde > 0 && varde <= 100 ? varde : undefined;
}

export async function skapaBilagepaket(
  _foreg: BilagepaketResultat,
  formData: FormData,
): Promise<BilagepaketResultat> {
  const { anvandareId, bostadId } = await kravBostad();

  const las = (nyckel: string) => String(formData.get(nyckel) ?? "").trim();

  const agarandel = agarandelFranText(las("agarandel"));
  if (agarandel === undefined) {
    return { ok: false, fel: "Ange ägarandelen i procent, t.ex. 100." };
  }

  const tilltradesdatum = las("tilltradesdatum");
  if (!DATUM.test(tilltradesdatum) || tilltradesdatum < TIDIGASTE_DATUM) {
    return { ok: false, fel: "Ange ett giltigt tillträdesdatum." };
  }

  const identifieringText = las("identifiering");
  const identifiering = identifieringText === "" ? null : identifieringText;

  try {
    await prisma.$transaction([
      prisma.bostad.update({
        where: { id: bostadId },
        data: {
          tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
          identifiering,
        },
      }),
      prisma.medlemskap.updateMany({
        where: { anvandare_id: anvandareId, bostad_id: bostadId },
        data: { agarandel },
      }),
    ]);

    return await hamtaBilagepaketdata(bostadId, agarandel);
  } catch (fel) {
    return {
      ok: false,
      fel: serverfelMeddelande(fel, { sida: "export/paket", anrop: "skapaBilagepaket", anvandareId }),
    };
  }
}
