import { describe, expect, it } from "vitest";
import { arEnkelKostnad } from "@/doman/berakningar";
import { domanKostnader } from "@/doman/seeddata";
import { kostnad } from "./_hjalp";

// Redigering av en kostnad (produktspec 6.4). Belopp och projektkoppling gar bara
// att andra i det vanliga formularet nar kostnaden ar "enkel" – en enda rad pa
// hela totalbeloppet med hogst en projektfordelning. En uppdelad kostnad andras
// per rad, vilket hor till ett senare steg; dar visas belopp och koppling som
// lasta. Leverantor och datum gar alltid att andra.

describe("arEnkelKostnad avgor vad redigeringsformularet slapper fram", () => {
  it("en rad pa hela beloppet med en projektfordelning (andel 1) ar enkel", () => {
    const k = kostnad({ totalbelopp: 100_000, projekt_id: "p1", andel: 1 });
    expect(arEnkelKostnad(k)).toBe(true);
  });

  it("en rad pa hela beloppet helt utan fordelning (okopplad) ar enkel", () => {
    const k = kostnad({ totalbelopp: 100_000, projekt_id: null });
    expect(arEnkelKostnad(k)).toBe(true);
  });

  it("Bauhaus-kvittot med fem rader ar inte enkelt", () => {
    const bauhaus = domanKostnader.find((k) => k.rader.length > 1)!;
    expect(arEnkelKostnad(bauhaus)).toBe(false);
  });

  it("en rad delvis fordelad (andel 0,6) ar inte enkel", () => {
    const k = kostnad({ totalbelopp: 100_000, projekt_id: "p1", andel: 0.6 });
    expect(arEnkelKostnad(k)).toBe(false);
  });

  it("en rad markerad som privat ar inte enkel", () => {
    const k = kostnad({
      totalbelopp: 100_000,
      rader: [
        {
          artikel: "torkstativ",
          belopp: 100_000,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    expect(arEnkelKostnad(k)).toBe(false);
  });

  it("radbelopp som inte summerar till totalbeloppet ar inte enkelt", () => {
    const k = kostnad({
      totalbelopp: 100_000,
      rader: [
        {
          artikel: "rad",
          belopp: 60_000,
          fordelningar: [{ projekt_id: "p1", privat: false, andel: 1 }],
        },
      ],
    });
    expect(arEnkelKostnad(k)).toBe(false);
  });
});
