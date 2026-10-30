"use server";

// Fragorna fran kortet pa startsidan (docs/design.md, "Onboardingen fortsätter
// på startsidan"): adress, kopeskilling, agarandel – i den ordningen.
//
// Frågorna hanger ihop som ett flode, men VARJE SVAR SPARAS NAR DET GES. En
// action per fraga, och var och en skriver bara sitt eget falt. Det ar den
// detalj som ar lattast att bygga fel: ett flerstegsformular sparar normalt
// vid submit, och da ar det inte att kliva ur utan att forlora sitt arbete.
// Har ar varje steg sin egen sparning, och att kliva ur ar ett normalt satt
// att anvanda flodet – nasta gang pekar kortet pa samma stalle.
//
// Vart steget leder efter svaret avgors av src/lib/bostadsuppgifter.ts
// (efterSvaret), med svaren som de ligger i databasen efter sparandet.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agarandelFel, agarandelFranText } from "@/lib/agarandel";
import { hamtaAndelar } from "@/lib/andelar";
import {
  INBJUDNINGSERBJUDANDETS_SOKVAG,
  efterSvaret,
  type Bostadsuppgift,
} from "@/lib/bostadsuppgifter";
import { skrivEgenAndel } from "@/lib/egen-andel";
import { oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { tolkaGeokod } from "@/app/registrera/koordinater";
import { adressfel } from "@/app/registrera/validering";
import { KOPESKILLING_SOM_BELOPP, kopeskillingsfel } from "./validering";

export interface UppgiftResultat {
  fel?: string;
  falt?: "adress" | "kopeskilling" | "agarandel";
}

function las(formData: FormData, nyckel: string): string {
  return String(formData.get(nyckel) ?? "").trim();
}

/** Svaren som de ligger nu, och om nagon annan har eller ar inbjuden till bostaden. */
async function lasLaget(bostadId: string, anvandareId: string) {
  const [bostad, andelar] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({
      where: { id: bostadId },
      select: { adress: true, kopeskilling: true },
    }),
    hamtaAndelar(bostadId),
  ]);
  const egen = andelar.medlemmar.find((m) => m.anvandareId === anvandareId);
  return {
    svar: { adress: bostad.adress, kopeskilling: bostad.kopeskilling, agarandel: egen?.andel ?? null },
    andraFinns: andelar.medlemmar.length > 1 || andelar.inbjudningar.length > 0,
  };
}

/** Andelsfragan oppnas ocksa fran exportvyn – da gar vagen tillbaka dit. */
function franExport(formData: FormData): boolean {
  return formData.get("fran") === "export";
}

async function vidare(
  bostadId: string,
  anvandareId: string,
  nyssBesvarad: Bostadsuppgift,
  fran: { export: boolean },
): Promise<never> {
  revalidatePath("/");
  revalidatePath("/installningar");
  revalidatePath("/export");
  const dit = efterSvaret({ ...(await lasLaget(bostadId, anvandareId)), nyssBesvarad });
  if (fran.export) {
    redirect(dit === INBJUDNINGSERBJUDANDETS_SOKVAG ? `${dit}?fran=export` : "/export");
  }
  redirect(dit);
}

export async function sparaAdressen(
  _foreg: UppgiftResultat,
  formData: FormData,
): Promise<UppgiftResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  // Samma regel och mening som i installningarna: nagot ska sta dar, inte
  // nodvandigtvis en riktig adress. Fritext duger.
  const adress = las(formData, "adress");
  const fel = adressfel(adress);
  if (fel) return { fel, falt: "adress" };
  const geokod = tolkaGeokod(
    las(formData, "place_id"),
    las(formData, "latitud"),
    las(formData, "longitud"),
  );
  const ort = las(formData, "ort");

  await prisma.bostad.update({
    where: { id: bostadId },
    data: {
      adress,
      ort: ort || null,
      place_id: geokod.place_id,
      latitud: geokod.latitud,
      longitud: geokod.longitud,
    },
  });
  return vidare(bostadId, anvandareId, "adress", { export: false });
}

export async function sparaKopeskillingen(
  _foreg: UppgiftResultat,
  formData: FormData,
): Promise<UppgiftResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const text = las(formData, "kopeskilling");
  const fel = kopeskillingsfel(text);
  if (fel) return { fel, falt: "kopeskilling" };
  // Redan provad i kopeskillingsfel – kvar for typernas skull.
  const oren = oreFranKronor(text);
  if (oren === null) return { fel: KOPESKILLING_SOM_BELOPP, falt: "kopeskilling" };

  // BigInt: en villaforsaljning kan overstiga int4 i oren.
  await prisma.bostad.update({
    where: { id: bostadId },
    data: { kopeskilling: BigInt(oren) },
  });
  return vidare(bostadId, anvandareId, "kopeskilling", { export: false });
}

/**
 * Agarandelen. Ett formular vars enda arende ar svaret, sa ett tomt falt ar
 * ett fel (CLAUDE.md, "Andelen ar null tills den besvarats"). Provas mot de
 * andras pa samma stalle som Forvarvet (src/lib/egen-andel.ts) – det ar ett
 * svar, inte en bekraftelse; den ges vid forsaljningen.
 */
export async function sparaAndelen(
  _foreg: UppgiftResultat,
  formData: FormData,
): Promise<UppgiftResultat> {
  const { bostadId, anvandareId } = await kravBostad();
  const text = String(formData.get("agarandel") ?? "");
  const agarandel = agarandelFranText(text);
  if (agarandel === undefined) {
    return { fel: agarandelFel(text) ?? "Ange ägarandelen i procent.", falt: "agarandel" };
  }

  const fel = await prisma.$transaction(
    (tx) => skrivEgenAndel(tx, { bostadId, anvandareId, agarandel, bekrafta: false }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (fel) return { fel, falt: "agarandel" };

  return vidare(bostadId, anvandareId, "agarandel", { export: franExport(formData) });
}
