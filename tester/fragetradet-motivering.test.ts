import { describe, expect, it } from "vitest";
import { motiveringRelevant } from "@/doman/fragetradet";

// Produktspec 4.1: fraga 8 (motivering) visas bara nar fraga 6 (skick vid
// forvarvet) betyder nagot – 0, 1 eller 2. Vid 3 eller hogre, eller nar
// atgarden saknar reparationsdel (skickForvarv alltid ""), doljs faltet.
describe("motiveringRelevant", () => {
  it("visas vid skick 0, 1 och 2", () => {
    expect(motiveringRelevant("0")).toBe(true);
    expect(motiveringRelevant("1")).toBe(true);
    expect(motiveringRelevant("2")).toBe(true);
  });

  it("doljs vid skick 3, 4 och 5", () => {
    expect(motiveringRelevant("3")).toBe(false);
    expect(motiveringRelevant("4")).toBe(false);
    expect(motiveringRelevant("5")).toBe(false);
  });

  it("doljs nar atgarden saknar reparationsdel (skickForvarv aldrig stallt)", () => {
    expect(motiveringRelevant("")).toBe(false);
  });
});
