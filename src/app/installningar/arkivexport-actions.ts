"use server";

// Server action for arkivexporten pa installningssidan (docs/produktspec.md
// avsnitt 12). Returnerar bara listan – zip-filen byggs i webblasaren.

import { hamtaArkivlista, type Arkivlista } from "@/lib/arkivexport/hamta";
import { kravBostad } from "@/lib/session";

export async function hamtaArkivexportlista(): Promise<Arkivlista> {
  const { bostadId } = await kravBostad();
  return hamtaArkivlista(bostadId);
}
