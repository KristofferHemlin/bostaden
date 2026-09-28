import { describe, expect, it } from "vitest";
import { MAX_BILAGA_BYTES, avvisningVidVal } from "@/lib/lagring/bilaga-regler";

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
    ).toBe("Det formatet går inte att läsa – välj jpg, png eller pdf");
  });

  it("fel format vager tyngre an storleken", () => {
    expect(
      avvisningVidVal({ mimetyp: "video/mp4", storlek: 40 * MB, filnamn: "v.mp4" }),
    ).toBe("Det formatet går inte att läsa – välj jpg, png eller pdf");
  });

  it("avvisar en tom fil", () => {
    expect(
      avvisningVidVal({ mimetyp: "image/jpeg", storlek: 0, filnamn: "t.jpg" }),
    ).toBe("Filen är tom.");
  });
});
