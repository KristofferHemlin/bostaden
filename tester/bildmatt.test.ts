import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { lasBildmatt } from "@/lib/lagring/bildmatt";

// Bildens matt (docs/produktspec.md, "PDF-sidor renderas i webbläsaren":
// "Bildens mått lagras av samma skäl... Utan dem vet sidan inte hur hög
// förhandsvisningen blir förrän filen hämtats"). Genererar riktiga bilder med
// sharp (redan ett beroende) och kor dem genom den FAKTISKA lasBildmatt –
// inget mockat har.

async function byggTestBild(bredd: number, hojd: number): Promise<Buffer> {
  return sharp({
    create: {
      width: bredd,
      height: hojd,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("lasBildmatt", () => {
  it("laser en liggande bilds matt", async () => {
    const bild = await byggTestBild(800, 600);
    await expect(lasBildmatt(bild)).resolves.toEqual({ bredd: 800, hojd: 600 });
  });

  it("laser en staende bilds matt", async () => {
    const bild = await byggTestBild(600, 800);
    await expect(lasBildmatt(bild)).resolves.toEqual({ bredd: 600, hojd: 800 });
  });

  it("mattet foljer EXIF-orienteringen – en 90-gradersroterad bild byter hall", async () => {
    const rak = await byggTestBild(800, 600);
    // Orientering 6 = rotera 90° medurs vid visning (vanligt for telefonfoton
    // tagna i stående hall men lagrade liggande). skalaTillMiniatyr/
    // skalaTillVisningsversion anvander samma `.rotate()`-baserade
    // autoorientering – matten maste stamma overens med DEM, annars reserverar
    // forhandsvisningen fel hall pa ytan (docs/produktspec.md).
    const roterad = await sharp(rak).withMetadata({ orientation: 6 }).toBuffer();

    await expect(lasBildmatt(roterad)).resolves.toEqual({ bredd: 600, hojd: 800 });
  });

  it("kastar for data som inte ar en bild", async () => {
    await expect(lasBildmatt(Buffer.from("inte en bild alls"))).rejects.toThrow();
  });
});
