"use server";

// Steg 5 + produktspec 2b + avsnittet "Dokumentavlasning" + docs/design.md
// ("Inmatningen staller inga skattefragor", "Uppdelning av kvitto vid
// inmatning"). Manuell kostnadsinmatning: belopp, datum, leverantor och den
// valfria anteckningen "Vad gallde det?". Inga skattefragor, ingen kategori,
// inget projekt skapas har – klassificeringen gors i en egen genomgang.
//
// UTKAST. Nar anvandaren valjer en fil i formularet skapas kostnaden direkt som
// ett utkast (skapaUtkast) – en kostnad utan belopp – och filen laddas upp till
// sin riktiga plats. Sparningen (sparaKostnad) UPPDATERAR da utkastet i stallet
// for att skapa nagot nytt. Valjs ingen fil skapar sparningen en ny kostnad som
// vanligt. Avbryter anvandaren ligger kvittot kvar som ett utkast – det rensas
// aldrig automatiskt.
//
// Projektkoppling ar en genvag, inte vagen in. `projekt_id` (om satt) kopplar
// kostnaden till en BEFINTLIG gruppering. Nya grupperingar skapas inte harifran.
//
// Uppdelning. "Var nagot pa kvittot privat?" faller ut rader i samma formular.
// Inga procenttal: en rad ar antingen privat (rad_privat) eller sparas mot
// malet. Utan uppdelning skapas EN rad pa hela totalbeloppet, med artikelnamnet
// satt till leverantoren (produktspec 5: "En rad skapas alltid"). Med uppdelning
// gar samma vag som steg 10:s dela-sida via tolkaUppdelning – summan av radernas
// belopp maste vara lika med totalbeloppet.
//
// Aret bestams av betaldatum, aldrig av dokumentdatum. En kostnad utan
// betaldatum sparas anda (obetald, raknas inte in) – inga floden far blockera.

import { revalidatePath } from "next/cache";
import { oreFranKronor } from "@/lib/format";
import {
  inlineUppdelningTillIndata,
  tolkaUppdelning,
  type InlineUppdelningsrad,
} from "@/lib/kostnadsuppdelning";
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
export async function skapaUtkast(): Promise<{ kostnadId: string }> {
  const { bostadId } = await kravBostad();
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
}

interface RadUtkast {
  artikel: string;
  belopp: number;
  fordelningar: { projekt_id: string | null; privat: boolean; andel: number }[];
}

type Tolkad =
  | { fel: string }
  | {
      leverantor: string;
      totalbelopp: number;
      dok: Date;
      bet: Date | null;
      anteckning: string | null;
      rader: RadUtkast[];
    };

/** Delad falt- och radtolkning for bade "skapa ny" och "slutfor utkast". */
async function tolkaKostnadsformular(
  formData: FormData,
  bostadId: string,
): Promise<Tolkad> {
  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const beloppText = String(formData.get("totalbelopp") ?? "");
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "");
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const anteckning = String(formData.get("anteckning") ?? "").trim();
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

  // Kopplingen ar valfri och bara till en BEFINTLIG gruppering (genvag langst ned
  // i formularet). Ingen koppling = okopplad kostnad, vilket far vara.
  let befintligtProjektId: string | null = null;
  if (projektId !== "") {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { id: true },
    });
    if (!projekt) {
      return { fel: "Det du valde att koppla kostnaden till finns inte längre." };
    }
    befintligtProjektId = projekt.id;
  }

  const malForRader = befintligtProjektId ?? "";
  const harKoppling = befintligtProjektId !== null;

  const radArtiklar = formData.getAll("rad_artikel").map(String);
  const radBelopp = formData.getAll("rad_belopp").map(String);
  const radPrivat = formData.getAll("rad_privat").map(String);
  const harUppdelning = radArtiklar.length > 0;

  let rader: RadUtkast[];
  if (harUppdelning) {
    const inlineRader: InlineUppdelningsrad[] = radArtiklar.map((artikel, i) => ({
      artikel,
      belopp: radBelopp[i] ?? "",
      privat: (radPrivat[i] ?? "") !== "",
    }));
    const tolkad = tolkaUppdelning(
      inlineUppdelningTillIndata(inlineRader, malForRader),
      totalbelopp,
    );
    if ("fel" in tolkad) return { fel: tolkad.fel };
    rader = tolkad.rader.map((r) => ({
      artikel: r.artikel,
      belopp: r.belopp,
      fordelningar: r.fordelningar,
    }));
  } else {
    rader = [
      {
        artikel: leverantor,
        belopp: totalbelopp,
        fordelningar: harKoppling
          ? [{ projekt_id: malForRader, privat: false, andel: 1 }]
          : [],
      },
    ];
  }

  return {
    leverantor,
    totalbelopp,
    dok: new Date(`${dokumentdatum}T00:00:00.000Z`),
    bet: betaldatum ? new Date(`${betaldatum}T00:00:00.000Z`) : null,
    anteckning: anteckning || null,
    rader,
  };
}

function raderSkapa(rader: RadUtkast[]) {
  return {
    create: rader.map((rad) => ({
      artikel: rad.artikel,
      belopp: rad.belopp,
      fordelningar: rad.fordelningar.length
        ? {
            create: rad.fordelningar.map((f) => ({
              projekt_id: f.projekt_id,
              privat: f.privat,
              andel: f.andel,
            })),
          }
        : undefined,
    })),
  };
}

/**
 * Sparar kostnaden. Bar formularet ett `utkast_id` UPPDATERAS det utkastet
 * (kvittot valdes tidigare och laddades upp da); annars skapas en ny kostnad.
 */
export async function sparaKostnad(
  formData: FormData,
): Promise<KostnadResultat> {
  const { bostadId } = await kravBostad();
  const utkastId = String(formData.get("utkast_id") ?? "").trim();

  const tolkad = await tolkaKostnadsformular(formData, bostadId);
  if ("fel" in tolkad) return { fel: tolkad.fel };
  const { leverantor, totalbelopp, dok, bet, anteckning, rader } = tolkad;

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
          rader: raderSkapa(rader),
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
      rader: raderSkapa(rader),
    },
    select: { id: true },
  });
  revalideraKostnadsvyer();
  return { kostnadId: skapad.id };
}
