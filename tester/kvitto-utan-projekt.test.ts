import { describe, expect, it } from "vitest";
import { arOklassificerad } from "@/doman/genomgang";
import { kostnad } from "./_hjalp";

// Vilka kvitton som är "utan projekt" – det kvittolistans kort räknar och det
// som går att hämta till ett projekt (src/doman/kvittokoppling.ts). Flyttat hit
// från genomgångens urvalstest när genomgången revs; urvalet lever vidare.

describe("ett kvitto utan projekt", () => {
  it("en okopplad, ej markerad kostnad är utan projekt", () => {
    expect(arOklassificerad(kostnad({ id: "k1", projekt_id: null }))).toBe(true);
  });

  it("en kostnad som redan har en projektfördelning är det inte", () => {
    expect(arOklassificerad(kostnad({ id: "k1", projekt_id: "p1" }))).toBe(false);
  });

  it("ett kvitto som inte hör till bostaden är det aldrig", () => {
    expect(arOklassificerad(kostnad({ id: "k1", projekt_id: null, arkiverad: true }))).toBe(false);
  });

  it("en kostnad vars enda fördelning är privat är fortfarande utan projekt", () => {
    const k = kostnad({
      id: "k1",
      rader: [{ artikel: "Torkställ", belopp: 100_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] }],
    });
    expect(arOklassificerad(k)).toBe(true);
  });
});
