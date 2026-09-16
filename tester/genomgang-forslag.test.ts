import { describe, expect, it } from "vitest";
import {
  foreslaHogar,
  fragetradetNamnForslag,
  hogVisningsnamn,
} from "@/doman/genomgang";
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

  it("ett forslag utan gemensam anteckning grupperas anda pa leverantoren", () => {
    const kvitton = [
      kv({ id: "a", leverantor: "Byggmax", anteckning: null, datum: "2026-05-01" }),
      kv({ id: "b", leverantor: "Byggmax", anteckning: "", datum: "2026-05-08" }),
    ];

    const forslag = foreslaHogar(kvitton);
    expect(forslag).toHaveLength(1);
    expect(forslag[0].kvitto_ider).toEqual(["a", "b"]);
  });
});

// Hogen far inget namn i fas 1 (produktspec, "Klassificeringsgenomgangen") –
// namnet ar svaret pa fragetradets forsta fraga, i fas 2.
describe("fragetradetNamnForslag – forvalet for fragetradets forsta fraga", () => {
  it("tar forsta (tidigaste) kvittots anteckning, kapad vid forsta skiljetecknet", () => {
    expect(
      fragetradetNamnForslag([
        { anteckning: "Bytte köksblandaren som läckte, gammal otät" },
        { anteckning: "Följdkvitto" },
      ]),
    ).toBe("Bytte köksblandaren som läckte");
  });

  it("lamnas TOMT nar anteckning saknas – faller aldrig tillbaka pa leverantoren", () => {
    expect(fragetradetNamnForslag([{ anteckning: null }])).toBe("");
    expect(fragetradetNamnForslag([{ anteckning: "  " }])).toBe("");
  });

  it("tom lista ger ett tomt forval", () => {
    expect(fragetradetNamnForslag([])).toBe("");
  });
});

// Fram till namnet finns visas hogen som antal och leverantorer
// (docs/design.md, "Klassificeringsgenomgangen"): "2 kvitton · BAUHAUS, Jysk".
describe("hogVisningsnamn – hogens visning i fas 1, innan den har ett namn", () => {
  it("listar leverantorer i forsta-forekomst-ordning, utan dubbletter", () => {
    expect(
      hogVisningsnamn([
        { leverantor: "BAUHAUS" },
        { leverantor: "Jysk" },
        { leverantor: "BAUHAUS" },
      ]),
    ).toBe("3 kvitton · BAUHAUS, Jysk");
  });

  it("ental bojs ratt: '1 kvitto', inte '1 kvitton'", () => {
    expect(hogVisningsnamn([{ leverantor: "Hornbach" }])).toBe(
      "1 kvitto · Hornbach",
    );
  });

  it("saknar alla kvitton leverantor blir det bara antalet", () => {
    expect(hogVisningsnamn([{ leverantor: null }, { leverantor: null }])).toBe(
      "2 kvitton",
    );
  });
});
