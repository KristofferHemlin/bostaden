// Bildens matt (docs/produktspec.md, "PDF-sidor renderas i webbläsaren":
// "Bildens mått lagras av samma skäl"). ENDAST server. Lases vid
// uppladdningen, medan bilden anda ligger i minnet for miniatyr-/
// visningskonverteringen, och anvands for att reservera ratt yta at
// forhandsvisningen INNAN filen hamtats – utan dem vet sidan inte hur hog
// forhandsvisningen blir forran filen laddats ner, och allt under hoppar
// nedat nar bilden landar.
//
// Matten galler SA BILDEN VISAS – roterade enligt EXIF-orienteringen fran
// telefonen, precis som skalaTillMiniatyr/skalaTillVisningsversion redan gor
// med `.rotate()`. En ren `sharp(buffer).metadata()` rapporterar filens RAA
// bredd/hojd (fore EXIF-rotationen bakas in), vilket for ett foto taget i
// "stående" hall men lagrat liggande (EXIF-orientering 6/8) hade gett fel hall
// pa den reserverade ytan. Bilden kors darfor genom en riktig sharp-pipeline
// med `.rotate()` och mattet lases av UTDATAN i stallet, samma monster som
// resten av uppladdningen.

import "server-only";
import sharp from "sharp";

export interface Bildmatt {
  bredd: number;
  hojd: number;
}

/**
 * Lases av EFTER en ev. HEIC-avkodning – anroparen (bekraftaKostnadsbilaga)
 * skickar in samma fullstora buffert som miniatyren/visningsversionen skalas
 * fram ur, sa bilden bara avkodas en gang totalt.
 */
export async function lasBildmatt(buffer: Buffer): Promise<Bildmatt> {
  const { info } = await sharp(buffer)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  return { bredd: info.width, hojd: info.height };
}
