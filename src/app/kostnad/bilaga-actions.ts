"use server";

// Server actions for den direktuppladdade bilagan (produktspec avsnitten
// "Dokumentavlasning" och "Bilagor och lagring"). Filen gar DIREKT fran
// webblasaren till Supabase Storage via en signerad upload-URL – den passerar
// aldrig en serverless-funktion (Vercels 4,5 MB-grans pa request-body). Dessa
// actions bar bara sma JSON-nyttolaster:
//
//   1. begarBilagauppladdning   -> behorighetskontroll + signerad URL + harledd nyckel
//   2. (webblasaren laddar upp filen direkt mot URL:en)
//   3. bekraftaBilagauppladdning -> bekrafta mot Storage, ev. HEIC-miniatyr, skapa raden
//   4. analyseraBilaga          -> las filen fran Storage och kor dokumentavlasningen
//
// bostad_id kommer ALLTID fran kravBostad() har, aldrig fran klienten.

import {
  bekraftaKostnadsbilaga,
  skapaSigneradUppladdning,
  taBortBilaga as taBortBilagaLib,
  type SigneradUppladdning,
  type Uppladdningsresultat,
} from "@/lib/lagring/bilagor";
import { analyseraKostnadsbilaga } from "@/lib/dokumentavlasning/lagring";
import type { Dokumentfalt } from "@/lib/dokumentavlasning/tolkning";
import { kravBostad } from "@/lib/session";

interface Filuppgifter {
  filnamn: string;
  mimetyp: string;
  storlek: number;
}

export async function begarBilagauppladdning(
  indata: Filuppgifter & { kostnadId: string },
): Promise<SigneradUppladdning> {
  const { bostadId } = await kravBostad();
  return skapaSigneradUppladdning({
    bostadId,
    kostnadId: indata.kostnadId,
    filnamn: indata.filnamn,
    mimetyp: indata.mimetyp,
    storlek: indata.storlek,
  });
}

export async function bekraftaBilagauppladdning(
  indata: Filuppgifter & { kostnadId: string; nyckel: string },
): Promise<Uppladdningsresultat> {
  const { bostadId } = await kravBostad();
  return bekraftaKostnadsbilaga({
    bostadId,
    kostnadId: indata.kostnadId,
    nyckel: indata.nyckel,
    filnamn: indata.filnamn,
    mimetyp: indata.mimetyp,
    storlek: indata.storlek,
  });
}

export async function analyseraBilaga(indata: {
  bilagaId: string;
}): Promise<Dokumentfalt> {
  const { bostadId } = await kravBostad();
  return analyseraKostnadsbilaga({ bostadId, bilagaId: indata.bilagaId });
}

export async function taBortBilaga(indata: {
  bilagaId: string;
}): Promise<{ ok: boolean; fel?: string }> {
  const { anvandareId } = await kravBostad();
  return taBortBilagaLib(indata.bilagaId, anvandareId);
}
