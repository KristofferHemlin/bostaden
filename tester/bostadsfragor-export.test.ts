import { describe, expect, it } from "vitest";
import {
  byggK6aExport,
  VantarPaBostadsfragor,
  type K6aIndata,
} from "@/doman/export-k6a";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// Obesvarade bostadsfragor i exporten. Svaret avgor om reparationerna raknas,
// och darmed ocksa om ett ar passerar troskeln (CLAUDE.md, steg 3) – sa aven
// sida 1 beror av det. Finns en reparationsdel att rakna pa sammanstalls
// darfor ingenting alls: en summa som gar att lasa ar ett lofte om att den ar
// komplett, aven nar den ar for lag. Finns bara grundforbattringar andrar
// svaret ingenting, och underlaget gors som vanligt (docs/design.md, "Bandet
// syns bara när svaret ändrar något", 2026-11-27).

function bygg(
  nybyggd: boolean | null,
  over: Partial<K6aIndata> = {},
  forsaljningsdatum: string | null = "2032-06-01",
): K6aIndata {
  return {
    bostad: {
      upplatelseform: "bostadsratt",
      tilltradesdatum: "2010-01-01",
      forsaljningsdatum,
      nybyggd_vid_forvarv: nybyggd,
    },
    medlemskap: { agarandel: 100 },
    projekt: [],
    kostnader: [],
    utkast_som_inte_ar_tomma: [],
    regelparametrar: REGELPARAMETRAR,
    ...over,
  };
}

const ALTAN = projekt({ id: "p1", namn: "Altan", atgardstyp: "nybyggnad" });
const GOLV = projekt({
  id: "p2",
  namn: "Golv",
  atgardstyp: "utbytt",
  battre_kvalitet: false,
  skick_forvarv: 1,
  skick_forsaljning: 5,
});
const KVITTON = [
  kostnad({ id: "k1", projekt_id: "p1", totalbelopp: 300_000, betaldatum: "2030-03-01" }),
  kostnad({ id: "k2", projekt_id: "p2", totalbelopp: 300_000, betaldatum: "2030-03-01" }),
];

describe("obesvarade bostadsfragor och bara grundforbattringar: underlaget som vanligt", () => {
  // Till 2026-11-27 vantade aven det har pa svaret, och bandet stod over en
  // ren grundforbattring som svaret inte rorde. Talet ar detsamma vilket
  // svaret an blir: provat mot bada.
  it("en ren grundforbattring sammanstalls, med samma tal som vid bada svaren", () => {
    const altan = kostnad({ id: "k3", projekt_id: "p1", totalbelopp: 800_000, betaldatum: "2030-03-01" });
    const indata = { projekt: [ALTAN], kostnader: [altan] };
    const ex = byggK6aExport(bygg(null, indata));
    expect(ex.ruta4_brutto).toBe(800_000);
    expect(ex.ruta4_brutto).toBe(byggK6aExport(bygg(true, indata)).ruta4_brutto);
    expect(ex.ruta4_brutto).toBe(byggK6aExport(bygg(false, indata)).ruta4_brutto);
  });
});

describe("obesvarade bostadsfragor och en reparationsdel: ingenting sammanstalls", () => {

  it("en reparation – inte heller sida 2", () => {
    expect(() =>
      byggK6aExport(bygg(null, { projekt: [GOLV], kostnader: [KVITTON[1]] })),
    ).toThrow(VantarPaBostadsfragor);
  });

  it("aven innan bostaden ar sald", () => {
    expect(() =>
      byggK6aExport(bygg(null, { projekt: [ALTAN, GOLV], kostnader: KVITTON }, null)),
    ).toThrow(VantarPaBostadsfragor);
  });
});

describe("obesvarade bostadsfragor och ett byte som inte raknas: underlaget som vanligt", () => {
  // Svaret nollar bara en reparationsdel som annars hade raknats. Ar bytets
  // reparationsdel redan borta efter resten av steg 3 andrar svaret ingenting,
  // och underlaget vantar inte pa det (docs/design.md, "Bandet syns bara när
  // svaret ändrar något"). Varje fall provar talet mot bada svaren.
  const altan = kostnad({ id: "k3", projekt_id: "p1", totalbelopp: 800_000, betaldatum: "2030-03-01" });

  it("ett utbytt projekt med bara ett kvitto fore tilltradet", () => {
    const fore = kostnad({ id: "k4", projekt_id: "p2", totalbelopp: 300_000, betaldatum: "2009-06-01" });
    const indata = { projekt: [ALTAN, GOLV], kostnader: [altan, fore] };
    const ex = byggK6aExport(bygg(null, indata));
    expect(ex.ruta4_brutto).toBe(800_000);
    expect(ex.ruta5_brutto).toBe(0);
    expect(ex.ruta4_brutto).toBe(byggK6aExport(bygg(true, indata)).ruta4_brutto);
    expect(ex.ruta4_brutto).toBe(byggK6aExport(bygg(false, indata)).ruta4_brutto);
    expect(ex.ruta5_brutto).toBe(byggK6aExport(bygg(false, indata)).ruta5_brutto);
  });

  it("ett utbytt projekt vars reparation ligger utanfor femarsfonstret", () => {
    // Forsaljning 2032: fonstret borjar 2027, sa 2020 ar utanfor.
    const gammal = kostnad({ id: "k5", projekt_id: "p2", totalbelopp: 300_000, betaldatum: "2020-06-01" });
    const indata = { projekt: [ALTAN, GOLV], kostnader: [altan, gammal] };
    const ex = byggK6aExport(bygg(null, indata));
    expect(ex.ruta4_brutto).toBe(800_000);
    expect(ex.ruta5_brutto).toBe(0);
    expect(ex.ruta4_brutto).toBe(byggK6aExport(bygg(true, indata)).ruta4_brutto);
    expect(ex.ruta5_brutto).toBe(byggK6aExport(bygg(false, indata)).ruta5_brutto);
  });
});

describe("obesvarade bostadsfragor och ingenting klassificerat: sidan som vanligt", () => {
  it("en ny bostad utan kvitton ger en tom sammanstallning, ingen spärr", () => {
    const ex = byggK6aExport(bygg(null, {}, null));
    expect(ex.sida1.rader).toEqual([]);
    expect(ex.sida2.rader).toEqual([]);
  });

  it("en grupperad men oklassificerad hog listas som aterstaende, ingen spärr", () => {
    const hog = projekt({ id: "p1", namn: "Badrum", atgardstyp: null });
    const ex = byggK6aExport(bygg(null, { projekt: [hog], kostnader: [KVITTON[0]] }, null));
    expect(ex.oklassificerade_hogar.map((h) => h.namn)).toEqual(["Badrum"]);
  });
});

describe("besvarade bostadsfragor: troskeln beror pa svaret", () => {
  it("nybyggd vid forvarvet: reparationen raknas inte, och 3 000 kr grundforbattring faller pa troskeln", () => {
    const ex = byggK6aExport(bygg(true, { projekt: [ALTAN, GOLV], kostnader: KVITTON }));
    expect(ex.ruta4_brutto).toBe(0);
  });

  it("inte nybyggd: reparationen lyfter aret over troskeln och grundforbattringen star kvar", () => {
    const ex = byggK6aExport(bygg(false, { projekt: [ALTAN, GOLV], kostnader: KVITTON }));
    expect(ex.ruta4_brutto).toBe(300_000);
    expect(ex.ruta5_brutto).toBe(240_000); // 3 000 kr × (5 − 1) / 5
  });
});
