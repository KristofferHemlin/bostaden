"use server";

// Installningssidan (docs/design.md, "Installningssidan"): fyra kort, varav tva
// med uppgifter som andras har – Bostaden och Forvarvet – och tva FRISTAENDE
// server actions, en per kort. (Tillgang andras via inbjudan,
// src/app/inbjudan/actions.ts; Ditt konto har inga uppgifter.) Sparas
// Bostaden far Forvarvet aldrig roras, inte ens med ett standardvarde for ett falt som inte
// skickades med. Det har ar den viktigaste punkten i hela sidan: samma fel
// har funnits forut, dar EN gemensam sparning for hela sidan tyst kunde satta
// bostadsfragor_besvarade till sant nar vilken installning som helst
// sparades. (Undantaget ar ett byte av upplatelseform, som nollstaller
// flaggan till false – se sparaBostaden.) Losningen ar strukturell, inte en extra kontroll – varje action
// skriver ENDAST de falt som hor till dess eget kort i `data`-objektet, och
// Prisma rör aldrig ett falt som inte star dar.
//
// Korten ar indelade efter vem uppgiften handlar om, inte vad den beskriver.
// Bostaden beskriver objektet. Forvarvet beskriver hur bostaden blev nagons:
// tilltradesdatum, kopeskilling, kopkostnader, agarandelen, forsta agaren och
// ombildningen – den sista star bredvid sitt villkor. Bara agarandelen ligger
// pa medlemskapet; de ovriga ligger pa bostaden och delas av alla som har
// tillgang.
//
// Upplatelseform och tilltradesdatum satts vid registreringen och visas
// medvetet inte i toppraden, men maste ga att se och andra har – tilltrades-
// datumet ar baslinjen for hela skickbedomningen. Bada ar OBLIGATORISKA.
//
// Upplatelseformen gar att byta fram till forsaljningen, aldrig efter
// (produktspec 4.8). Klienten later ett byte kraeva en bekraftelse och lasar
// kortet nar bostaden ar sald, men den kontrollen ar bara UX – servern nekar
// har ocksa ett byte nar forsaljningsdatum finns, oavsett vad formularet
// faktiskt skickar.

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  lagringAvBostadsfragor,
  lagringVidBytAvUpplatelseform,
  tolkaBostadsfragesvar,
} from "@/doman/bostadsfragor";
import { agarandelFranText } from "@/lib/agarandel";
import { allaAndelar, hamtaAndelar } from "@/lib/andelar";
import { andelssummaVidAndring, summeraAndelar } from "@/lib/samagande";
import { isoDatum, oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { tolkaGeokod } from "@/app/registrera/koordinater";
import { adressfel } from "@/app/registrera/validering";

export interface InstallningarResultat {
  fel?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function las(formData: FormData, nyckel: string): string {
  return String(formData.get(nyckel) ?? "").trim();
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

function revalideraBostadssidor() {
  revalidatePath("/installningar");
  revalidatePath("/");
  // Tilltradesdatum ar baslinjen for fraga 3 och femarsfonstret, och
  // upplatelseform styr blankettnamnet – bada paverkar dessa sidor.
  revalidatePath("/genomgang");
  revalidatePath("/genomgang/fragor");
  revalidatePath("/export");
}

/**
 * Kortet Bostaden: adress, ort, upplatelseform, identifiering, storlek och
 * kapitaltillskott. Skriver ENDAST dessa falt pa `bostad`.
 *
 * Kapitaltillskott finns bara for bostadsratt – ett falt som uteblir, inte ett
 * kort som forsvinner. Det foljer upplatelseformen i SAMMA sparning: byts
 * formen till fastighet nollstalls det, oavsett vad formularet skulle raka
 * innehalla.
 */
export async function sparaBostaden(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { bostadId } = await kravBostad();

  const upplatelseform = las(formData, "upplatelseform");
  if (upplatelseform !== "bostadsratt" && upplatelseform !== "fastighet") {
    return { fel: "Välj bostadsrätt eller villa/radhus." };
  }

  const storlek = storlekFranText(las(formData, "storlek"));
  if (storlek === undefined) {
    return { fel: "Storlek anges i kvadratmeter, t.ex. 72." };
  }

  // Upplatelseformen ar last efter forsaljning (produktspec 4.8): ett byte da
  // skulle gora ett redan framtaget underlag och en redan vald blankett osann
  // i efterhand. Kontrolleras HAR, inte bara i granssnittet, eftersom
  // formularet alltid skickar med hela sitt varde – aven nar kortet ar last
  // och anvandaren inte kunnat andra det.
  const bostadNu = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true, forsaljningsdatum: true },
  });
  if (bostadNu.forsaljningsdatum && upplatelseform !== bostadNu.upplatelseform) {
    return {
      fel: "Upplåtelseformen går inte att ändra efter försäljningen – underlaget är framtaget och blanketten vald.",
    };
  }

  // Adressen ar obligatorisk overallt dar den satts (docs/design.md,
  // Registreringsflodet och Skrivbordsvyn) – samma regel och meddelande som i
  // registreringen. En aldre bostad utan adress moter kravet forsta gangen
  // kortet sparas; ingenting annat blockeras, och den som inte ror kortet
  // marker inget.
  const adress = las(formData, "adress");
  const felIAdress = adressfel(adress);
  if (felIAdress) return { fel: felIAdress };
  const ort = las(formData, "ort");
  const geokod = tolkaGeokod(
    las(formData, "place_id"),
    las(formData, "latitud"),
    las(formData, "longitud"),
  );

  const identifieringText = las(formData, "identifiering");
  const identifiering = identifieringText === "" ? null : identifieringText;

  let kapitaltillskott: bigint | null | undefined = null;
  if (upplatelseform === "bostadsratt") {
    kapitaltillskott = beloppFranText(las(formData, "kapitaltillskott"));
    if (kapitaltillskott === undefined) {
      return { fel: "Kapitaltillskott anges som ett belopp, t.ex. 60 000." };
    }
  }

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      adress,
      ort: ort || null,
      place_id: geokod.place_id,
      latitud: geokod.latitud,
      longitud: geokod.longitud,
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      identifiering,
      storlek,
      kapitaltillskott,
      // Ett byte av upplatelseform oppnar bostadsfragorna igen
      // (src/doman/bostadsfragor.ts) – den enda gang det har kortet ror
      // flaggan, och da alltid till false, aldrig till true.
      ...lagringVidBytAvUpplatelseform(bostadNu.upplatelseform, upplatelseform as "bostadsratt" | "fastighet"),
    },
  });

  revalideraBostadssidor();
  return {};
}

/**
 * Kortet Forvarvet: tilltradesdatum, kopeskilling, kopkostnader, forsta
 * agaren, ombildningen (bostad) och agarandelen (medlemskap). Skriver ENDAST
 * dessa, plus bostadsfragor_besvarade nar forsta agaren besvaras (se nedan).
 *
 * Ombildningen har en enda uppgift: att upphava forsta agaren. Den fragas och
 * skrivs bara nar forsta agaren ar ja. Ett nej nollstaller den INTE
 * (docs/design.md, "Installningssidan") – ett kvarlamnat ja paverkar ingen
 * utrakning, eftersom villkoret bara provas nar bostaden var nybyggd.
 *
 * Forsta agaren och ombildningen saknar forval nar de ar obesvarade, och ett
 * tomt forsta agaren skrivs inte. Ett aktivt val ar ett svar, var det an gors:
 * genomgangen lovar att svaren kan andras har, sa sparningen satter
 * bostadsfragor_besvarade efter samma villkor som genomgangen
 * (src/doman/bostadsfragor.ts).
 *
 * Agarandelen provas mot de andras pa servern: en andring som tar summan over
 * 100 % avvisas (src/lib/samagande.ts, andelssummaVidAndring). Utestaende
 * inbjudningar raknas med – de har redan sin andel reserverad.
 */
export async function sparaForvarvet(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { anvandareId, bostadId } = await kravBostad();

  const tilltradesdatum = las(formData, "tilltradesdatum");
  if (!DATUM.test(tilltradesdatum)) {
    return {
      fel: "Tillträdesdatum behövs som baslinje för skickbedömningen och gränsen för vilka utgifter som är dina.",
    };
  }
  if (tilltradesdatum < "1970-01-01") {
    return { fel: "Tillträdesdatum före 1970 stöds inte." };
  }
  if (tilltradesdatum > isoDatum(new Date())) {
    return { fel: "Tillträdesdatum kan inte ligga i framtiden." };
  }

  const kopeskilling = beloppFranText(las(formData, "kopeskilling"));
  if (kopeskilling === undefined) {
    return { fel: "Köpeskilling anges som ett belopp, t.ex. 3 250 000." };
  }

  const kopkostnader = beloppFranText(las(formData, "kopkostnader"));
  if (kopkostnader === undefined) {
    return { fel: "Köpkostnader anges som ett belopp, t.ex. 45 000." };
  }

  const agarandel = agarandelFranText(las(formData, "agarandel"));
  if (agarandel === undefined) {
    return { fel: "Ägarandel anges som ett tal mellan 0 och 100, t.ex. 50 eller 33,33." };
  }

  // Tomt betyder obesvarat – da skrivs ingenting. Ett svar tolkas och lagras
  // som i genomgangen, och satter flaggan efter samma villkor
  // (src/doman/bostadsfragor.ts).
  // Upplatelseformen avgor om ombildningsfragan stalls, och lases fran
  // bostaden – den andras i ett annat kort och skickas inte med har.
  const { upplatelseform } = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true },
  });
  const bostadsfragor = tolkaBostadsfragesvar(
    las(formData, "forsta_agare"),
    las(formData, "ombildning"),
    upplatelseform,
  );
  if ("fel" in bostadsfragor) return bostadsfragor;

  // Provning och skrivning i samma transaktion, sa att tva samtidiga
  // andringar inte tillsammans kan ta summan over 100 %.
  const andelsfel = await prisma.$transaction(
    async (tx) => {
      const andelar = await hamtaAndelar(bostadId, tx);
      const fore = summeraAndelar(allaAndelar(andelar));
      const egenNu = andelar.medlemmar.find((m) => m.anvandareId === anvandareId)?.andel ?? 0;
      const fel = andelssummaVidAndring({ fore, efter: summeraAndelar([fore, agarandel, -egenNu]) });
      if (fel) return fel;

      await tx.bostad.update({
        where: { id: bostadId },
        data: {
          tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
          kopeskilling,
          kopkostnader,
          ...lagringAvBostadsfragor(bostadsfragor.svar),
        },
      });

      // Agarandelen tillhor relationen person–bostad, inte bostaden (CLAUDE.md).
      await tx.medlemskap.updateMany({
        where: { anvandare_id: anvandareId, bostad_id: bostadId },
        data: { agarandel },
      });
      return null;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (andelsfel) return { fel: andelsfel };

  revalideraBostadssidor();
  return {};
}
