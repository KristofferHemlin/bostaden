import { describe, expect, it } from "vitest";
import { foreslaHogar, hogNamnForslag } from "@/doman/genomgang";
import type { GenomgangsKvitto } from "@/doman/genomgang";

function kv(over: Partial<GenomgangsKvitto> & { id: string }): GenomgangsKvitto {
  return {
    leverantor: over.leverantor ?? "Bauhaus Bromma",
    anteckning: over.anteckning ?? null,
    datum: over.datum ?? "2026-08-01",
    id: over.id,
  };
}

describe("foreslaHogar – fas 1 i klassificeringsgenomgangen", () => {
  it("tre Bauhaus-kvitton inom en manad med liknande anteckning blir ETT forslag", () => {
    const kvitton = [
      kv({
        id: "a",
        anteckning: "Målade om sovrummet, väggarna slitna sedan inflytt",
        datum: "2026-08-01",
      }),
      kv({
        id: "b",
        anteckning: "Mer väggfärg till sovrummet",
        datum: "2026-08-10",
      }),
      kv({
        id: "c",
        anteckning: "Penslar och roller till sovrumsmålningen",
        datum: "2026-08-22",
      }),
    ];

    const forslag = foreslaHogar(kvitton);

    expect(forslag).toHaveLength(1);
    // Kvitto-iderna kommer i datumordning.
    expect(forslag[0].kvitto_ider).toEqual(["a", "b", "c"]);
    // Namnet foreslas fran forsta kvittots anteckning, kapat vid forsta skiljetecknet.
    expect(forslag[0].namn).toBe("Målade om sovrummet");
  });

  it("kvitton med olika leverantor, manader isar och oslaktade anteckningar ger inget forslag", () => {
    const kvitton = [
      kv({
        id: "a",
        leverantor: "Bauhaus Bromma",
        anteckning: "Målade sovrum",
        datum: "2026-01-05",
      }),
      kv({
        id: "b",
        leverantor: "Elgiganten",
        anteckning: "Ny diskmaskin till köket",
        datum: "2026-09-20",
      }),
    ];

    expect(foreslaHogar(kvitton)).toEqual([]);
  });

  it("samma leverantor men ett halvar isar grupperas inte pa leverantoren ensam", () => {
    const kvitton = [
      kv({ id: "a", anteckning: "Spik och skruv", datum: "2026-01-10" }),
      kv({ id: "b", anteckning: "Fogmassa", datum: "2026-07-20" }),
    ];

    expect(foreslaHogar(kvitton)).toEqual([]);
  });

  it("liknande anteckningar knyter ihop aven nar leverantoren skiljer sig", () => {
    const kvitton = [
      kv({
        id: "a",
        leverantor: "Bauhaus Bromma",
        anteckning: "Nytt kök: bänkskiva och luckor",
        datum: "2026-03-01",
      }),
      kv({
        id: "b",
        leverantor: "Kvänum Kök",
        anteckning: "Nytt kök – montering av luckor och bänkskiva",
        datum: "2026-03-20",
      }),
    ];

    const forslag = foreslaHogar(kvitton);
    expect(forslag).toHaveLength(1);
    expect(forslag[0].kvitto_ider).toEqual(["a", "b"]);
  });

  it("namnforslaget faller tillbaka pa leverantoren nar anteckning saknas", () => {
    const kvitton = [
      kv({ id: "a", leverantor: "Byggmax", anteckning: null, datum: "2026-05-01" }),
      kv({ id: "b", leverantor: "Byggmax", anteckning: "", datum: "2026-05-08" }),
    ];

    const forslag = foreslaHogar(kvitton);
    expect(forslag).toHaveLength(1);
    expect(forslag[0].namn).toBe("Byggmax");
  });

  it("hogNamnForslag tar forsta kvittots anteckning, annars dess leverantor", () => {
    expect(
      hogNamnForslag([
        { anteckning: "Bytte köksblandaren som läckte", leverantor: "VVS-butiken" },
        { anteckning: "Följdkvitto", leverantor: "VVS-butiken" },
      ]),
    ).toBe("Bytte köksblandaren som läckte");

    expect(
      hogNamnForslag([{ anteckning: "  ", leverantor: "Hornbach" }]),
    ).toBe("Hornbach");

    expect(hogNamnForslag([])).toBe("Ny hög");
  });
});
