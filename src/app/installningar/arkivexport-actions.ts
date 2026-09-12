"use server";

// Server action for arkivexporten pa installningssidan (docs/produktspec.md
// avsnitt 12). Returnerar bara listan – zip-filen byggs i webblasaren.

import { serverfelMeddelande } from "@/lib/databas-fel";
import { hamtaArkivlista, type Arkivlista } from "@/lib/arkivexport/hamta";
import { kravBostad } from "@/lib/session";

export async function hamtaArkivexportlista(): Promise<Arkivlista> {
  const { bostadId, anvandareId } = await kravBostad();
  try {
    return await hamtaArkivlista(bostadId);
  } catch (fel) {
    return {
      ok: false,
      fel: serverfelMeddelande(fel, {
        sida: "installningar",
        anrop: "hamtaArkivexportlista",
        anvandareId,
      }),
    };
  }
}
