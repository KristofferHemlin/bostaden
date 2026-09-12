// Bilagepaketets radurval och kopplingen bilaga-till-rad (docs/produktspec.md
// avsnitt 8, "Bilagepaketet som PDF"). Testas mot den riktiga
// byggK6aExport-sammanstallningen, precis som export-k6a.test.ts, eftersom det
// ar samma rader som PDF-paketet ska hanga sina bilagor pa.

import { describe, expect, it } from "vitest";
import { byggBilageforteckning, type BilagepaketKostnad } from "@/doman/bilagepaket";
import { byggK6aExport, type K6aExport, type K6aIndata } from "@/doman/export-k6a";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

function bygg(over: Partial<K6aIndata>): K6aIndata {
  return {
    bostad: {
      upplatelseform: "bostadsratt",
      tilltradesdatum: "2010-01-01",
      forsaljningsdatum: "2032-06-01",
    },
    medlemskap: { agarandel: 100 },
    projekt: [],
    kostnader: [],
    regelparametrar: REGELPARAMETRAR,
    ...over,
  };
}

function alla(ex: K6aExport) {
  return [...ex.sida1.rader, ...ex.sida2.rader];
}

function bk(over: Partial<BilagepaketKostnad> = {}): BilagepaketKostnad {
  return { betaldatum: null, bilagaIder: [], ...over };
}

describe("byggBilageforteckning – radurvalet", () => {
  it("en rad som redovisas med 0 kr (under troskeln) far inga bilagor", () => {
    const p = projekt({ id: "p1", kategori: "grundforbattring", namn: "Liten atgard" });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 421_000, // under 5 000 kr-troskeln
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    expect(ex.sida1.rader.find((r) => r.atgard === "Liten atgard")?.belopp_brutto).toBe(0);

    const kostnader = new Map([["k1", bk({ bilagaIder: ["b1"] })]]);
    const poster = byggBilageforteckning(alla(ex), kostnader);
    expect(poster).toEqual([]);
  });

  it("en rad med belopp over noll far sina bilagor, numrerade fran 1", () => {
    const p = projekt({ id: "p1", kategori: "grundforbattring", namn: "Nytt kök" });
    const k = kostnad({ id: "k1", betaldatum: "2030-04-01", totalbelopp: 800_000, projekt_id: "p1" });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));

    const kostnader = new Map([["k1", bk({ bilagaIder: ["b1", "b2"] })]]);
    const poster = byggBilageforteckning(alla(ex), kostnader);

    expect(poster.map((post) => post.bilagaId)).toEqual(["b1", "b2"]);
    expect(poster.map((post) => post.nummer)).toEqual([1, 2]);
    expect(poster[0]).toMatchObject({
      kostnadId: "k1",
      atgard: "Nytt kök",
      ar: 2030,
      sida: 1,
    });
  });
});

describe("byggBilageforteckning – kopplingen bilaga till rad", () => {
  it("flera kostnader pa samma rad ordnas efter betaldatum, bilagorna i uppladdningsordning", () => {
    const p = projekt({ id: "p1", kategori: "grundforbattring", namn: "Bygga altan" });
    const senare = kostnad({ id: "k1", betaldatum: "2030-06-01", totalbelopp: 400_000, projekt_id: "p1" });
    const tidigare = kostnad({ id: "k2", betaldatum: "2030-01-08", totalbelopp: 300_000, projekt_id: "p1" });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [senare, tidigare] }));

    const kostnader = new Map([
      ["k1", bk({ betaldatum: "2030-06-01", bilagaIder: ["b-k1"] })],
      ["k2", bk({ betaldatum: "2030-01-08", bilagaIder: ["b-k2-forst", "b-k2-sist"] })],
    ]);
    const poster = byggBilageforteckning(alla(ex), kostnader);

    // k2 betalades forst -> dess bilagor kommer forst, i sin egen uppladdningsordning.
    expect(poster.map((post) => post.bilagaId)).toEqual([
      "b-k2-forst",
      "b-k2-sist",
      "b-k1",
    ]);
    expect(poster.map((post) => post.kostnadId)).toEqual(["k2", "k2", "k1"]);
  });

  it("en kostnad utan registrerade bilagor bidrar med inga poster", () => {
    const p = projekt({ id: "p1", kategori: "grundforbattring", namn: "Nytt kök" });
    const k = kostnad({ id: "k1", betaldatum: "2030-04-01", totalbelopp: 800_000, projekt_id: "p1" });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));

    const kostnader = new Map([["k1", bk()]]); // bilagaIder: []
    expect(byggBilageforteckning(alla(ex), kostnader)).toEqual([]);
  });
});

describe("byggBilageforteckning – arkiverat och privatmarkerat kommer inte med", () => {
  it("en arkiverad kostnads bilagor kommer inte med, aven om de finns i bilagekartan", () => {
    const p = projekt({ id: "p1", kategori: "grundforbattring", namn: "Nytt kök" });
    const arkiveradKostnad = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
      arkiverad: true,
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [arkiveradKostnad] }));
    expect(ex.ruta4_brutto).toBe(0);

    const kostnader = new Map([["k1", bk({ bilagaIder: ["b1"] })]]);
    expect(byggBilageforteckning(alla(ex), kostnader)).toEqual([]);
  });

  it("en kostnad vars enda rad ar privatmarkerad kommer inte med", () => {
    const p = projekt({ id: "p1", kategori: "grundforbattring", namn: "Nytt kök" });
    const privatKostnad = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 800_000,
      rader: [
        {
          artikel: "Privat pryl",
          belopp: 800_000,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [privatKostnad] }));
    expect(ex.ruta4_brutto).toBe(0);

    const kostnader = new Map([["k1", bk({ bilagaIder: ["b1"] })]]);
    expect(byggBilageforteckning(alla(ex), kostnader)).toEqual([]);
  });
});
