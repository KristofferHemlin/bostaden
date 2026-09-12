"use server";

// Steg 5 + produktspec 2b + 6.1 + avsnittet "Dokumentavlasning" + docs/design.md
// ("Inmatningen staller inga skattefragor"). Manuell kostnadsinmatning: fem falt
// – bilaga, belopp, datum, leverantor och den valfria anteckningen "Vad gallde
// det?" – plus ROT-raden. Inga skattefragor, ingen kategori, inget projekt
// skapas har – klassificeringen gors i en egen genomgang.
//
// UTKAST. Nar anvandaren valjer en fil i formularet skapas kostnaden direkt som
// ett utkast (skapaUtkast) – en kostnad utan belopp – och filen laddas upp till
// sin riktiga plats. Sparningen (sparaKostnad) UPPDATERAR da utkastet i stallet
// for att skapa nagot nytt. Valjs ingen fil skapar sparningen en ny kostnad som
// vanligt. Avbryter anvandaren ligger kvittot kvar som ett utkast – det rensas
// aldrig automatiskt.
//
// Ingen projektkoppling och ingen uppdelning sker har (docs/produktspec.md 6.1).
// Klassificeringen hor till genomgangen och raduppdelningen till kvittots
// detaljvy – bada gors i efterhand nar anvandaren sjalv vill. Sparningen skapar
// alltid EN rad pa hela totalbeloppet, med leverantoren som artikelnamn
// (produktspec 5: "En rad skapas alltid").
//
// Aret bestams av betaldatum, aldrig av dokumentdatum. En kostnad utan
// betaldatum sparas anda (obetald, raknas inte in) – inga floden far blockera.

import { revalidatePath } from "next/cache";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface KostnadResultat {
  fel?: string;
  /** Satt nar kostnaden sparats. Formularet gar da vidare till startskarmen.
   *  Blir ocksa vagen tillbaka till kostnaden om en bilaga inte gick att ladda
   *  upp. */
  kostnadId?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01. En kostnad
// med betaldatum fore dess avvisas har i stallet for att berakningen kastar fel.
const TIDIGASTE_BETALDATUM = "1970-01-01";

function revalideraKostnadsvyer(): void {
  revalidatePath("/");
  revalidatePath("/kostnad");
  revalidatePath("/genomgang");
  revalidatePath("/projekt");
  revalidatePath("/projekt/[id]", "page");
  revalidatePath("/export");
}

/**
 * Skapar en tom kostnad – ett UTKAST – och lamnar tillbaka dess id. Anropas nar
 * anvandaren valjer den forsta filen i formularet, sa att filen har en riktig
 * plats att laddas upp till (nyckeln byggs av kostnadens id). Ett utkast har
 * inget belopp, ingen leverantor och inget datum; det syns i listan och i
 * genomgangen men raknas inte in nagonstans och rensas aldrig automatiskt.
 */
export async function skapaUtkast(): Promise<{ kostnadId?: string; fel?: string }> {
  const { bostadId, anvandareId } = await kravBostad();
  try {
    const skapad = await prisma.kostnad.create({
      data: {
        bostad_id: bostadId,
        leverantor: null,
        totalbelopp: null,
        dokumentdatum: null,
      },
      select: { id: true },
    });
    revalidatePath("/");
    revalidatePath("/kostnad");
    revalidatePath("/genomgang");
    return { kostnadId: skapad.id };
  } catch (fel) {
    // Utan ett utkast finns ingen plats att ladda upp bilagan till – filvalet
    // fungerar da inte alls. Formularet maste fa veta det (src/app/kostnad/
    // nytt/form.tsx, sakerstallUtkast) i stallet for att tyst hanga sig.
    return {
      fel: serverfelMeddelande(fel, { sida: "kostnad/nytt", anrop: "skapaUtkast", anvandareId }),
    };
  }
}

type Tolkad =
  | { fel: string }
  | {
      leverantor: string;
      totalbelopp: number;
      dok: Date;
      bet: Date | null;
      anteckning: string | null;
      rotUtnyttjat: number | null;
    };

/** Ett belopp som anvandaren kan ha lamnat tomt eller pa noll blir null. */
function positivtEllerNull(varde: number | null): number | null {
  return varde !== null && varde > 0 ? varde : null;
}

/** Delad falttolkning for bade "skapa ny" och "slutfor utkast". */
function tolkaKostnadsformular(formData: FormData): Tolkad {
  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const beloppText = String(formData.get("totalbelopp") ?? "");
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "");
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const anteckning = String(formData.get("anteckning") ?? "").trim();

  // ROT-avdraget (docs/design.md, "ROT-avdrag"). Ett enda falt, far lamnas tomt,
  // anges i kronor. Det ar det enda som paverkar underlaget av det en
  // entreprenorsfaktura bar – arbets- och materialuppdelning efterfragas inte.
  const rotUtnyttjat = positivtEllerNull(
    oreFranKronor(String(formData.get("rot_utnyttjat") ?? "")),
  );

  if (!leverantor) return { fel: "Fyll i leverantör." };

  const totalbelopp = oreFranKronor(beloppText);
  if (totalbelopp === null || totalbelopp <= 0) {
    return { fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95." };
  }

  // ROT-beloppet ar en del av totalbeloppet – ett varde over det ar en
  // felskrivning. Blockerar inte flodet, anvandaren rattar bara talet.
  if (rotUtnyttjat !== null && rotUtnyttjat > totalbelopp) {
    return {
      fel: "ROT-avdraget kan inte vara större än totalbeloppet.",
    };
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

  return {
    leverantor,
    totalbelopp,
    dok: new Date(`${dokumentdatum}T00:00:00.000Z`),
    bet: betaldatum ? new Date(`${betaldatum}T00:00:00.000Z`) : null,
    anteckning: anteckning || null,
    rotUtnyttjat,
  };
}

// En kostnad fran inmatningen far alltid EXAKT en rad pa hela totalbeloppet, med
// leverantoren som artikelnamn (produktspec 5: "En rad skapas alltid"). Ingen
// fordelning – kopplingen till en gruppering gors i genomgangen och
// raduppdelningen pa kvittots detaljvy, bada i efterhand.
function enRadSkapa(leverantor: string, totalbelopp: number) {
  return { create: [{ artikel: leverantor, belopp: totalbelopp }] };
}

/**
 * Sparar kostnaden. Bar formularet ett `utkast_id` UPPDATERAS det utkastet
 * (kvittot valdes tidigare och laddades upp da); annars skapas en ny kostnad.
 */
export async function sparaKostnad(
  formData: FormData,
): Promise<KostnadResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const utkastId = String(formData.get("utkast_id") ?? "").trim();

  const tolkad = tolkaKostnadsformular(formData);
  if ("fel" in tolkad) return { fel: tolkad.fel };
  const { leverantor, totalbelopp, dok, bet, anteckning, rotUtnyttjat } = tolkad;

  // Sparningen far ALDRIG kasta okontrollerat har: kvittots bilaga ligger redan
  // uppladdad och kopplad till utkastet – ett kastat fel skulle bara lamna
  // formularet hangande utan besked (produktspec avsnitt 13, punkt 2).
  try {
    if (utkastId !== "") {
      const utkast = await prisma.kostnad.findFirst({
        where: { id: utkastId, bostad_id: bostadId },
        select: { id: true, totalbelopp: true },
      });
      if (!utkast) return { fel: "Utkastet hittades inte." };
      if (utkast.totalbelopp !== null) {
        // Redan slutfort (t.ex. dubbelt inskick) – inget nytt skapas.
        return { kostnadId: utkast.id };
      }

      await prisma.$transaction([
        prisma.kostnadsrad.deleteMany({ where: { kostnad_id: utkastId } }),
        prisma.kostnad.update({
          where: { id: utkastId },
          data: {
            leverantor,
            totalbelopp,
            dokumentdatum: dok,
            betaldatum: bet,
            anteckning,
            rot_utnyttjat: rotUtnyttjat,
            rader: enRadSkapa(leverantor, totalbelopp),
          },
        }),
      ]);
      revalideraKostnadsvyer();
      return { kostnadId: utkastId };
    }

    const skapad = await prisma.kostnad.create({
      data: {
        bostad_id: bostadId,
        leverantor,
        totalbelopp,
        dokumentdatum: dok,
        betaldatum: bet,
        anteckning,
        rot_utnyttjat: rotUtnyttjat,
        rader: enRadSkapa(leverantor, totalbelopp),
      },
      select: { id: true },
    });
    revalideraKostnadsvyer();
    return { kostnadId: skapad.id };
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, { sida: "kostnad/nytt", anrop: "sparaKostnad", anvandareId }),
      // Bilagan ligger redan uppladdad pa utkastet – lamna kvar vagen dit sa
      // att anvandaren kan oppna kvittot och forsoka spara pa nytt, i stallet
      // for att behova fotografera om det.
      kostnadId: utkastId || undefined,
    };
  }
}
