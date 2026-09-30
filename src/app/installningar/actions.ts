"use server";

// Installningssidan (docs/design.md, "Installningssidan"): fyra kort, varav tva
// med uppgifter som andras har – Bostaden och Forvarvet – och tva FRISTAENDE
// server actions, en per kort. (Tillgang andras via inbjudan,
// src/app/inbjudan/actions.ts; Ditt konto har inga uppgifter.) Sparas
// Bostaden far Forvarvet aldrig roras, inte ens med ett standardvarde for ett falt som inte
// skickades med. Det har ar den viktigaste punkten i hela sidan: samma fel
// har funnits forut, dar EN gemensam sparning for hela sidan tyst kunde satta
// bostadsfragor_besvarade till sant nar vilken installning som helst
// sparades. Losningen ar strukturell, inte en extra kontroll – varje action
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
import { agarandelFranText } from "@/lib/agarandel";
import { allaAndelar, hamtaAndelar } from "@/lib/andelar";
import { andelssummaVidAndring, summeraAndelar } from "@/lib/samagande";
import { isoDatum, oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { tolkaGeokod } from "@/app/registrera/koordinater";

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

  const adress = las(formData, "adress");
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
      adress: adress || null,
      ort: ort || null,
      place_id: geokod.place_id,
      latitud: geokod.latitud,
      longitud: geokod.longitud,
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      identifiering,
      storlek,
      kapitaltillskott,
    },
  });

  revalideraBostadssidor();
  return {};
}

/**
 * Kortet Forvarvet: tilltradesdatum, kopeskilling, kopkostnader, forsta
 * agaren, ombildningen (bostad) och agarandelen (medlemskap). Skriver ENDAST
 * dessa – aldrig bostadsfragor_besvarade.
 *
 * Ombildningen har en enda uppgift: att upphava forsta agaren. Den fragas och
 * skrivs bara nar forsta agaren ar ja. Ett nej nollstaller den INTE
 * (docs/design.md, "Installningssidan") – ett kvarlamnat ja paverkar ingen
 * utrakning, eftersom villkoret bara provas nar bostaden var nybyggd.
 *
 * Forsta agaren fragas har med ett konkret forval, sa den har sparningen far
 * ALDRIG sjalv satta bostadsfragor_besvarade: ett forval ar inte ett svar
 * (produktspec 4.1). Flaggan satts bara fran genomgangens Bostadsfragor.
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

  const nybyggdVidForvarv = las(formData, "forsta_agare") === "ja";
  const ombildning = nybyggdVidForvarv
    ? { ombildning_fran_hyresratt: las(formData, "ombildning") === "ja" }
    : {};

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
          nybyggd_vid_forvarv: nybyggdVidForvarv,
          ...ombildning,
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
