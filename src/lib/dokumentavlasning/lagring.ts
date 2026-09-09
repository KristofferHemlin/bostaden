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
 *
 * Avlasningen kors EN GANG per bilaga. `dokument_analyserad` satts nar
 * sprakmodellanropet gjorts – oavsett utfall – och nasta gang utkastet oppnas
 * hoppas avlasningen over. Ett aterupptat utkast visar da sina sparade varden
 * direkt i stallet for att kosta ett anrop och en vantan for ingenting.
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
        dokument_analyserad: true,
        kostnad: { select: { bostad_id: true } },
      },
    });
    // Bilagan maste finnas och hora till en kostnad i anvandarens bostad.
    if (!bilaga || bilaga.kostnad?.bostad_id !== params.bostadId) {
      return { ...TOMT_DOKUMENTFALT };
    }
    // Redan avlast en gang – returnera tomt sa att formularet visar sina
    // sparade varden utan nytt anrop.
    if (bilaga.dokument_analyserad) return { ...TOMT_DOKUMENTFALT };

    const format = kannIgenFormat(bilaga.mimetyp, bilaga.filnamn);
    if (!format) return { ...TOMT_DOKUMENTFALT };

    const { data: blob, error } = await bilagelager().download(
      bilaga.lagringsnyckel,
    );
    if (error || !blob) return { ...TOMT_DOKUMENTFALT };

    const original = Buffer.from(await blob.arrayBuffer());
    const falt = await analyseraDokumentbuffert(original, format);

    // Anropet ar gjort. Markera bilagan oavsett utfall sa att avlasningen inte
    // gors om. En misslyckad markering far inte svalja resultatet.
    try {
      await prisma.bilaga.update({
        where: { id: params.bilagaId },
        data: { dokument_analyserad: true },
      });
    } catch {
      // Nasta oppning kor avlasningen igen – inte varre an dagens beteende.
    }

    return falt;
  } catch {
    return { ...TOMT_DOKUMENTFALT };
  }
}
