import { describe, expect, it } from "vitest";
import { blankettTexter } from "@/doman/blankett";

// Produktspec 4.9: blankettnamnet i exporten foljer upplatelseformen – K5 for
// fastighet, K6 for bostadsratt. Galler varje stalle namnet star: den
// inledande meningen och raderna for ruta 4 och ruta 5. Exportvyn och
// bilagepaketets PDF hamtar texterna harifran.

describe("blankettnamnet foljer upplatelseformen", () => {
  it("fastighet: K5 i inledningen och pa bada rutraderna", () => {
    const t = blankettTexter("fastighet");
    expect(t.blankett).toBe("K5");
    expect(t.inledning).toBe(
      "Sammanställningen följer Skatteverkets hjälpblankett SKV 2197 och pekar ut vad som förs till K5. Den lämnas inte in – spara den.",
    );
    expect(t.ruta4).toBe("Förs till K5, ruta 4");
    expect(t.ruta5).toBe("Förs till K5, ruta 5");
  });

  it("bostadsratt: K6 i inledningen och pa bada rutraderna", () => {
    const t = blankettTexter("bostadsratt");
    expect(t.blankett).toBe("K6");
    expect(t.inledning).toBe(
      "Sammanställningen följer Skatteverkets hjälpblankett SKV 2197 och pekar ut vad som förs till K6. Den lämnas inte in – spara den.",
    );
    expect(t.ruta4).toBe("Förs till K6, ruta 4");
    expect(t.ruta5).toBe("Förs till K6, ruta 5");
  });

  it("fastighetens texter namner aldrig K6", () => {
    const t = blankettTexter("fastighet");
    for (const text of [t.inledning, t.ruta4, t.ruta5]) {
      expect(text).not.toContain("K6");
    }
  });

  it("bostadsrattens texter namner aldrig K5", () => {
    const t = blankettTexter("bostadsratt");
    for (const text of [t.inledning, t.ruta4, t.ruta5]) {
      expect(text).not.toContain("K5");
    }
  });
});
