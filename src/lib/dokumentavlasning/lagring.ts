// Dokumentavlasning som laser bilagan fran Storage (produktspec, avsnittet
// "Dokumentavlasning"). ENDAST server.
//
// Nar anvandaren valjer en fil i kostnadsformularet skapas kostnaden direkt som
// ett UTKAST och filen laddas upp till sin riktiga plats via en signerad URL.
// Analysen laser filen darifran – den passerar aldrig en serverless-funktion
// (Vercels 4,5 MB-grans pa request-body). Ingen avlas/-mapp, ingen dubbel
// uppladdning, ingen stadning: filen ar redan kvittots skarpa bilaga.

import "server-only";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";
import { bilagelager } from "@/lib/lagring/klient";
import { prisma } from "@/lib/prisma";
import { analyseraDokumentbuffert } from "./analysera";
import { TOMT_DOKUMENTFALT, type Dokumentfalt } from "./tolkning";

/**
 * Laser en (redan uppladdad) bilaga fran Storage och kor dokumentavlasningen pa
 * den. Kastar aldrig – vid varje fel (saknad nyckel, fel bostad, oläsbar fil,
 * timeout) returneras TOMT_DOKUMENTFALT sa att formularet fungerar exakt som
 * utan analys.
 */
export async function analyseraKostnadsbilaga(params: {
  bostadId: string;
  bilagaId: string;
}): Promise<Dokumentfalt> {
  try {
    const bilaga = await prisma.bilaga.findUnique({
      where: { id: params.bilagaId },
      select: {
        lagringsnyckel: true,
        filnamn: true,
        mimetyp: true,
        kostnad: { select: { bostad_id: true } },
      },
    });
    // Bilagan maste finnas och hora till en kostnad i anvandarens bostad.
    if (!bilaga || bilaga.kostnad?.bostad_id !== params.bostadId) {
      return { ...TOMT_DOKUMENTFALT };
    }

    const format = kannIgenFormat(bilaga.mimetyp, bilaga.filnamn);
    if (!format) return { ...TOMT_DOKUMENTFALT };

    const { data: blob, error } = await bilagelager().download(
      bilaga.lagringsnyckel,
    );
    if (error || !blob) return { ...TOMT_DOKUMENTFALT };

    const original = Buffer.from(await blob.arrayBuffer());
    return await analyseraDokumentbuffert(original, format);
  } catch {
    return { ...TOMT_DOKUMENTFALT };
  }
}
