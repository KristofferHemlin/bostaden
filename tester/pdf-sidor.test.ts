import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { lasPdfInfo, raknaPdfSidor } from "@/lib/lagring/pdf-sidor";

// Sidantalet i en PDF (docs/design.md, "Bilagor": "En PDF med flera sidor
// visas med alla sidor"). Genererar riktiga PDF:er med pdf-lib (redan ett
// beroende) och kor dem genom den FAKTISKA unpdf/pdfjs-dist-kedjan – inget
// mockat har.
//
// Bara sidantalet lases HAR – ingen rendering. Sjalva sidorna renderas i
// webblasaren (src/lib/pdfjs-klient.ts); se den langa kommentaren i
// src/lib/lagring/pdf-sidor.ts for varfor (en verklig PDF med inbaddade
// bilder/vektorgrafik avslojade riktiga kompatibilitetsluckor i pdfjs-dist:s
// server-sida canvas-rendering, som lasning av sidtradet aldrig ror vid).

async function byggTestPdf(antalSidor: number): Promise<Buffer> {
  const dok = await PDFDocument.create();
  const font = await dok.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= antalSidor; i++) {
    const sida = dok.addPage([400, 300]);
    sida.drawText(`Sida ${i}`, { x: 50, y: 150, size: 24, font });
  }
  return Buffer.from(await dok.save());
}

describe("raknaPdfSidor", () => {
  it("raknar sidorna i ett flersidigt dokument", async () => {
    const pdf = await byggTestPdf(3);
    await expect(raknaPdfSidor(pdf)).resolves.toBe(3);
  });

  it("en enda sida ger 1", async () => {
    const pdf = await byggTestPdf(1);
    await expect(raknaPdfSidor(pdf)).resolves.toBe(1);
  });

  it("kastar for ett trasigt/oläsbart dokument", async () => {
    await expect(raknaPdfSidor(Buffer.from("inte en pdf alls"))).rejects.toThrow();
  });
});

// Forsta sidans matt (docs/produktspec.md, "PDF-sidor renderas i
// webbläsaren": "För en PDF ger första sidans proportioner samma sak och
// läses när sidantalet läses"). Anvands for att reservera ratt yta at
// forhandsvisningen innan filen hamtats (src/app/kostnad/[id]/bilagor.tsx).
describe("lasPdfInfo", () => {
  it("laser sidantal och forsta sidans matt i samma anrop", async () => {
    const pdf = await byggTestPdf(2);
    await expect(lasPdfInfo(pdf)).resolves.toEqual({
      sidantal: 2,
      bredd: 400,
      hojd: 300,
    });
  });

  it("mattet galler forsta sidan aven om senare sidor har andra matt", async () => {
    const dok = await PDFDocument.create();
    const font = await dok.embedFont(StandardFonts.Helvetica);
    const forsta = dok.addPage([400, 300]);
    forsta.drawText("Sida 1", { x: 50, y: 150, size: 24, font });
    const andra = dok.addPage([600, 800]);
    andra.drawText("Sida 2", { x: 50, y: 150, size: 24, font });
    const pdf = Buffer.from(await dok.save());

    await expect(lasPdfInfo(pdf)).resolves.toEqual({
      sidantal: 2,
      bredd: 400,
      hojd: 300,
    });
  });

  it("kastar for ett trasigt/oläsbart dokument", async () => {
    await expect(lasPdfInfo(Buffer.from("inte en pdf alls"))).rejects.toThrow();
  });
});
