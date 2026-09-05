import { describe, expect, it } from "vitest";
import { arOklassificerad, hogBehoverKlassificeras } from "@/doman/genomgang";
import { kostnad, projekt } from "./_hjalp";

describe("urvalet till klassificeringsgenomgangen", () => {
  it("en okopplad, ej arkiverad kostnad ingar i genomgangen", () => {
    const k = kostnad({ id: "k1", projekt_id: null });
    expect(arOklassificerad(k)).toBe(true);
  });

  it("en kostnad som redan har en projektfordelning ingar inte i fas 1", () => {
    const k = kostnad({ id: "k1", projekt_id: "p1" });
    expect(arOklassificerad(k)).toBe(false);
  });

  it("ett kvitto i 'Raknas inte' (arkiverad) ingar aldrig i genomgangen", () => {
    const k = kostnad({ id: "k1", projekt_id: null, arkiverad: true });
    expect(arOklassificerad(k)).toBe(false);
  });

  it("en kostnad vars enda fordelning ar privat raknas fortfarande som oklassificerad", () => {
    const k = kostnad({
      id: "k1",
      rader: [
        {
          artikel: "Torkställ",
          belopp: 100_000,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    expect(arOklassificerad(k)).toBe(true);
  });

  it("en hog utan kategori behover klassificeras (fas 2), en med kategori gor det inte", () => {
    expect(hogBehoverKlassificeras(projekt({ kategori: null }))).toBe(true);
    expect(
      hogBehoverKlassificeras(projekt({ kategori: "grundforbattring" })),
    ).toBe(false);
    expect(hogBehoverKlassificeras(projekt({ kategori: "reparation" }))).toBe(
      false,
    );
  });
});
