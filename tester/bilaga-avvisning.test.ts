import { describe, expect, it } from "vitest";
import { MAX_BILAGA_BYTES, avvisningVidVal, valideraBilaga } from "@/lib/lagring/bilaga-regler";

// docs/design.md, "Bilagor": avvisas filen tar felet formathjalpens plats och
// sager ORSAKEN – med filens verkliga storlek och den faktiska gransen, eller
// vilket format som gar att valja – i stallet for att upprepa listan.

const MB = 1024 * 1024;

describe("avvisningVidVal", () => {
  it("godtar en giltig fil", () => {
    expect(
      avvisningVidVal({ mimetyp: "image/jpeg", storlek: 2 * MB, filnamn: "k.jpg" }),
    ).toBeNull();
    expect(
      avvisningVidVal({ mimetyp: "image/jpeg", storlek: MAX_BILAGA_BYTES, filnamn: "k.jpg" }),
    ).toBeNull();
  });

  it("sager filens verkliga storlek och gransen for en for stor bild", () => {
    expect(
      avvisningVidVal({ mimetyp: "image/jpeg", storlek: 14 * MB, filnamn: "k.jpg" }),
    ).toBe("Bilden är 14 MB, gränsen går vid 10");
  });

  it("avrundar aldrig en for stor fil ned till gransen", () => {
    expect(
      avvisningVidVal({ mimetyp: "image/png", storlek: MAX_BILAGA_BYTES + 1, filnamn: "k.png" }),
    ).toBe("Bilden är 10,1 MB, gränsen går vid 10");
    expect(
      avvisningVidVal({ mimetyp: "image/png", storlek: 10.4 * MB, filnamn: "k.png" }),
    ).toBe("Bilden är 10,4 MB, gränsen går vid 10");
  });

  it("kallar en PDF for filen, inte bilden", () => {
    expect(
      avvisningVidVal({ mimetyp: "application/pdf", storlek: 23.6 * MB, filnamn: "f.pdf" }),
    ).toBe("Filen är 24 MB, gränsen går vid 10");
  });

  it("sager vad som gar att valja nar formatet ar fel", () => {
    expect(
      avvisningVidVal({ mimetyp: "image/gif", storlek: 1024, filnamn: "b.gif" }),
    ).toBe("Det formatet går inte att läsa – välj JPG, PNG, HEIC eller PDF.");
  });

  it("fel format vager tyngre an storleken", () => {
    expect(
      avvisningVidVal({ mimetyp: "video/mp4", storlek: 40 * MB, filnamn: "v.mp4" }),
    ).toBe("Det formatet går inte att läsa – välj JPG, PNG, HEIC eller PDF.");
  });

  it("avvisar en tom fil", () => {
    expect(
      avvisningVidVal({ mimetyp: "image/jpeg", storlek: 0, filnamn: "t.jpg" }),
    ).toBe("Filen är tom.");
  });
});

// Tva vagar till samma besked: avvisningVidVal nar filen valjs, valideraBilaga
// fore uppladdningen. De ska saga samma sak – och HEIC ska alltid sta med, sa
// att en iPhone-anvandare aldrig far intrycket att kamerans format inte duger.
describe("formatfelet ar detsamma vid valet och vid uppladdningen", () => {
  it("bada namner HEIC och slutar med punkt", () => {
    const fil = { mimetyp: "image/gif", storlek: 1024, filnamn: "b.gif" };
    const vidVal = avvisningVidVal(fil);
    const vidUppladdning = valideraBilaga(fil);
    expect(vidUppladdning).toEqual({ ok: false, fel: vidVal });
    expect(vidVal).toContain("HEIC");
    expect(vidVal?.endsWith(".")).toBe(true);
  });
});
