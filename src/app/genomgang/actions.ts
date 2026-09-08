"use server";

// Klassificeringsgenomgangen (produktspec, "Klassificeringsgenomgangen").
// Server-actions for fas 1: gruppera oklassificerade kvitton i hogar.
//
// En hog ar ett projekt. Fas 1 skapar det med kategori = null; fas 2
// (src/app/genomgang/fragor) satter kategorin och ovriga svar.
//
// "Raknas inte" ar ingen hog – det ar kostnad.arkiverad = true. Ordet
// "arkiverad" visas aldrig for anvandaren. Ett kvitto som hamnat dar gar att
// fora tillbaka (aterforFranRaknasInte / kostnadens detaljvy).
//
// Varje atgard committas for sig. Genomgangen gar darmed att avbryta nar som
// helst utan att det som gjorts gar forlorat.

import { revalidatePath } from "next/cache";
import { arOklassificerad } from "@/doman/genomgang";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface GenomgangResultat {
  fel?: string;
}

function revalidera(): void {
  revalidatePath("/");
  revalidatePath("/genomgang");
  revalidatePath("/genomgang/fragor");
  revalidatePath("/projekt");
  revalidatePath("/projekt/[id]", "page");
  revalidatePath("/kostnad");
  revalidatePath("/kostnad/[id]", "page");
  revalidatePath("/export");
}

const kostnadMedRader = {
  rader: { include: { fordelningar: true } },
} as const;

/** Kalenderaret ur ett Date, eller null. */
function ar(datum: Date | null): number | null {
  return datum ? datum.getUTCFullYear() : null;
}

/**
 * Kopplar oklassificerade kvitton till en hog: en radfordelning (andel 1) pa
 * varje icke-privat rad som annu saknar projektkoppling. Returnerar de
 * kvitto-id som faktiskt kopplades. Kvitton som inte ar oklassificerade (redan
 * i en hog, eller i "Raknas inte") hoppas tyst over.
 */
async function kopplaKvittonTillHog(
  bostadId: string,
  projektId: string,
  kostnadIder: string[],
): Promise<string[]> {
  if (kostnadIder.length === 0) return [];

  const kostnader = await prisma.kostnad.findMany({
    where: { id: { in: kostnadIder }, bostad_id: bostadId },
    include: kostnadMedRader,
  });

  const kopplade: string[] = [];
  for (const kostnad of kostnader) {
    if (!arOklassificerad(tillDomanKostnad(kostnad))) continue;
    const nyaFordelningar = kostnad.rader
      .filter(
        (rad) =>
          !rad.fordelningar.some((f) => f.privat || f.projekt_id !== null),
      )
      .map((rad) => ({
        kostnadsrad_id: rad.id,
        projekt_id: projektId,
        privat: false,
        andel: 1,
      }));
    if (nyaFordelningar.length === 0) continue;
    await prisma.radfordelning.createMany({ data: nyaFordelningar });
    kopplade.push(kostnad.id);
  }
  return kopplade;
}

/** Tar bort en hog om den inte langre har nagra kopplade rader OCH inte ar
 *  klassificerad. En klassificerad hog (kategori satt) ror vi aldrig har. */
async function stadaTomHog(projektId: string): Promise<void> {
  const projekt = await prisma.projekt.findUnique({
    where: { id: projektId },
    select: { kategori: true, fordelningar: { select: { id: true }, take: 1 } },
  });
  if (!projekt) return;
  if (projekt.kategori === null && projekt.fordelningar.length === 0) {
    await prisma.projekt.delete({ where: { id: projektId } });
  }
}

export async function skapaHog(
  _foreg: GenomgangResultat,
  formData: FormData,
): Promise<GenomgangResultat> {
  const { bostadId } = await kravBostad();

  const namn = String(formData.get("namn") ?? "").trim();
  const kostnadIder = formData.getAll("kostnad_ider").map(String).filter(Boolean);

  if (!namn) return { fel: "Ge högen ett namn." };
  if (kostnadIder.length === 0) {
    return { fel: "Välj minst ett kvitto till högen." };
  }

  const kostnader = await prisma.kostnad.findMany({
    where: { id: { in: kostnadIder }, bostad_id: bostadId },
    select: { betaldatum: true },
  });
  const arKandidater = kostnader
    .map((k) => ar(k.betaldatum))
    .filter((v): v is number => v !== null);
  const hogAr =
    arKandidater.length > 0
      ? Math.min(...arKandidater)
      : new Date().getUTCFullYear();

  const projekt = await prisma.projekt.create({
    data: { bostad_id: bostadId, namn, ar: hogAr, kategori: null },
    select: { id: true },
  });

  const kopplade = await kopplaKvittonTillHog(
    bostadId,
    projekt.id,
    kostnadIder,
  );
  if (kopplade.length === 0) {
    // Inget kvitto gick att koppla (alla redan grupperade/borttagna) – lamna
    // ingen tom hog kvar.
    await prisma.projekt.delete({ where: { id: projekt.id } });
    return { fel: "Kvittona hann grupperas någon annanstans. Ladda om sidan." };
  }

  revalidera();
  return {};
}

/**
 * Doper om en hog direkt i grupperingsvyn. Namnet foreslas fran forsta kvittots
 * anteckning, men forslaget ar ofta leverantoren – och hogens namn hamnar i
 * K6A-underlagets atgardskolumn, dar det ska sta vad utgiften avser. Bara hogar
 * som annu inte gatt igenom fragorna (kategori = null) doper man om har;
 * klassificerade hogar andras via projektets redigering.
 */
export async function dopOmHog(
  _foreg: GenomgangResultat,
  formData: FormData,
): Promise<GenomgangResultat> {
  const { bostadId } = await kravBostad();

  const projektId = String(formData.get("projekt_id") ?? "");
  const namn = String(formData.get("namn") ?? "").trim();

  if (!namn) return { fel: "Ge högen ett namn." };

  const projekt = await prisma.projekt.findFirst({
    where: { id: projektId, bostad_id: bostadId },
    select: { id: true, kategori: true },
  });
  if (!projekt) return { fel: "Högen hittades inte." };
  if (projekt.kategori !== null) {
    return { fel: "Den högen är redan klassificerad och byter namn via projektet." };
  }

  await prisma.projekt.update({ where: { id: projekt.id }, data: { namn } });
  revalidera();
  return {};
}

export async function laggIHog(
  _foreg: GenomgangResultat,
  formData: FormData,
): Promise<GenomgangResultat> {
  const { bostadId } = await kravBostad();

  const projektId = String(formData.get("projekt_id") ?? "");
  const kostnadIder = formData.getAll("kostnad_ider").map(String).filter(Boolean);

  const projekt = await prisma.projekt.findFirst({
    where: { id: projektId, bostad_id: bostadId },
    select: { id: true, kategori: true },
  });
  if (!projekt) return { fel: "Högen hittades inte." };
  if (projekt.kategori !== null) {
    return {
      fel: "Den högen är redan klassificerad. Lägg kvittot i en hög som inte gått igenom frågorna än.",
    };
  }
  if (kostnadIder.length === 0) return { fel: "Välj minst ett kvitto." };

  await kopplaKvittonTillHog(bostadId, projekt.id, kostnadIder);
  revalidera();
  return {};
}

export async function flyttaUturHog(
  _foreg: GenomgangResultat,
  formData: FormData,
): Promise<GenomgangResultat> {
  const { bostadId } = await kravBostad();

  const projektId = String(formData.get("projekt_id") ?? "");
  const kostnadId = String(formData.get("kostnad_id") ?? "");

  const projekt = await prisma.projekt.findFirst({
    where: { id: projektId, bostad_id: bostadId },
    select: { id: true, kategori: true },
  });
  if (!projekt) return { fel: "Högen hittades inte." };
  if (projekt.kategori !== null) {
    return { fel: "Den högen är redan klassificerad och ändras via projektet." };
  }

  await prisma.radfordelning.deleteMany({
    where: {
      projekt_id: projektId,
      kostnadsrad: { kostnad_id: kostnadId, kostnad: { bostad_id: bostadId } },
    },
  });
  await stadaTomHog(projektId);

  revalidera();
  return {};
}

export async function raknasInte(
  _foreg: GenomgangResultat,
  formData: FormData,
): Promise<GenomgangResultat> {
  const { bostadId } = await kravBostad();

  const kostnadIder = formData.getAll("kostnad_ider").map(String).filter(Boolean);
  if (kostnadIder.length === 0) return { fel: "Välj minst ett kvitto." };

  const kostnader = await prisma.kostnad.findMany({
    where: { id: { in: kostnadIder }, bostad_id: bostadId },
    select: {
      id: true,
      rader: { select: { fordelningar: { select: { projekt_id: true } } } },
    },
  });

  const berordaHogar = new Set<string>();
  for (const kostnad of kostnader) {
    for (const rad of kostnad.rader) {
      for (const f of rad.fordelningar) {
        if (f.projekt_id) berordaHogar.add(f.projekt_id);
      }
    }
  }

  await prisma.$transaction([
    // Ligger kvittot i en hog: koppla loss det forst, sa summorna stammer.
    prisma.radfordelning.deleteMany({
      where: {
        projekt_id: { not: null },
        kostnadsrad: { kostnad_id: { in: kostnader.map((k) => k.id) } },
      },
    }),
    prisma.kostnad.updateMany({
      where: { id: { in: kostnader.map((k) => k.id) }, bostad_id: bostadId },
      data: { arkiverad: true },
    }),
  ]);

  for (const projektId of berordaHogar) await stadaTomHog(projektId);

  revalidera();
  return {};
}

export async function aterforFranRaknasInte(
  _foreg: GenomgangResultat,
  formData: FormData,
): Promise<GenomgangResultat> {
  const { bostadId } = await kravBostad();
  const kostnadId = String(formData.get("kostnad_id") ?? "");

  await prisma.kostnad.updateMany({
    where: { id: kostnadId, bostad_id: bostadId },
    data: { arkiverad: false },
  });

  revalidera();
  return {};
}
