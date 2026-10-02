import { describe, expect, it } from "vitest";
import { samlatBelopp } from "@/doman/berakningar";
import { byggK6aExport, type K6aExport, type K6aIndata } from "@/doman/export-k6a";
import type { Kostnad } from "@/doman/typer";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// docs/design.md, Exportvyn: "Exportvyn redovisar varje krona som lagts in."
// Det som inte star pa sida 1 eller sida 2 syns som det som aterstar – en
// oklassificerad hog, ett kvitto som inte ligger i nagon hog, eller ett kvitto
// utan betaldatum. Uppmatt 2026-10-02: Totalt inlagt 1 049 225 kr, exportens
// enda summa 49 225 kr, och miljonen syntes ingenstans.

function bygg(over: Partial<K6aIndata>): K6aIndata {
  return {
    bostad: {
      upplatelseform: "bostadsratt",
      tilltradesdatum: "2022-06-06",
      forsaljningsdatum: null,
      nybyggd_vid_forvarv: false,
    },
    medlemskap: { agarandel: 100 },
    projekt: [],
    kostnader: [],
    regelparametrar: REGELPARAMETRAR,
    ...over,
  };
}

/** Allt sidan visar som belopp: sida 1:s rader, sida 2:s underlag, och
 *  listan over det som aterstar. Ingen krona far fattas. */
function allaVisadeKronor(ex: K6aExport): number {
  const sida1 = ex.sida1.rader.reduce((s, r) => s + r.belopp_brutto, 0);
  const sida2 = ex.sida2.rader.reduce((s, r) => s + r.belopp_brutto, 0);
  const hogar = ex.oklassificerade_hogar.reduce((s, h) => s + h.belopp_brutto, 0);
  const kvitton = ex.aterstaende_kvitton.reduce((s, k) => s + k.belopp_brutto, 0);
  return sida1 + sida2 + hogar + kvitton;
}

const EL_FIX = projekt({ id: "elfix", namn: "El fix", atgardstyp: "planlosning" });
const NORDSTROM = kostnad({
  id: "nordstrom",
  betaldatum: "2026-09-08",
  totalbelopp: 6_081_250,
  rot_utnyttjat: 1_158_750,
  projekt_id: "elfix",
});
const BYGGMAX = kostnad({
  id: "byggmax",
  betaldatum: "2026-09-12",
  totalbelopp: 100_000_000,
  projekt_id: null,
});

describe("exportvyn redovisar varje krona", () => {
  it("ett klassificerat och ett oklassificerat kvitto: det visade ar lika med Totalt inlagt", () => {
    const kostnader = [NORDSTROM, BYGGMAX];
    const ex = byggK6aExport(bygg({ projekt: [EL_FIX], kostnader }));
    expect(ex.ruta4_brutto).toBe(4_922_500);
    expect(ex.aterstaende_kvitton).toEqual([
      { kostnad_id: "byggmax", ar: 2026, belopp_brutto: 100_000_000, orsak: "utan_hog" },
    ]);
    expect(allaVisadeKronor(ex)).toBe(samlatBelopp({ kostnader }));
    expect(allaVisadeKronor(ex)).toBe(104_922_500);
  });

  it("ett kvitto utan betaldatum aterstar, aven nar det ligger i en hog", () => {
    const obetald = kostnad({ id: "obetald", betaldatum: null, totalbelopp: 250_000, projekt_id: "elfix" });
    const kostnader = [NORDSTROM, obetald];
    const ex = byggK6aExport(bygg({ projekt: [EL_FIX], kostnader }));
    expect(ex.aterstaende_kvitton).toEqual([
      { kostnad_id: "obetald", ar: null, belopp_brutto: 250_000, orsak: "utan_betaldatum" },
    ]);
    expect(allaVisadeKronor(ex)).toBe(samlatBelopp({ kostnader }));
  });

  it("en oklassificerad hog och en delvis kopplad rad gar ocksa ihop", () => {
    const hog = projekt({ id: "hog", namn: "Hög 1", atgardstyp: null });
    const iHog = kostnad({ id: "ihog", betaldatum: "2026-03-01", totalbelopp: 700_000, projekt_id: "hog" });
    // 10 000 kr med 3 000 kr ROT, 60 % kopplat till El fix – resten ligger
    // okopplat och aterstar: 4 200 kr pa sidan, 2 800 kr kvar.
    const delvis = kostnad({
      id: "delvis",
      betaldatum: "2026-05-01",
      totalbelopp: 1_000_000,
      rot_utnyttjat: 300_000,
      projekt_id: "elfix",
      andel: 0.6,
    });
    const kostnader: Kostnad[] = [NORDSTROM, BYGGMAX, iHog, delvis];
    const ex = byggK6aExport(bygg({ projekt: [EL_FIX, hog], kostnader }));
    expect(ex.oklassificerade_hogar).toEqual([{ namn: "Hög 1", ar: 2026, belopp_brutto: 700_000 }]);
    expect(ex.aterstaende_kvitton).toContainEqual({
      kostnad_id: "delvis",
      ar: 2026,
      belopp_brutto: 280_000,
      orsak: "utan_hog",
    });
    expect(allaVisadeKronor(ex)).toBe(samlatBelopp({ kostnader }));
  });

  it("utkast, arkiverade och privata delar aterstar inte – de ar inte inlagda", () => {
    const kostnader: Kostnad[] = [
      NORDSTROM,
      kostnad({ id: "arkiverad", arkiverad: true, projekt_id: null }),
      { ...kostnad({ id: "utkast", projekt_id: null }), totalbelopp: null },
      kostnad({
        id: "privat",
        betaldatum: "2026-04-01",
        totalbelopp: 100_000,
        rader: [
          { artikel: "slang", belopp: 100_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] },
        ],
      }),
    ];
    const ex = byggK6aExport(bygg({ projekt: [EL_FIX], kostnader }));
    expect(ex.aterstaende_kvitton).toEqual([]);
    expect(allaVisadeKronor(ex)).toBe(samlatBelopp({ kostnader }));
  });
});
