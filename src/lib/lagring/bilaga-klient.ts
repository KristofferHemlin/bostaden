// Webblasarsidan av bilageuppladdningen. Filen laddas upp DIREKT till Supabase
// Storage via en signerad upload-URL som servern delat ut – den passerar aldrig
// en serverless-funktion (Vercels 4,5 MB-grans pa request-body).
//
// Flode: valideraBilaga (samma grind som servern) -> begar signerad URL -> ladda
// upp mot Storage -> be servern bekrafta mot Storage och skapa raden. Filen
// slapps aldrig ur formularets state forran bekraftelsen kommit (produktspec
// avsnittet "Bilagor och lagring").

import {
  begarBilagauppladdning,
  bekraftaBilagauppladdning,
} from "@/app/kostnad/bilaga-actions";
import { skapaWebbklient } from "@/lib/supabase/client";
import { BILAGOR_BUCKET, valideraBilaga } from "./bilaga-regler";

export interface KlientUppladdningsresultat {
  ok: boolean;
  fel?: string;
  bilagaId?: string;
}

/**
 * Laddar upp EN bilaga kopplad till en kostnad (ett utkast eller en sparad
 * kostnad). Returnerar forst nar servern bekraftat att filen finns i Storage och
 * databasraden skapats.
 */
export async function laddaUppKostnadsbilaga(
  kostnadId: string,
  fil: File,
): Promise<KlientUppladdningsresultat> {
  const grind = valideraBilaga({
    mimetyp: fil.type,
    storlek: fil.size,
    filnamn: fil.name,
  });
  if (!grind.ok) return { ok: false, fel: grind.fel };

  const adress = await begarBilagauppladdning({
    kostnadId,
    filnamn: fil.name,
    mimetyp: fil.type,
    storlek: fil.size,
  });
  if (!adress.ok) return { ok: false, fel: adress.fel };

  const lager = skapaWebbklient().storage.from(BILAGOR_BUCKET);
  // Nyckeln ar alltid ett färskt slumpat namn – ingen krock, inget upsert-behov.
  const { error } = await lager.uploadToSignedUrl(adress.nyckel, adress.token, fil, {
    contentType: adress.mimetyp,
  });
  if (error) {
    return { ok: false, fel: `Uppladdningen misslyckades: ${error.message}` };
  }

  return bekraftaBilagauppladdning({
    kostnadId,
    nyckel: adress.nyckel,
    filnamn: fil.name,
    mimetyp: fil.type,
    storlek: fil.size,
  });
}
