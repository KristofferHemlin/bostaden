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
// bostad_id kommer ALLTID fran servern, aldrig fran klienten: det ar
// kostnadens egen bostad, och bara om den inloggade ar medlem dar. Bilagorna
// foljer sitt eget medlemskap, inte den aktiva bostaden (docs/design.md, "Att
// äga flera bostäder") – ett utkast bar sin bostad fran den stund det skapas,
// och en uppladdning som paborjats i en bostad ska inte slas ut av att den
// aktiva bostaden byts i en annan flik.

import { serverfelMeddelande } from "@/lib/databas-fel";
import {
  bekraftaKostnadsbilaga,
  skapaSigneradUppladdning,
  taBortBilaga as taBortBilagaLib,
  type SigneradUppladdning,
  type Uppladdningsresultat,
} from "@/lib/lagring/bilagor";
import { analyseraKostnadsbilaga, KORDES_INTE } from "@/lib/dokumentavlasning/lagring";
import type { Dokumentavlasning } from "@/lib/dokumentavlasning/analysera";
import { bostadForBilaga, bostadForKostnad, kravBostad } from "@/lib/session";

// Bilageuppladdningen ar det viktigaste stallet i hela appen att aldrig tystna
// pa (produktspec avsnitt 13, punkt 2: "en tyst misslyckad uppladdning ar det
// varsta som kan handa"). skapaSigneradUppladdning/bekraftaKostnadsbilaga
// kastar redan aldrig for de fel de sjalva kanner (se lib/lagring/bilagor.ts)
// – den har fangar bara det oforutsedda (t.ex. databasen sover) sa att
// klienten alltid far ett svar att visa, aldrig ett hangande lofte.

interface Filuppgifter {
  filnamn: string;
  mimetyp: string;
  storlek: number;
}

export async function begarBilagauppladdning(
  indata: Filuppgifter & { kostnadId: string },
): Promise<SigneradUppladdning> {
  const { anvandareId } = await kravBostad();
  try {
    const bostadId = await bostadForKostnad(indata.kostnadId, anvandareId);
    if (!bostadId) return { ok: false, fel: "Kvittot hittades inte." };
    return await skapaSigneradUppladdning({
      bostadId,
      kostnadId: indata.kostnadId,
      filnamn: indata.filnamn,
      mimetyp: indata.mimetyp,
      storlek: indata.storlek,
    });
  } catch (fel) {
    return {
      ok: false,
      fel: serverfelMeddelande(fel, {
        sida: "kostnad/bilaga",
        anrop: "begarBilagauppladdning",
        anvandareId,
      }),
    };
  }
}

export async function bekraftaBilagauppladdning(
  indata: Filuppgifter & { kostnadId: string; nyckel: string },
): Promise<Uppladdningsresultat> {
  const { anvandareId } = await kravBostad();
  try {
    const bostadId = await bostadForKostnad(indata.kostnadId, anvandareId);
    if (!bostadId) return { ok: false, fel: "Kvittot hittades inte." };
    return await bekraftaKostnadsbilaga({
      bostadId,
      kostnadId: indata.kostnadId,
      nyckel: indata.nyckel,
      filnamn: indata.filnamn,
      mimetyp: indata.mimetyp,
      storlek: indata.storlek,
    });
  } catch (fel) {
    return {
      ok: false,
      fel: serverfelMeddelande(fel, {
        sida: "kostnad/bilaga",
        anrop: "bekraftaBilagauppladdning",
        anvandareId,
      }),
    };
  }
}

export async function analyseraBilaga(indata: {
  bilagaId: string;
}): Promise<Dokumentavlasning> {
  const { anvandareId } = await kravBostad();
  const bostadId = await bostadForBilaga(indata.bilagaId, anvandareId);
  if (!bostadId) return KORDES_INTE;
  return analyseraKostnadsbilaga({ bostadId, bilagaId: indata.bilagaId });
}

export async function taBortBilaga(indata: {
  bilagaId: string;
}): Promise<{ ok: boolean; fel?: string }> {
  const { anvandareId } = await kravBostad();
  try {
    return await taBortBilagaLib(indata.bilagaId, anvandareId);
  } catch (fel) {
    return {
      ok: false,
      fel: serverfelMeddelande(fel, { sida: "kostnad/bilaga", anrop: "taBortBilaga", anvandareId }),
    };
  }
}
