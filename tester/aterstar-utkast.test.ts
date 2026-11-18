import { describe, expect, it } from "vitest";
import { samlatBelopp } from "@/doman/berakningar";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import type { Kostnad } from "@/doman/typer";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// docs/design.md, Skarmuppbyggnad: "Ett utkast med en bilaga ar pengar i
// arkivet och ska synas i Återstår." Urvalet (utkast_som_inte_ar_tomma) gors
// i databasen med kvittolistans regel; att ett utkast UTAN bilaga men med
// falt kommer med prova i tester/utkast-utan-bilaga.test.ts, genom sidan. Den som fotat en faktura, fatt
// avlasningen att falla och lagt undan telefonen ska hitta kvittot pa den
// skarm hon oppnar den dag hon saljer. Utkastet har inget belopp, och listan
// filtrerade pa belopp – darfor foll det bort i tysthet.

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
    utkast_som_inte_ar_tomma: [],
    regelparametrar: REGELPARAMETRAR,
    ...over,
  };
}

function utkast(id: string, over: Partial<Kostnad> = {}): Kostnad {
  return {
    id,
    totalbelopp: null,
    betaldatum: null,
    dokumentdatum: null,
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader: [],
    ...over,
  };
}

const FOTAT = utkast("fotat");
const TOMT = utkast("tomt");

describe("utkast i Återstår", () => {
  it("ett utkast med bilaga star i Återstår som 'utan_belopp', utan tal och utan ar", () => {
    const ex = byggK6aExport(bygg({ kostnader: [FOTAT], utkast_som_inte_ar_tomma: ["fotat"] }));
    expect(ex.aterstaende_kvitton).toEqual([
      { kostnad_id: "fotat", ar: null, belopp_brutto: null, orsak: "utan_belopp" },
    ]);
  });

  it("ett utkast som inte star bland de icke-tomma ar ingenting och syns inte", () => {
    const ex = byggK6aExport(bygg({ kostnader: [TOMT], utkast_som_inte_ar_tomma: [] }));
    expect(ex.aterstaende_kvitton).toEqual([]);
  });

  it("ett utkast med bilaga som satts at sidan syns inte, som andra arkiverade", () => {
    const ex = byggK6aExport(
      bygg({ kostnader: [utkast("ataside", { arkiverad: true })], utkast_som_inte_ar_tomma: ["ataside"] }),
    );
    expect(ex.aterstaende_kvitton).toEqual([]);
  });

  it("ett sparat kvitto med bilaga paverkas inte av att det har en bilaga", () => {
    const p = projekt({ id: "p1", atgardstyp: "planlosning" });
    const k = kostnad({ id: "sparat", betaldatum: "2026-05-01", totalbelopp: 600_000, projekt_id: "p1" });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k], utkast_som_inte_ar_tomma: ["sparat"] }));
    expect(ex.aterstaende_kvitton).toEqual([]);
  });

  it("utkastet raknas aldrig som noll – kronorna stammer, och raden finns anda", () => {
    const byggmax = kostnad({ id: "byggmax", betaldatum: "2026-09-12", totalbelopp: 250_000, projekt_id: null });
    const kostnader = [byggmax, FOTAT];
    const ex = byggK6aExport(bygg({ kostnader, utkast_som_inte_ar_tomma: ["fotat"] }));
    const medBelopp = ex.aterstaende_kvitton.flatMap((k) => (k.belopp_brutto === null ? [] : [k.belopp_brutto]));
    expect(medBelopp.reduce((s, b) => s + b, 0)).toBe(samlatBelopp({ kostnader }));
    expect(ex.aterstaende_kvitton.filter((k) => k.belopp_brutto === null)).toHaveLength(1);
  });
});
