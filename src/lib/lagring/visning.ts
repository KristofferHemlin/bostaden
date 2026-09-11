// Visningsversionen: en nedskalad JPG med langsta sidan ~2000px. ENDAST
// server. Se produktspec avsnitt 9, "Visningsversion".
//
// Galler ALLA bildbilagor, inte bara HEIC – ett vanligt telefonfoto ar flera
// megabyte, och fyrtio sadana ger ett PDF-paket som inte gar att mejla.
// Anvands i helskarmsvisning (src/app/bilaga/[id]/route.ts) och senare i
// PDF-paketet (byggordningen steg 13). PDF-bilagor har ingen visningsversion.
//
// For HEIC skickas den redan avkodade fullstora bufferten in har (samma
// avkodning som miniatyren anvander, se miniatyr.ts) sa att heic-convert bara
// kors en gang per uppladdning. For JPG/PNG skickas originalbufferten in
// direkt – sharp lasker bada formaten utan foregaende konvertering.

import "server-only";
import sharp from "sharp";

const MAX_KANT_VISNING = 2000;

export async function skalaTillVisningsversion(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // foljer EXIF-orienteringen fran telefonen
    .flatten({ background: "#ffffff" }) // PNG kan ha alfakanal – JPG kan inte
    .resize(MAX_KANT_VISNING, MAX_KANT_VISNING, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
