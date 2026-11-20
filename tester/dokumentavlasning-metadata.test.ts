import { PDFDocument, PDFName } from "pdf-lib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Filens metadata tas bort innan den skickas till språkmodellen
// (src/lib/dokumentavlasning/metadata.ts, integritetspolicyn avsnitt 4). Till
// 2026-11-20 gick originalfilen som base64, med sin EXIF – ett mobilfoto kan
// bära platsen det togs på.
//
// Provet läser det som faktiskt skickas: SDK:t är utbytt mot en fånge som
// sparar anropet, och bilden i anropet avkodas och läses som en mottagare
// skulle läsa den.

const h = vi.hoisted(() => ({
  anrop: [] as { messages: { content: { type: string; source?: { data: string; media_type: string } }[] }[] }[],
  rapporter: [] as string[],
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: vi.fn(async (param: (typeof h.anrop)[number]) => {
        h.anrop.push(param);
        return { content: [{ type: "text", text: "{}" }], stop_reason: "end_turn" };
      }),
    };
  },
}));
vi.mock("@/lib/feltrapportering", () => ({
  rapporteraFel: (fel: Error) => void h.rapporter.push(fel.message),
}));

import { analyseraDokumentbuffert } from "@/lib/dokumentavlasning/analysera";
import { utanMetadata } from "@/lib/dokumentavlasning/metadata";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";

const MARKOR = "Storgatan 1";
const GPS_TAGG = [Buffer.from([0x25, 0x88]), Buffer.from([0x88, 0x25])];
const harGps = (exif: Buffer | undefined) => !!exif && GPS_TAGG.some((t) => exif.includes(t));

/** Ett foto som en telefon skriver det: liggande pixlar, orientering 6, plats och en beskrivning. */
async function mobilfoto(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 20, channels: 3, background: "#ffffff" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { ImageDescription: `Kvitto ${MARKOR}` },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "59/1 20/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "18/1 4/1 0/1" },
    })
    .toBuffer();
}

async function pngMedMetadata(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: "#ffffff" } })
    .png()
    .withExif({ IFD0: { ImageDescription: `Kvitto ${MARKOR}` } })
    .toBuffer();
}

async function pdfMedMetadata(): Promise<Buffer> {
  const dok = await PDFDocument.create();
  dok.addPage([200, 200]);
  dok.setTitle(`Kvitto ${MARKOR}`);
  dok.setAuthor("Anna Andersson");
  dok.setProducer("Skanner-appen 4.2");
  const xmp = dok.context.stream(`<x:xmpmeta><dc:creator>Anna Andersson, ${MARKOR}</dc:creator></x:xmpmeta>`, {
    Type: "Metadata",
    Subtype: "XML",
  });
  dok.catalog.set(PDFName.of("Metadata"), dok.context.register(xmp));
  return Buffer.from(await dok.save({ useObjectStreams: false }));
}

const format = (mimetyp: string, filnamn: string) => kannIgenFormat(mimetyp, filnamn)!;

beforeEach(() => {
  h.anrop.length = 0;
  h.rapporter.length = 0;
  process.env.ANTHROPIC_API_KEY = "prov";
});

describe("det som skickas till språkmodellen bär ingen metadata", () => {
  it("JPEG: platsen och beskrivningen bort, bilden vriden rätt", async () => {
    const original = await mobilfoto();
    const in_ = await sharp(original).metadata();
    // Förutsättningarna: originalet bär plats, beskrivning och orientering.
    expect(harGps(in_.exif)).toBe(true);
    expect(original.includes(MARKOR)).toBe(true);
    expect([in_.width, in_.height, in_.orientation]).toEqual([40, 20, 6]);

    await analyseraDokumentbuffert(original, format("image/jpeg", "kvitto.jpg"));
    expect(h.anrop, "förutsättningen: anropet gjordes").toHaveLength(1);
    const kalla = h.anrop[0].messages[0].content[0].source!;
    expect(kalla.media_type).toBe("image/jpeg");
    const skickad = Buffer.from(kalla.data, "base64");
    const ut = await sharp(skickad).metadata();
    expect(ut.exif).toBeUndefined();
    expect(skickad.includes(MARKOR)).toBe(false);
    // Orienteringen tillämpad: bilden står som telefonen visade den.
    expect([ut.width, ut.height, ut.orientation]).toEqual([20, 40, undefined]);
  });

  it("PNG: metadatan bort", async () => {
    const original = await pngMedMetadata();
    expect((await sharp(original).metadata()).exif, "förutsättningen").toBeDefined();
    await analyseraDokumentbuffert(original, format("image/png", "kvitto.png"));
    const skickad = Buffer.from(h.anrop[0].messages[0].content[0].source!.data, "base64");
    expect(h.anrop[0].messages[0].content[0].source!.media_type).toBe("image/png");
    expect((await sharp(skickad).metadata()).exif).toBeUndefined();
    expect(skickad.includes(MARKOR)).toBe(false);
  });

  it("PDF: titel, författare, program och XMP bort – sidorna kvar", async () => {
    const original = await pdfMedMetadata();
    // Förutsättningarna, lästa som en mottagare läser dem. Informationsfälten
    // är UTF-16 i filen; XMP-strömmen står i klartext.
    const fore = await PDFDocument.load(original, { updateMetadata: false });
    expect([fore.getTitle(), fore.getAuthor(), fore.getProducer()]).toEqual([`Kvitto ${MARKOR}`, "Anna Andersson", "Skanner-appen 4.2"]);
    expect(original.includes(`Anna Andersson, ${MARKOR}`)).toBe(true);

    await analyseraDokumentbuffert(original, format("application/pdf", "faktura.pdf"));
    const kalla = h.anrop[0].messages[0].content[0].source!;
    expect(kalla.media_type).toBe("application/pdf");
    const skickad = Buffer.from(kalla.data, "base64");
    const dok = await PDFDocument.load(skickad, { updateMetadata: false });
    expect(dok.getPageCount()).toBe(1);
    // Inget av det – och inget pdf-lib skrivit in i stället.
    expect([dok.getTitle(), dok.getAuthor(), dok.getProducer(), dok.getCreator(), dok.getCreationDate()]).toEqual([
      undefined, undefined, undefined, undefined, undefined,
    ]);
    expect(dok.catalog.has(PDFName.of("Metadata"))).toBe(false);
    expect(skickad.includes("xmpmeta")).toBe(false);
  });

  it("går rensningen inte skickas ingenting, och rapporten bär bara formatet", async () => {
    const svar = await analyseraDokumentbuffert(Buffer.from("inte en pdf"), format("application/pdf", "faktura.pdf"));
    expect(svar.kord).toBe(false);
    expect(h.anrop).toHaveLength(0);
    expect(h.rapporter).toEqual(["Dokumentavläsning: metadata kunde inte rensas (pdf)"]);
  });
});

describe("utanMetadata", () => {
  it("HEIC går som förut genom avkodningen, som JPEG", async () => {
    // Avkodningen själv är prövad i miniatyrens prov; här bara att vägen är den.
    const heic = format("image/heic", "foto.heic");
    await expect(utanMetadata(Buffer.from("inte en heic"), heic)).rejects.toThrow();
  });
});
