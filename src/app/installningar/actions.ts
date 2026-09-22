"use server";

// Installningssidan (docs/design.md, "Installningssidan"): fyra kort, fyra
// FRISTAENDE server actions – ett per kort. Sparas Kopet far Bostaden och
// Agandet aldrig roras, inte ens med ett standardvarde for ett falt som inte
// skickades med. Det har ar den viktigaste punkten i hela sidan: samma fel
// har funnits forut, dar EN gemensam sparning for hela sidan tyst kunde satta
// bostadsfragor_besvarade till sant nar vilken installning som helst
// sparades. Losningen ar strukturell, inte en extra kontroll – varje action
// skriver ENDAST de falt som hor till dess eget kort i `data`-objektet, och
// Prisma rör aldrig ett falt som inte star dar.
//
// Upplatelseform och tilltradesdatum satts vid registreringen och visas
// medvetet inte i toppraden, men maste ga att se och andra har (docs/design.md,
// "Installningssidan") – tilltradesdatumet ar baslinjen for hela skickbedom-
// ningen. Bada ar OBLIGATORISKA, till skillnad fran resten av formularen, och
// hor hemma i kortet Bostaden tillsammans med upplatelseformen de styr.
//
// Upplatelseformen gar att byta fram till forsaljningen, aldrig efter
// (produktspec 4.8). Klienten later ett byte kraeva en bekraftelse och lasar
// kortet nar bostaden ar sald, men den kontrollen ar bara UX – servern nekar
// har ocksa ett byte nar forsaljningsdatum finns, oavsett vad formularet
// faktiskt skickar.

import { revalidatePath } from "next/cache";
import { agarandelFranText } from "@/lib/agarandel";
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
 * Kortet Bostaden: adress, ort, upplatelseform, tilltradesdatum,
 * identifiering. Skriver ENDAST dessa falt pa `bostad` – kopeskilling,
 * kopkostnader, kapitaltillskott, storlek (Kopet), nybyggd_vid_forvarv,
 * ombildning_fran_hyresratt, bostadsfragor_besvarade (Agandet) star inte i
 * `data` och rors darfor aldrig.
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

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      adress: adress || null,
      ort: ort || null,
      place_id: geokod.place_id,
      latitud: geokod.latitud,
      longitud: geokod.longitud,
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
      identifiering,
    },
  });

  revalideraBostadssidor();
  return {};
}

/**
 * Kortet Kopet: kopeskilling, kopkostnader, kapitaltillskott, storlek.
 * Kapitaltillskott finns bara for bostadsratt – kortet lasker den aktuella
 * upplatelseformen sjalvt (aldrig fran ett dolt falt formularet skickar) och
 * nollstaller kapitaltillskott om bostaden ar en fastighet, oavsett vad
 * formularet skulle raka innehalla. Det ar inte ett undantag fran "varje kort
 * sparar bara sina egna falt" – kapitaltillskott HOR till Kopet, precis som
 * kopeskillingen.
 */
export async function sparaKopet(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { bostadId } = await kravBostad();

  const storlek = storlekFranText(las(formData, "storlek"));
  if (storlek === undefined) {
    return { fel: "Storlek anges i kvadratmeter, t.ex. 72." };
  }

  const kopeskilling = beloppFranText(las(formData, "kopeskilling"));
  if (kopeskilling === undefined) {
    return { fel: "Köpeskilling anges som ett belopp, t.ex. 3 250 000." };
  }

  const kopkostnader = beloppFranText(las(formData, "kopkostnader"));
  if (kopkostnader === undefined) {
    return { fel: "Köpkostnader anges som ett belopp, t.ex. 45 000." };
  }

  const bostadNu = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true },
  });

  let kapitaltillskott: bigint | null | undefined = null;
  if (bostadNu.upplatelseform === "bostadsratt") {
    kapitaltillskott = beloppFranText(las(formData, "kapitaltillskott"));
    if (kapitaltillskott === undefined) {
      return { fel: "Kapitaltillskott anges som ett belopp, t.ex. 60 000." };
    }
  }

  await prisma.bostad.update({
    where: { id: bostadId },
    data: { kopeskilling, kopkostnader, kapitaltillskott, storlek },
  });

  revalideraBostadssidor();
  return {};
}

/**
 * Kortet Agandet: agarandel (medlemskap), forsta agaren, ombildning fran
 * hyresratt. Skriver ENDAST dessa – aldrig bostadsfragor_besvarade, som last
 * fran databasen och skrivs tillbaka oforandrad. Formularet har alltid ett
 * konkret val forvalt (aldrig ett obesvarat forval, till skillnad fran
 * genomgangens forsta-gangen-skarm), sa den har sparningen far ALDRIG sjalv
 * satta flaggan till sant: ett forval ar inte ett svar, och sparar
 * anvandaren nagot innan genomgangen nagonsin korts skulle "nej" annars
 * tystas ned som ett bekraftat svar ingen faktiskt gett (produktspec 4.1).
 * Flaggan far bara ga fran false till true fran sjalva
 * Bostadsfragor-skarmen (genomgang/fragor/actions.ts, sparaBostadsfragor).
 */
export async function sparaAgandet(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { anvandareId, bostadId } = await kravBostad();

  const agarandel = agarandelFranText(las(formData, "agarandel"));
  if (agarandel === undefined) {
    return { fel: "Ägarandel anges som ett tal mellan 0 och 100, t.ex. 50 eller 33,33." };
  }

  const nybyggdVidForvarv = las(formData, "forsta_agare") === "ja";
  const ombildningFranHyresratt = nybyggdVidForvarv && las(formData, "ombildning") === "ja";

  const bostadNu = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { bostadsfragor_besvarade: true },
  });

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      nybyggd_vid_forvarv: nybyggdVidForvarv,
      ombildning_fran_hyresratt: ombildningFranHyresratt,
      bostadsfragor_besvarade: bostadNu.bostadsfragor_besvarade,
    },
  });

  // Agarandelen tillhor relationen person–bostad, inte bostaden (CLAUDE.md).
  await prisma.medlemskap.updateMany({
    where: { anvandare_id: anvandareId, bostad_id: bostadId },
    data: { agarandel },
  });

  revalideraBostadssidor();
  return {};
}
