import { describe, expect, it } from "vitest";
import { dateratForeTilltradet } from "@/doman/atgardsberakning";
import { samlatBelopp } from "@/doman/berakningar";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import type { Bostad } from "@/doman/typer";
import { kvittodatumNotis } from "@/lib/kvittodatum-notis";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// CLAUDE.md, steg 3: båda delarna = 0 om kvittots datum ligger före
// bostadens tillträdesdatum. Gränsen prövar kvittots datum, inte betaldatumet,
// och den ligger FÖRE tröskeln – ett belopp som aldrig var avdragsgillt får
// inte lyfta året över 5 000 kr. Kvittot redovisas i Återstår.
//
// Uppmätt 2026-10-18: ett kvitto på 45 250 kr daterat 2019-05-08 mot ett
// tillträde 2022-02-02 hamnade i sin helhet på sida 1.

const TILLTRADE = "2022-02-02";

function bostad(over: Partial<Bostad> = {}): Bostad {
  return {
    upplatelseform: "fastighet",
    tilltradesdatum: TILLTRADE,
    forsaljningsdatum: null,
    nybyggd_vid_forvarv: false,
    ...over,
  };
}

function bygg(over: Partial<K6aIndata>): K6aIndata {
  return {
    bostad: bostad(),
    medlemskap: { agarandel: 100 },
    projekt: [],
    kostnader: [],
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
    ...over,
  };
}

describe("tillträdesgränsen – det uppmätta kvittot", () => {
  const golv = kostnad({
    id: "golv",
    totalbelopp: 4_525_000,
    betaldatum: "2019-05-08",
    dokumentdatum: "2019-05-08",
    projekt_id: "p1",
  });

  it("2019-05-08 mot tillträde 2022-02-02 ger 0 kr på sida 1, inte 45 250", () => {
    const ex = byggK6aExport(
      bygg({ projekt: [projekt({ atgardstyp: "nybyggnad" })], kostnader: [golv] }),
    );
    expect(ex.ruta4_brutto).toBe(0);
    expect(ex.sida1.rader).toEqual([]);
  });

  it("och redovisas i Återstår med hela beloppet och sitt skäl", () => {
    const ex = byggK6aExport(
      bygg({ projekt: [projekt({ atgardstyp: "nybyggnad" })], kostnader: [golv] }),
    );
    expect(ex.aterstaende_kvitton).toEqual([
      {
        kostnad_id: "golv",
        ar: 2019,
        belopp_brutto: 4_525_000,
        orsak: "fore_tilltradet",
      },
    ]);
  });

  it("träffar också reparationsdelen – varken grundförbättring eller reparation var hennes", () => {
    const ex = byggK6aExport(
      bygg({
        bostad: bostad({ forsaljningsdatum: "2023-06-01" }),
        projekt: [
          projekt({
            atgardstyp: "utbytt",
            battre_kvalitet: true,
            merkostnad: 1_000_000,
            skick_forvarv: 0,
            skick_forsaljning: 5,
          }),
        ],
        kostnader: [golv],
      }),
    );
    expect(ex.ruta4_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("utan projektkoppling står det ändå som före tillträdet, inte som okopplat", () => {
    const okopplat = kostnad({ ...golv, projekt_id: null });
    const ex = byggK6aExport(bygg({ kostnader: [okopplat] }));
    expect(ex.aterstaende_kvitton.map((k) => k.orsak)).toEqual([
      "fore_tilltradet",
    ]);
  });

  it("varje krona är redovisad: sidorna plus Återstår är Totalt inlagt", () => {
    const efter = kostnad({
      id: "efter",
      totalbelopp: 800_000,
      betaldatum: "2023-03-01",
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({
        projekt: [projekt({ atgardstyp: "nybyggnad" })],
        kostnader: [golv, efter],
      }),
    );
    const aterstar = ex.aterstaende_kvitton.reduce(
      (s, k) => s + (k.belopp_brutto ?? 0),
      0,
    );
    expect(ex.ruta4_brutto + aterstar).toBe(
      samlatBelopp({ kostnader: [golv, efter] }),
    );
  });
});

describe("tillträdesgränsen prövar kvittots datum, inte betaldatumet", () => {
  it("daterat före tillträdet men betalt efter: räknas inte", () => {
    const k = kostnad({
      totalbelopp: 800_000,
      dokumentdatum: "2022-01-15",
      betaldatum: "2022-03-01",
    });
    const ex = byggK6aExport(
      bygg({ projekt: [projekt({ atgardstyp: "nybyggnad" })], kostnader: [k] }),
    );
    expect(ex.ruta4_brutto).toBe(0);
    expect(ex.aterstaende_kvitton[0]).toMatchObject({
      orsak: "fore_tilltradet",
      ar: 2022,
    });
  });

  it("daterat på tillträdesdagen: räknas", () => {
    const k = kostnad({
      totalbelopp: 800_000,
      dokumentdatum: TILLTRADE,
      betaldatum: TILLTRADE,
    });
    const ex = byggK6aExport(
      bygg({ projekt: [projekt({ atgardstyp: "nybyggnad" })], kostnader: [k] }),
    );
    expect(ex.ruta4_brutto).toBe(800_000);
  });

  it("utan kvittodatum (äldre kostnad) går gränsen inte att pröva och kostnaden räknas som förut", () => {
    const k = kostnad({
      totalbelopp: 800_000,
      dokumentdatum: null,
      betaldatum: "2023-03-01",
    });
    const ex = byggK6aExport(
      bygg({ projekt: [projekt({ atgardstyp: "nybyggnad" })], kostnader: [k] }),
    );
    expect(ex.ruta4_brutto).toBe(800_000);
  });
});

describe("tillträdesgränsen ligger före tröskeln", () => {
  // Två kvitton samma kalenderår (betaldatum 2022), i två olika projekt. Det
  // ena är daterat före tillträdet. Räknades det med i tröskelprövningen
  // skulle året nå 7 000 kr och passera – men det var aldrig avdragsgillt,
  // och kvar finns 3 000 kr, under tröskeln.
  const fore = kostnad({
    id: "fore",
    totalbelopp: 400_000,
    dokumentdatum: "2022-01-15",
    betaldatum: "2022-03-01",
    projekt_id: "p1",
  });
  const efter = kostnad({
    id: "efter",
    totalbelopp: 300_000,
    dokumentdatum: "2022-03-10",
    betaldatum: "2022-03-10",
    projekt_id: "p2",
  });
  const tvaProjekt = [
    projekt({ id: "p1", namn: "Före", atgardstyp: "nybyggnad" }),
    projekt({ id: "p2", namn: "Efter", atgardstyp: "nybyggnad" }),
  ];

  it("ett kvitto före tillträdet lyfter inte året över 5 000 kr", () => {
    const ex = byggK6aExport(
      bygg({ projekt: tvaProjekt, kostnader: [fore, efter] }),
    );
    expect(ex.ruta4_brutto).toBe(0);
    const efterRad = ex.sida1.rader.find((r) => r.atgard === "Efter");
    expect(efterRad?.belopp_brutto).toBe(0);
  });

  it("ett år vars enda kostnad ligger före tillträdet passerar inte, hur stort beloppet än är", () => {
    const stort = kostnad({
      id: "stort",
      totalbelopp: 4_525_000,
      dokumentdatum: "2022-01-15",
      betaldatum: "2022-03-01",
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ projekt: [tvaProjekt[0]], kostnader: [stort] }),
    );
    expect(ex.ruta4_brutto).toBe(0);
    expect(ex.sida1.rader).toEqual([]);
  });
});

describe("notisen och beräkningen säger samma sak", () => {
  it("notisen tänds före tillträdet exakt när beräkningen räknar bort kvittot", () => {
    for (const datum of [
      "2019-05-08",
      "2022-02-01",
      "2022-02-02",
      "2022-02-03",
      "2026-01-01",
    ]) {
      const notis = kvittodatumNotis(datum, {
        tilltradesdatum: TILLTRADE,
        forsaljningsdatum: null,
      });
      expect(notis !== null).toBe(dateratForeTilltradet(datum, TILLTRADE));
    }
  });
});
