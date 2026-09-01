// HEIC-hantering. ENDAST server.
//
// HEIC ar standardformatet pa iPhone och kan inte visas av nagon webblasare.
// Originalet sparas oforandrat – det ar originalhandlingen – men en visningsbar
// JPG-miniatyr genereras vid uppladdningen. Utan den ser anvandaren ett tomt
// falt dar kvittot borde vara (produktspec 12).
//
// heic-convert dekodar HEVC-HEIC (det som sharps forbyggda binar inte klarar);
// sharp gor sedan om resultatet till en nedskalad, roterad JPG.

import "server-only";
import convert from "heic-convert";
import sharp from "sharp";

const MAX_KANT = 1600;

export async function heicTillJpegMiniatyr(original: Buffer): Promise<Buffer> {
  const jpeg = await convert({
    buffer: new Uint8Array(original),
    format: "JPEG",
    quality: 0.9,
  });

  return sharp(Buffer.from(jpeg))
    .rotate() // foljer EXIF-orienteringen fran telefonen
    .resize(MAX_KANT, MAX_KANT, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
}
