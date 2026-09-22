import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { raknaPdfSidor } from "@/lib/lagring/pdf-sidor";

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
