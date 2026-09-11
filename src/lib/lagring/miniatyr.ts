// HEIC-hantering. ENDAST server.
//
// HEIC ar standardformatet pa iPhone och kan inte visas av nagon webblasare.
// Originalet sparas oforandrat – det ar originalhandlingen – men en visningsbar
// JPG-miniatyr genereras vid uppladdningen. Utan den ser anvandaren ett tomt
// falt dar kvittot borde vara (produktspec 12).
//
// heic-convert dekodar HEVC-HEIC (det som sharps forbyggda binar inte klarar)
// till en fullstor JPG. Den avkodningen ar det dyra steget och kors bara EN
// GANG per uppladdning: samma fullstora buffert aterAnvands sedan bade for
// miniatyren har och for visningsversionen (src/lib/lagring/visning.ts),
// istallet for att avkodas pa nytt (produktspec avsnitt 9, "Visningsversion").

import "server-only";
import convert from "heic-convert";
import sharp from "sharp";

const MAX_KANT_MINIATYR = 1600;

/** Avkodar HEIC/HEIF till en fullstor JPG-buffert. Inget nedskalat annu. */
export async function heicTillJpeg(original: Buffer): Promise<Buffer> {
  const jpeg = await convert({
    buffer: new Uint8Array(original),
    format: "JPEG",
    quality: 0.9,
  });
  return Buffer.from(jpeg);
}

/** Skalar en redan avkodad, fullstor JPG-buffert ner till listminiatyren. */
export async function skalaTillMiniatyr(fullstorJpeg: Buffer): Promise<Buffer> {
  return sharp(fullstorJpeg)
    .rotate() // foljer EXIF-orienteringen fran telefonen
    .resize(MAX_KANT_MINIATYR, MAX_KANT_MINIATYR, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}

/**
 * Avkodar och skalar i ett svep. Anvands av dokumentavlasningen
 * (src/lib/dokumentavlasning/analysera.ts), som bara behover miniatyren och
 * inte visningsversionen.
 */
export async function heicTillJpegMiniatyr(original: Buffer): Promise<Buffer> {
  const fullstor = await heicTillJpeg(original);
  return skalaTillMiniatyr(fullstor);
}
