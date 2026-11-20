// Dokumentavlasning som laser bilagan fran Storage (produktspec, avsnittet
// "Dokumentavlasning"). ENDAST server.
//
// Nar anvandaren valjer en fil i kostnadsformularet skapas kostnaden direkt som
// ett UTKAST och filen laddas upp till sin riktiga plats via en signerad URL.
// Analysen laser filen darifran – den passerar aldrig en serverless-funktion
// (Vercels 4,5 MB-grans pa request-body). Ingen avlas/-mapp, ingen dubbel
// uppladdning, ingen stadning: filen ar redan kvittots skarpa bilaga.

import "server-only";
import { rapporteraFel } from "@/lib/feltrapportering";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";
import { bilagelager } from "@/lib/lagring/klient";
import { prisma } from "@/lib/prisma";
import { analyseraDokumentbuffert, type Dokumentavlasning } from "./analysera";
import { TOMT_DOKUMENTFALT } from "./tolkning";

export const KORDES_INTE: Dokumentavlasning = { kord: false, falt: { ...TOMT_DOKUMENTFALT } };

/**
 * Laser en (redan uppladdad) bilaga fran Storage och kor dokumentavlasningen pa
 * den. Kastar aldrig – vid varje fel (saknad nyckel, fel bostad, oläsbar fil,
 * timeout) returneras `kord: false` sa att formularet kan visa att avlasningen
 * inte kordes alls, i stallet for att tysta ihop det med falt som modellen
 * faktiskt forsokte men misslyckades med.
 *
 * Avlasningen kors EN GANG per bilaga. `dokument_analyserad` satts nar
 * sprakmodellanropet gjorts – oavsett utfall – och nasta gang utkastet oppnas
 * hoppas avlasningen over. Ett aterupptat utkast visar da de falt hon sparat
 * (sparaUtkastfalten), eller tomma falt om hon inte skrivit nagot, i stallet
 * for att kosta ett anrop och en vantan. Formularet kor dessutom aldrig
 * avlasningen pa ett ATERUPPTAGET utkast dar nagot falt ar ifyllt
 * (src/app/kostnad/nytt/form.tsx) – i ett nytt formular kors den nar filen
 * valts, och fyller da bara tomma falt.
 */
export async function analyseraKostnadsbilaga(params: {
  bostadId: string;
  bilagaId: string;
}): Promise<Dokumentavlasning> {
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
      return KORDES_INTE;
    }
    // Redan avlast en gang – returnera "kordes inte" (den har gangen) sa att
    // formularet inte visar tomma falt som ett nytt misslyckande.
    if (bilaga.dokument_analyserad) return KORDES_INTE;

    const format = kannIgenFormat(bilaga.mimetyp, bilaga.filnamn);
    if (!format) return KORDES_INTE;

    const { data: blob, error } = await bilagelager().download(
      bilaga.lagringsnyckel,
    );
    if (error || !blob) return KORDES_INTE;

    const original = Buffer.from(await blob.arrayBuffer());
    const { svar, ...resultat } = await analyseraDokumentbuffert(original, format);

    // Anropet ar gjort. Markera bilagan oavsett utfall sa att avlasningen inte
    // gors om. En misslyckad markering far inte svalja resultatet – det hon
    // ser nu ar lika riktigt – men den rapporteras: utan markeringen kan nasta
    // oppning kosta ett nytt modellanrop, och det inre felet nar aldrig det
    // yttre catchet (docs/design.md, "Ett kvittoutkast minns det hon skrev").
    try {
      await prisma.bilaga.update({
        where: { id: params.bilagaId },
        // Svaret som det kom, sa att avlasningen gar att prova i efterhand
        // (docs/design.md, "Modellens svar sparas med kvittot"). Null nar
        // inget svar kom. Det gar aldrig vidare till webblasaren – resultatet
        // nedan bar det inte.
        data: { dokument_analyserad: true, avlasningssvar: svar },
      });
    } catch (fel) {
      rapporteraFel(fel, {
        sida: "dokumentavlasning",
        anrop: "analyseraKostnadsbilaga (markeringen)",
      });
    }

    return resultat;
  } catch (fel) {
    // Avlasningen blockerar aldrig sparandet aven har (produktspec,
    // "Dokumentavlasning") – men nagon ska anda fa veta att den slutat
    // fungera, sa den rapporteras i stallet for att tystna helt (produktspec
    // avsnitt 13, punkt 1). bilagaId ar bara ett id, ingen kvittodata.
    rapporteraFel(fel, {
      sida: "dokumentavlasning",
      anrop: "analyseraKostnadsbilaga",
    });
    return KORDES_INTE;
  }
}
