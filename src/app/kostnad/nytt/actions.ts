"use server";

// Steg 5: manuell kostnadsinmatning. Belopp, datum, leverantor, koppling till
// projekt. Entreprenorsgrenen (ROT, arbets-/materialkostnad) och raduppdelning
// hor till etapp B – har skapas alltid EN rad pa hela totalbeloppet med
// artikelnamnet satt till leverantoren (produktspec 5: "En rad skapas alltid").
//
// Aret bestams av betaldatum, aldrig av dokumentdatum. En kostnad utan betaldatum
// sparas anda (obetald, raknas inte in) – inga floden far blockera.
//
// Steg 9: valfria bilagor laddas upp EFTER att kostnaden sparats och bekraftas
// mot Storage innan flodet gar vidare till kostnadssidan. En fil utan bilaga ar
// inget fel; en misslyckad uppladdning blockerar inte (kostnaden ar redan
// sparad) utan ger ett meddelande och en lank for att forsoka igen.

import { redirect } from "next/navigation";
import { laddaUppKostnadsbilaga } from "@/lib/lagring/bilagor";
import { oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface KostnadResultat {
  fel?: string;
  /** Satt nar kostnaden sparades men en bilaga inte gick att ladda upp – ger
   *  formularet en vag vidare till kostnaden for att forsoka igen. */
  kostnadId?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01. En kostnad
// med betaldatum fore dess avvisas har i stallet for att berakningen kastar fel.
const TIDIGASTE_BETALDATUM = "1970-01-01";

export async function skapaKostnad(
  _foreg: KostnadResultat,
  formData: FormData,
): Promise<KostnadResultat> {
  const { bostadId } = await kravBostad();

  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const beloppText = String(formData.get("totalbelopp") ?? "");
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "");
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const projektId = String(formData.get("projekt_id") ?? "").trim();

  if (!leverantor) return { fel: "Fyll i leverantör." };

  const totalbelopp = oreFranKronor(beloppText);
  if (totalbelopp === null || totalbelopp <= 0) {
    return { fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95." };
  }
  if (!DATUM.test(dokumentdatum)) {
    return { fel: "Fyll i kvittots datum." };
  }
  if (betaldatum !== "") {
    if (!DATUM.test(betaldatum)) return { fel: "Betaldatum har fel format." };
    if (betaldatum < TIDIGASTE_BETALDATUM) {
      return { fel: "Betaldatum före 1970 stöds inte." };
    }
  }

  let kopplatProjekt: string | null = null;
  if (projektId !== "") {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { id: true },
    });
    if (!projekt) return { fel: "Det valda projektet finns inte." };
    kopplatProjekt = projekt.id;
  }

  const skapad = await prisma.kostnad.create({
    data: {
      bostad_id: bostadId,
      leverantor,
      totalbelopp,
      dokumentdatum: new Date(`${dokumentdatum}T00:00:00.000Z`),
      betaldatum: betaldatum
        ? new Date(`${betaldatum}T00:00:00.000Z`)
        : null,
      rader: {
        create: {
          artikel: leverantor,
          belopp: totalbelopp,
          fordelningar: kopplatProjekt
            ? { create: { projekt_id: kopplatProjekt, privat: false, andel: 1 } }
            : undefined,
        },
      },
    },
    select: { id: true },
  });

  // Bilagor bekraftas alltid mot Storage innan flodet gar vidare. Misslyckas en
  // uppladdning ar kostnaden anda sparad (inga floden far blockera) – anvandaren
  // far ett meddelande och en lank for att forsoka igen fran kostnaden, och
  // filen ligger kvar i formularets input tills dess.
  const filer = formData
    .getAll("bilagor")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const fil of filer) {
    const resultat = await laddaUppKostnadsbilaga({
      bostadId,
      kostnadId: skapad.id,
      fil,
    });
    if (!resultat.ok) {
      return {
        fel: `Kostnaden sparades, men ${fil.name || "en bilaga"} kunde inte laddas upp: ${resultat.fel ?? "okänt fel."}`,
        kostnadId: skapad.id,
      };
    }
  }

  redirect(`/kostnad/${skapad.id}`);
}
