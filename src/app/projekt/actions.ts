"use server";

// Projektets server-actions: skapandet (produktspec 2b, "Projektet, och
// frågorna" – projektet skapas direkt, och kvittona hamtas till det) och
// rattning i efterhand (produktspec 6.4). Klassificeringsgenomgangens fas 2
// skapar inga projekt; den klassificerar hogar som fas 1 lagt ihop.
//
// Fragetradet (produktspec 4.1) fraga 1-6 och fraga 8 tolkas av den delade
// hjalparen tolkaFragetradetFormData – samma tolkning som genomgangens fas 2
// anvander, sa en omklassificering aldrig kan glida isar fran hur hogen
// klassificerades forsta gangen.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import { tolkaSkickForvarv } from "@/doman/fragetradet";
import { beloppOmKopplade, kvittoGarAttKoppla } from "@/doman/kvittokoppling";
import { hamtaProjektetsBelopp, tillDomanKostnad } from "@/lib/doman-fran-db";
import { tolkaBostadsdelar } from "@/doman/bostadsdel";
import { serverfelMeddelande } from "@/lib/databas-fel";
import { arGiltigtId } from "@/lib/giltigt-id";
import { kopplaKvittonTillProjekt } from "@/lib/kvittokoppling";
import { sparaBostadsdelar } from "@/lib/bostadsdel-lagring";
import {
  tolkaFragetradetFormData,
  type FragetradetFaltnamn,
} from "@/lib/fragetradet-formdata";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface ProjektResultat {
  fel?: string;
  /** Fragan felet galler, nar det galler en – visas dar i stallet for
   *  ovanfor knappen (docs/design.md, "Nar ett formular vagrar"). */
  falt?: FragetradetFaltnamn;
}

function revalideraProjektvyer(projektId: string): void {
  revalidatePath("/");
  revalidatePath("/projekt");
  revalidatePath(`/projekt/${projektId}`);
  revalidatePath("/kostnad");
  revalidatePath("/kostnad/[id]", "page");
  revalidatePath("/export");
}

export interface SkapaProjektResultat extends ProjektResultat {
  /** Projektets id nar det sparats. Formularet tar da bort sitt utkast och
   *  gar till projektet – en redirect harifran hade inte latit det stada. */
  skapat?: string;
}

/** Ett valt kvitto hann kopplas nagon annanstans medan fragorna besvarades. */
class KvittonaHannAndras extends Error {}

/**
 * Skapar ett projekt med namn, bostadsdel, fragetradets svar och de kvitton
 * som horde hit – allt i en transaktion (docs/design.md, "Att skapa ett
 * projekt"). Det ar hela skalet till att ingenting sparas forran har: ett
 * projekt utan namn eller utan svar kan inte uppsta, och dar ett sadant en
 * gang uppstod (genomgangens hog mellan fas 1 och fas 2) visades det fel pa
 * fyra stallen (CLAUDE.md, "Tillståndet mellan två steg").
 *
 * Bostadsfragorna krävs inte: de stalls vid forsaljningen (produktspec 4.1)
 * och ror inget av det som sparas har.
 *
 * Kvittovalet ar frivilligt. Merkostnaden provas mot det de valda kvittona
 * bidrar med (beloppOmKopplade). Ett projekt utan kvitton har beloppet 0, och
 * da skjuts merkostnadsfragan upp: projektet sparas som battre kvalitet med
 * merkostnaden obesvarad, och en upplysning bar det tills ett kvitto kopplats
 * (docs/design.md, "Att skapa ett projekt"; tolkaFragetradetFormData).
 */
export async function skapaProjekt(
  _foreg: SkapaProjektResultat,
  formData: FormData,
): Promise<SkapaProjektResultat> {
  const { bostadId, anvandareId } = await kravBostad();

  const kostnadIder = [
    ...new Set(formData.getAll("kostnad_ider").map(String).filter(arGiltigtId)),
  ];
  const valda = (
    await prisma.kostnad.findMany({
      where: { id: { in: kostnadIder }, bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    })
  ).filter((k) => kvittoGarAttKoppla(tillDomanKostnad(k)));

  const belopp = beloppOmKopplade(valda.map(tillDomanKostnad));
  const tolkat = tolkaFragetradetFormData(formData, { belopp });
  if ("fel" in tolkat) return tolkat;
  const bostadsdelar = tolkaBostadsdelar(formData);

  // Ar-etiketten ar tidigaste betaldatum bland kvittona, som nar en hog
  // klassificeras; utan betalt kvitto aret i dag. Allt som raknas utgar anda
  // fran kostnadernas betaldatum, inte fran den har.
  const arKandidater = valda.flatMap((k) =>
    k.betaldatum ? [k.betaldatum.getUTCFullYear()] : [],
  );
  const ar =
    arKandidater.length > 0 ? Math.min(...arKandidater) : new Date().getUTCFullYear();

  let projektId: string;
  try {
    projektId = await prisma.$transaction(async (tx) => {
      const projekt = await tx.projekt.create({
        data: {
          bostad_id: bostadId,
          namn: tolkat.namn,
          ar,
          atgardstyp: tolkat.atgardstyp,
          battre_kvalitet: tolkat.battre_kvalitet,
          merkostnad: tolkat.merkostnad,
          merkostnad_bas: tolkat.merkostnad !== null ? belopp : null,
          skick_forvarv: tolkat.skick_forvarv,
          motivering: tolkat.motivering,
          klassificerad_av: anvandareId,
        },
        select: { id: true },
      });
      await sparaBostadsdelar(tx, projekt.id, bostadsdelar);
      const kopplade = await kopplaKvittonTillProjekt(
        tx,
        bostadId,
        projekt.id,
        valda.map((k) => k.id),
      );
      // Beloppet ovan – och darmed merkostnadens grans och bas – raknades pa
      // just de har kvittona. Hann nagot av dem kopplas nagon annanstans
      // stammer det inte langre, och da sparas ingenting.
      if (kopplade.length !== valda.length) throw new KvittonaHannAndras();
      return projekt.id;
    });
  } catch (fel) {
    if (fel instanceof KvittonaHannAndras) {
      return {
        fel: "Ett av kvittona hann kopplas till ett annat projekt medan du svarade. Ladda om sidan och välj kvittona igen.",
      };
    }
    return {
      fel: serverfelMeddelande(fel, { sida: "projekt/nytt", anrop: "skapaProjekt", anvandareId }),
    };
  }

  revalideraProjektvyer(projektId);
  return { skapat: projektId };
}

// Omklassificering andrar atgardstyp/battre_kvalitet/merkostnad/skick_forvarv,
// vilket slaar igenom i arets troskelsumma sa fort vyerna revalideras – inget
// lagras harlett.
//
// skick_forsaljning (fraga 7) satts har bara nar bostaden ar sald. Har stod
// forut att faltet aldrig rors har, eftersom fragan stalls forst i
// forsaljningsflodet – fore forsaljningen finns inget att svara om, och det
// skalet galler fortfarande. Men flodet fragar bara om obesvarade atgarder,
// sa ett feltryck dar gick inte att rata nagonstans: varje tillstand appen
// kan hamna i ska ha en vag ut (CLAUDE.md). Redigeringen ar den vagen.
export async function redigeraProjekt(
  _foreg: ProjektResultat,
  formData: FormData,
): Promise<ProjektResultat> {
  // Bostadsfragorna kravs inte: att ratta ett projekt under agandet har
  // ingenting med bostadens egenskaper att gora, och fragorna stalls vid
  // forsaljningen (produktspec 4.1). Till 2026-11-13 skickade en spärr har
  // till /genomgang/fragor.
  const { bostadId, anvandareId } = await kravBostad();
  const id = String(formData.get("projekt_id") ?? "");

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true, atgardstyp: true },
  });
  if (!projekt) return { fel: "Projektet hittades inte." };

  // Ett projekt utan svar ar skapat fore omlaggningen. Nar svaren ges sats
  // arsetiketten till tidigaste betaldatum bland kvittona, som den gamla
  // genomgangen gjorde (docs/design.md, "Projekt som skapades före
  // omläggningen"). Ett projekt som redan har svar behaller sin etikett.
  let nyttAr: number | undefined;
  if (projekt.atgardstyp === null) {
    const betalda = await prisma.kostnad.findMany({
      where: {
        bostad_id: bostadId,
        betaldatum: { not: null },
        rader: { some: { fordelningar: { some: { projekt_id: id } } } },
      },
      select: { betaldatum: true },
    });
    const ar = betalda.flatMap((k) => (k.betaldatum ? [k.betaldatum.getUTCFullYear()] : []));
    if (ar.length > 0) nyttAr = Math.min(...ar);
  }

  // Fraga 7: bara nar faltet skickats, bostaden ar sald och atgarden har en
  // reparationsdel. Ett tomt falt lamnar vardet orort – en obesvarad fraga
  // besvaras i forsaljningsflodet, och ett svar tas aldrig bort harifran.
  const skickText = formData.get("skick_forsaljning");
  let skickForsaljning: number | undefined;
  if (skickText !== null && String(skickText) !== "") {
    const bostad = await prisma.bostad.findUniqueOrThrow({
      where: { id: bostadId },
      select: { forsaljningsdatum: true },
    });
    if (bostad.forsaljningsdatum !== null) {
      const tolkatSkick = tolkaSkickForvarv(String(skickText));
      if (tolkatSkick === null) return { fel: "Ange skicket vid försäljningen, 0–5." };
      skickForsaljning = tolkatSkick;
    }
  }

  // Projektets belopp: merkostnaden maste vara mindre (CLAUDE.md, steg 2).
  // Att spara svaret – aven oforandrat – ar att bekrafta det: beloppet sparas
  // pa nytt, och en tidigare upplysning om att projektet andrats forsvinner.
  const belopp = await hamtaProjektetsBelopp(bostadId, id);
  const tolkat = tolkaFragetradetFormData(formData, { belopp });
  if ("fel" in tolkat) return tolkat;

  const bostadsdelar = tolkaBostadsdelar(formData);

  // Utan belopp stalls merkostnadsfragan inte (docs/design.md, "Att skapa ett
  // projekt"), och tolkningen ger den obesvarad. Ett svar som redan finns –
  // givet nar projektet hade kvitton – ska da sta kvar, inte nollas av att
  // hon rattar nagot annat: taket och upplysningen bar det tills fragan
  // stalls igen (CLAUDE.md, "Spärren och taket").
  const merkostnadOrord = belopp === 0 && tolkat.battre_kvalitet === true;

  await prisma.$transaction(async (tx) => {
    await tx.projekt.update({
      where: { id },
      data: {
        namn: tolkat.namn,
        ...(nyttAr !== undefined ? { ar: nyttAr } : {}),
        atgardstyp: tolkat.atgardstyp,
        battre_kvalitet: tolkat.battre_kvalitet,
        ...(merkostnadOrord
          ? {}
          : {
              merkostnad: tolkat.merkostnad,
              merkostnad_bas: tolkat.merkostnad !== null ? belopp : null,
            }),
        skick_forvarv: tolkat.skick_forvarv,
        ...(skickForsaljning !== undefined && tolkat.atgardstyp === "utbytt"
          ? { skick_forsaljning: skickForsaljning }
          : {}),
        motivering: tolkat.motivering,
        klassificerad_av: anvandareId,
      },
    });
    // Bostadsdelen (docs/design.md, "Vilken del av bostaden projektet
    // rörde"): frivillig, och ror inga tal.
    await sparaBostadsdelar(tx, id, bostadsdelar);
  });

  revalideraProjektvyer(id);
  redirect(`/projekt/${id}`);
}

// Ett projekt med kopplade kostnader far inte tas bort forran de flyttats eller
// kopplats loss – annars avklassificeras de tyst via cascaden pa radfordelning.
// Sidan visar listan pa vad som blockerar; har ar det bara den sista grinden.
export async function taBortProjekt(
  _foreg: ProjektResultat,
  formData: FormData,
): Promise<ProjektResultat> {
  const { bostadId } = await kravBostad();
  const id = String(formData.get("projekt_id") ?? "");

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
    select: { id: true },
  });
  if (!projekt) return { fel: "Projektet hittades inte." };

  const kostnadRader = await prisma.kostnad.findMany({
    where: { bostad_id: bostadId },
    include: { rader: { include: { fordelningar: true } } },
  });
  const blockerande = kostnaderKoppladeTillProjekt(
    kostnadRader.map(tillDomanKostnad),
    id,
  );
  if (blockerande.length > 0) {
    return {
      fel: "Projektet har kvitton kopplade. Flytta eller koppla loss dem först.",
    };
  }

  await prisma.projekt.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/projekt");
  revalidatePath("/kostnad");
  revalidatePath("/kostnad/[id]", "page");
  revalidatePath("/export");
  redirect("/projekt");
}
