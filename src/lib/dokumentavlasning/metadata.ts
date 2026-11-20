// Filens metadata tas bort innan den skickas till sprakmodellen
// (integritetspolicyn, avsnitt 4). Ett mobilfoto kan bara EXIF med platsen
// det togs pa, en PDF sitt programs namn, sin forfattare och sin historik i
// XMP – ingenting av det har med en kvittoavlasning att gora. Till
// 2026-11-20 skickades originalfilen som den var, med sin metadata; HEIC
// forlorade den redan pa vagen genom avkodningen, JPEG, PNG och PDF gjorde
// det inte.
//
// Det som rensas:
//   - JPEG och PNG avkodas och kodas om av sharp, som inte skriver ut nagon
//     metadata (EXIF, XMP, IPTC, ICC) om den inte uttryckligen ombeds.
//     Orienteringen tillampas forst, sa att bilden star ratt utan den.
//   - HEIC som forut: avkodad och nedskalad till JPEG (heicTillJpegMiniatyr).
//   - PDF: dokumentets informationsordbok (titel, forfattare, program,
//     datum) och varje XMP-strom, pa dokumentet, sidorna och bilderna.
//
// Det som INTE rensas: EXIF inuti en JPEG som ligger inbaddad i en PDF.
// Bilddatat i en PDF ar en strom som pdf-lib inte avkodar, och att koda om
// den vore att skriva om dokumentet.
//
// Gar rensningen inte – en krypterad eller trasig PDF, en bild sharp inte
// kan lasa – skickas INGENTING. Avlasningen ar en hjalp, metadatan ett
// lofte.

import "server-only";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFStream } from "pdf-lib";
import sharp from "sharp";
import type { Bilageformat } from "@/lib/lagring/bilaga-regler";
import { heicTillJpegMiniatyr } from "@/lib/lagring/miniatyr";

export interface DokumentUtanMetadata {
  data: Buffer;
  mediatyp: "image/jpeg" | "image/png" | "application/pdf";
}

/** Kvaliteten nar en JPEG kodas om – hog nog for att tryckt text ska lasas som forut. */
export const JPEG_KVALITET = 92;

const METADATA = PDFName.of("Metadata");
const TYP = PDFName.of("Type");

async function pdfUtanMetadata(original: Buffer): Promise<Buffer> {
  // updateMetadata: false – annars skriver pdf-lib in sitt eget program och datum.
  const dokument = await PDFDocument.load(original, { updateMetadata: false });
  const sammanhang = dokument.context;

  const info = sammanhang.trailerInfo.Info;
  if (info) {
    sammanhang.delete(info as Parameters<typeof sammanhang.delete>[0]);
    sammanhang.trailerInfo.Info = undefined;
  }

  for (const [ref, objekt] of sammanhang.enumerateIndirectObjects()) {
    const ordbok = objekt instanceof PDFDict ? objekt : objekt instanceof PDFStream ? objekt.dict : null;
    if (!ordbok) continue;
    // En XMP-strom ar en egen strom med /Type /Metadata – ta bort den helt.
    if ((objekt instanceof PDFRawStream || objekt instanceof PDFStream) && ordbok.get(TYP) === METADATA) {
      sammanhang.delete(ref);
      continue;
    }
    // Och varje hanvisning till en, pa katalogen, sidorna och bilderna.
    if (ordbok.has(METADATA)) ordbok.delete(METADATA);
  }

  return Buffer.from(await dokument.save({ updateFieldAppearances: false }));
}

/** Filen som den skickas till sprakmodellen, utan metadata. Kastar om det inte gar. */
export async function utanMetadata(original: Buffer, format: Bilageformat): Promise<DokumentUtanMetadata> {
  if (format.andelse === "pdf") {
    return { data: await pdfUtanMetadata(original), mediatyp: "application/pdf" };
  }
  if (format.kraverMiniatyr) {
    return { data: await heicTillJpegMiniatyr(original), mediatyp: "image/jpeg" };
  }
  if (format.mimetyp === "image/png") {
    return { data: await sharp(original).rotate().png().toBuffer(), mediatyp: "image/png" };
  }
  if (format.mimetyp === "image/jpeg") {
    return { data: await sharp(original).rotate().jpeg({ quality: JPEG_KVALITET }).toBuffer(), mediatyp: "image/jpeg" };
  }
  throw new Error(`Okänt format för dokumentavläsningen: ${format.andelse}`);
}
