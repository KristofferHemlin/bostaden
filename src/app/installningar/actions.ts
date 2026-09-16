"use server";

// Installningssidan (docs/design.md, "Installningssidan"). Allt som beskriver
// bostaden men inte behovs for att komma igang: storlek, kopeskilling,
// kopkostnader, agarandel, identifiering (foreningens namn eller fastighets-
// beteckning) och – bara for bostadsratt – kapitaltillskott. Kopeskillingen
// gar att ange redan i registreringens bostadssteg; den som hoppade over den
// dar fyller i den har. De flesta faltet ar valfria. Tomt falt nollstaller
// vardet (agarandel tolkas dock som hela bostaden, 100 %).
//
// Upplatelseform och tilltradesdatum satts vid registreringen och visas
// medvetet inte i toppraden, men maste ga att se och andra har (docs/design.md,
// "Installningssidan") – tilltradesdatumet ar baslinjen for hela skickbedom-
// ningen. Bada ar OBLIGATORISKA, till skillnad fran resten av formularet.
//
// Upplatelseformen gar att byta fram till forsaljningen, aldrig efter
// (produktspec 4.8). Klienten (form.tsx) later ett byte kraeva en bekraftelse
// och lasar korten nar bostaden ar sald, men den kontrollen ar bara UX –
// servern nekar har ocksa ett byte nar forsaljningsdatum finns, oavsett vad
// formularet faktiskt skickar.

import { revalidatePath } from "next/cache";
import { agarandelFranText } from "@/lib/agarandel";
import { isoDatum, oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface InstallningarResultat {
  fel?: string;
  meddelande?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

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

export async function sparaInstallningar(
  _foreg: InstallningarResultat,
  formData: FormData,
): Promise<InstallningarResultat> {
  const { anvandareId, bostadId } = await kravBostad();

  const las = (nyckel: string) => String(formData.get(nyckel) ?? "").trim();

  // Upplatelseform och tilltradesdatum – till skillnad fran resten av
  // formularet OBLIGATORISKA, precis som i registreringen (docs/design.md,
  // "Installningssidan"). Formen styr valet av upplatelseform har (inte det
  // som redan lag i databasen) sa att kapitaltillskottsfaltet lases in eller
  // nollstalls i takt med det korten faktiskt visar.
  const upplatelseform = las("upplatelseform");
  if (upplatelseform !== "bostadsratt" && upplatelseform !== "fastighet") {
    return { fel: "Välj bostadsrätt eller villa/radhus." };
  }
  const arBostadsratt = upplatelseform === "bostadsratt";

  const tilltradesdatum = las("tilltradesdatum");
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

  // Upplatelseformen ar last efter forsaljning (produktspec 4.8, CLAUDE.md
  // "Inga floden far blockera" – undantaget): ett byte da skulle gora ett
  // redan framtaget underlag och en redan vald blankett osann i efterhand.
  // Kontrolleras HAR, inte bara i granssnittet, eftersom formularet alltid
  // skickar med hela sitt varde – aven nar korten ar lasta och anvandaren
  // inte kunnat andra dem.
  const bostadNu = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
    select: { upplatelseform: true, forsaljningsdatum: true },
  });
  if (bostadNu.forsaljningsdatum && upplatelseform !== bostadNu.upplatelseform) {
    return {
      fel: "Upplåtelseformen går inte att ändra efter försäljningen – underlaget är framtaget och blanketten vald.",
    };
  }

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
  // falt visas inte for fastighet, lases da inte in och nollstalls i databasen
  // om anvandaren just bytte bort fran bostadsratt.
  let kapitaltillskott: bigint | null | undefined = null;
  if (arBostadsratt) {
    kapitaltillskott = beloppFranText(las("kapitaltillskott"));
    if (kapitaltillskott === undefined) {
      return { fel: "Kapitaltillskott anges som ett belopp, t.ex. 60 000." };
    }
  }

  // Delad med faltkomponenten (@/lib/agarandel) sa att servern provar exakt
  // samma regel som granssnittet, av samma skal som for tilltradesdatumet.
  const agarandel = agarandelFranText(las("agarandel"));
  if (agarandel === undefined) {
    return { fel: "Ägarandel anges som ett tal mellan 0 och 100, t.ex. 50 eller 33,33." };
  }

  // Foreningens namn eller fastighetsbeteckning (produktspec 8, "Forsattssida").
  // Rent valfritt – andrar inget belopp – sa ingen tolkningsgrind: tomt blir null.
  const identifieringText = las("identifiering");
  const identifiering = identifieringText === "" ? null : identifieringText;

  // Bostadsfragorna (produktspec 4.1, 4.6). Formularet har alltid ett
  // konkret val forvalt (aldrig ett obesvarat forval, till skillnad fran
  // genomgangens forsta-gangen-skarm), sa nagon tolkningsgrind behovs inte
  // har. Att spara har rakan bostadsfragor_besvarade = true – anvandaren har
  // just sett och bekraftat ett varde, aven om det rakar vara det som redan
  // lag i databasen – sa att genomgangens blockerande steg inte visas i onodan
  // for nagon som redan svarat har.
  const nybyggdVidForvarv = las("forsta_agare") === "ja";
  const ombildningFranHyresratt = nybyggdVidForvarv && las("ombildning") === "ja";

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
      storlek,
      kopeskilling,
      kopkostnader,
      kapitaltillskott,
      identifiering,
      nybyggd_vid_forvarv: nybyggdVidForvarv,
      ombildning_fran_hyresratt: ombildningFranHyresratt,
      bostadsfragor_besvarade: true,
    },
  });

  // Agarandelen tillhor relationen person–bostad, inte bostaden (CLAUDE.md).
  await prisma.medlemskap.updateMany({
    where: { anvandare_id: anvandareId, bostad_id: bostadId },
    data: { agarandel },
  });

  revalidatePath("/installningar");
  revalidatePath("/");
  // Tilltradesdatum ar baslinjen for fraga 3 och femarsfonstret, och
  // upplatelseform styr blankettnamnet – bada paverkar dessa sidor.
  revalidatePath("/genomgang");
  revalidatePath("/genomgang/fragor");
  revalidatePath("/export");
  return { meddelande: "Sparat." };
}
