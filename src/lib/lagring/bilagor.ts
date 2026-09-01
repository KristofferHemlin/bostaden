// Bilagornas serverlogik: uppladdning, signerade visningslankar och radering.
// ENDAST server. Se produktspec avsnitt 12, "Bilagor och lagring".
//
// - Sokvagen harleds ALLTID pa servern ur kostnadens id och den kontrollerade
//   bostaden. Anvandarens ursprungliga filnamn lagras i databasen, aldrig i
//   sokvagen.
// - Databasraden skapas forst nar Storage bekraftat bade originalet och en ev.
//   HEIC-miniatyr. Misslyckas nagot rensas det som redan lagts upp.
// - Visning sker via korta signerade URL:er, skapade efter behorighetskontroll
//   mot medlemskapet.
// - Radering sker ENDAST pa uttrycklig begaran och tar bade fil(er) och rad.
//   Ingen automatisk radering nar en kostnad arkiveras eller avklassificeras.

import "server-only";
import { prisma } from "@/lib/prisma";
import {
  lagringsnyckel,
  miniatyrnyckel,
  slumpatFilnamn,
  valideraBilaga,
} from "./bilaga-regler";
import { bilagelager } from "./klient";
import { heicTillJpegMiniatyr } from "./miniatyr";

const SIGNERAD_LANK_SEKUNDER = 60;

export interface Uppladdningsresultat {
  ok: boolean;
  fel?: string;
  bilagaId?: string;
}

/**
 * Laddar upp EN fil kopplad till en kostnad. Bekraftar mot Storage innan
 * databasraden skapas – en tyst misslyckad uppladdning ar det varsta som kan
 * handa i den har appen.
 */
export async function laddaUppKostnadsbilaga(params: {
  bostadId: string;
  kostnadId: string;
  fil: File;
}): Promise<Uppladdningsresultat> {
  const { bostadId, kostnadId, fil } = params;

  const kostnad = await prisma.kostnad.findFirst({
    where: { id: kostnadId, bostad_id: bostadId },
    select: { id: true },
  });
  if (!kostnad) return { ok: false, fel: "Kostnaden hittades inte." };

  const validering = valideraBilaga({
    mimetyp: fil.type,
    storlek: fil.size,
    filnamn: fil.name,
  });
  if (!validering.ok) return { ok: false, fel: validering.fel };
  const { format } = validering;

  const original = Buffer.from(await fil.arrayBuffer());
  const nyckel = lagringsnyckel(
    bostadId,
    kostnadId,
    slumpatFilnamn(format.andelse),
  );

  const lager = bilagelager();
  const upplagt: string[] = [];

  try {
    const org = await lager.upload(nyckel, original, {
      contentType: format.mimetyp,
      upsert: false,
    });
    if (org.error) throw org.error;
    upplagt.push(nyckel);

    let miniatyr: string | null = null;
    if (format.kraverMiniatyr) {
      const jpeg = await heicTillJpegMiniatyr(original);
      const mNyckel = miniatyrnyckel(nyckel);
      const mini = await lager.upload(mNyckel, jpeg, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (mini.error) throw mini.error;
      upplagt.push(mNyckel);
      miniatyr = mNyckel;
    }

    const rad = await prisma.bilaga.create({
      data: {
        kostnad_id: kostnadId,
        lagringsnyckel: nyckel,
        miniatyrnyckel: miniatyr,
        filnamn: fil.name || "kvitto",
        mimetyp: format.mimetyp,
        storlek: original.byteLength,
        uppladdning_bekraftad: true,
      },
    });
    return { ok: true, bilagaId: rad.id };
  } catch (fel) {
    // Rensa det som hann laddas upp sa att inga foraldralosa filer ligger kvar.
    if (upplagt.length > 0) {
      await lager.remove(upplagt).catch(() => {});
    }
    const text =
      fel instanceof Error ? fel.message : "okänt fel vid uppladdningen";
    return { ok: false, fel: `Uppladdningen misslyckades: ${text}` };
  }
}

type BilagaMedBostad = {
  id: string;
  lagringsnyckel: string;
  miniatyrnyckel: string | null;
  filnamn: string;
  mimetyp: string;
  kostnad: { bostad_id: string } | null;
};

/** Laddar bilagan och slapper bara igenom den om anvandaren ar medlem i dess bostad. */
async function kravAtkomst(
  bilagaId: string,
  anvandareId: string,
): Promise<BilagaMedBostad | null> {
  const bilaga = await prisma.bilaga.findUnique({
    where: { id: bilagaId },
    select: {
      id: true,
      lagringsnyckel: true,
      miniatyrnyckel: true,
      filnamn: true,
      mimetyp: true,
      kostnad: { select: { bostad_id: true } },
    },
  });
  if (!bilaga || !bilaga.kostnad) return null;

  const medlem = await prisma.medlemskap.findFirst({
    where: { anvandare_id: anvandareId, bostad_id: bilaga.kostnad.bostad_id },
    select: { id: true },
  });
  if (!medlem) return null;

  return bilaga;
}

export type Lankvariant = "original" | "visning";

/**
 * Kort signerad URL, skapad pa servern efter behorighetskontroll. "visning" ger
 * HEIC-miniatyren nar en sadan finns; "original" ger alltid originalfilen.
 */
export async function signeradBilagelank(
  bilagaId: string,
  anvandareId: string,
  variant: Lankvariant = "visning",
): Promise<string | null> {
  const bilaga = await kravAtkomst(bilagaId, anvandareId);
  if (!bilaga) return null;

  const nyckel =
    variant === "visning" && bilaga.miniatyrnyckel
      ? bilaga.miniatyrnyckel
      : bilaga.lagringsnyckel;

  const { data, error } = await bilagelager().createSignedUrl(
    nyckel,
    SIGNERAD_LANK_SEKUNDER,
  );
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Tar bort bade fil(er) och databaspost. Sker ENDAST pa uttrycklig begaran fran
 * anvandaren – aldrig automatiskt.
 */
export async function taBortBilaga(
  bilagaId: string,
  anvandareId: string,
): Promise<{ ok: boolean; fel?: string }> {
  const bilaga = await kravAtkomst(bilagaId, anvandareId);
  if (!bilaga) return { ok: false, fel: "Bilagan hittades inte." };

  const nycklar = [bilaga.lagringsnyckel];
  if (bilaga.miniatyrnyckel) nycklar.push(bilaga.miniatyrnyckel);

  const { error } = await bilagelager().remove(nycklar);
  if (error) {
    return { ok: false, fel: `Kunde inte ta bort filen: ${error.message}` };
  }

  await prisma.bilaga.delete({ where: { id: bilaga.id } });
  return { ok: true };
}

export interface Bilagevy {
  id: string;
  filnamn: string;
  arPdf: boolean;
}

/** Bilagorna for en kostnad, i uppladdningsordning. */
export async function listaKostnadsbilagor(
  kostnadId: string,
): Promise<Bilagevy[]> {
  const rader = await prisma.bilaga.findMany({
    where: { kostnad_id: kostnadId },
    orderBy: { skapad_at: "asc" },
    select: { id: true, filnamn: true, mimetyp: true },
  });
  return rader.map((b) => ({
    id: b.id,
    filnamn: b.filnamn,
    arPdf: b.mimetyp === "application/pdf",
  }));
}
