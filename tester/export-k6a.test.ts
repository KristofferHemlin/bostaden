import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
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

describe("K6A-exporten", () => {
  it("grundforbattring betald 2015 ingar i underlaget vid forsaljning 2032", () => {
    const p = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Nytt kok",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2015-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida1.rader.find((r) => r.atgard === "Nytt kok");
    expect(rad?.ar).toBe(2015);
    expect(rad?.belopp_brutto).toBe(800_000);
    expect(ex.ruta4_brutto).toBe(800_000);
  });

  it("reparation betald 2026 ingar inte i underlaget vid forsaljning 2032", () => {
    const p = projekt({
      id: "p1",
      kategori: "reparation",
      namn: "Slipa golv",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: true,
      kvarvarande_andel: 1,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2026-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.ar === 2026);
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.avdragsgill_del_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("projekt med kategori reparation och slitet_vid_tilltrade = false ger 0 kr avdragsgillt", () => {
    const p = projekt({
      id: "p1",
      kategori: "reparation",
      namn: "Laga trasig ruta",
      slitet_vid_tilltrade: false,
      battre_skick_vid_forsaljning: true,
      kvarvarande_andel: 1,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.ar === 2030);
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.avdragsgill_del_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("projekt med battre_skick_vid_forsaljning = false ger 0 kr i exporten", () => {
    const p = projekt({
      id: "p1",
      kategori: "reparation",
      namn: "Frascha parkett",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: false,
      kvarvarande_andel: 1,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.ar === 2030);
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.avdragsgill_del_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("forslitning: avdragsgill del ar hela utgiften gange kvarvarande andel", () => {
    const p = projekt({
      id: "p1",
      kategori: "reparation",
      namn: "Nytt badrumsgolv",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: true,
      kvarvarande_andel: 0.8,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 1_000_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.ar === 2030);
    expect(rad?.belopp_brutto).toBe(1_000_000);
    expect(rad?.avdragsgill_del_brutto).toBe(800_000);
    expect(ex.ruta5_brutto).toBe(800_000);
  });

  it("ett projekt vars kostnader spanner over ett arsskifte ger tva rader", () => {
    const p = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Bygga altan",
    });
    const k1 = kostnad({
      id: "k1",
      betaldatum: "2029-12-20",
      totalbelopp: 600_000,
      projekt_id: "p1",
    });
    const k2 = kostnad({
      id: "k2",
      betaldatum: "2030-01-08",
      totalbelopp: 700_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k1, k2] }));
    const ar = ex.sida1.rader
      .filter((r) => r.atgard === "Bygga altan")
      .map((r) => r.ar)
      .sort();
    expect(ar).toEqual([2029, 2030]);
  });

  it("nar aret inte nar troskeln faller hela arets rader bort i exporten", () => {
    const p = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Liten atgard",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 421_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    expect(ex.sida1.rader.find((r) => r.ar === 2030)?.belopp_brutto).toBe(0);
    expect(ex.ruta4_brutto).toBe(0);
  });

  it("reparation med battre_skick_vid_forsaljning = false kan inte lyfta arets grundforbattring over troskeln", () => {
    const grund = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      kategori: "reparation",
      namn: "Mala om",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: false,
      kvarvarande_andel: 1,
    });
    // 4 000 kr grund + 3 000 kr rep. Tillsammans over 5 000 kr, men rep raknas inte.
    const kg = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 400_000,
      projekt_id: "p1",
    });
    const kr = kostnad({
      id: "k2",
      betaldatum: "2030-05-01",
      totalbelopp: 300_000,
      projekt_id: "p2",
    });
    const ex = byggK6aExport(bygg({ projekt: [grund, rep], kostnader: [kg, kr] }));
    expect(ex.sida1.rader.find((r) => r.atgard === "Nytt kok")?.belopp_brutto).toBe(0);
    expect(ex.ruta4_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("reparation utanfor femarsfonstret lyfter arets grundforbattring over troskeln men dras inte av sjalv", () => {
    const grund = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      kategori: "reparation",
      namn: "Slipa golv",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: true,
      kvarvarande_andel: 1,
    });
    // Utgiftsar 2026, forsaljning 2032 -> reparationen ligger utanfor fonstret (2027-2032).
    const kg = kostnad({
      id: "k1",
      betaldatum: "2026-04-01",
      totalbelopp: 400_000,
      projekt_id: "p1",
    });
    const kr = kostnad({
      id: "k2",
      betaldatum: "2026-05-01",
      totalbelopp: 300_000,
      projekt_id: "p2",
    });
    const ex = byggK6aExport(bygg({ projekt: [grund, rep], kostnader: [kg, kr] }));
    // Grundforbattringen blir avdragsgill: 400 000 + 300 000 >= 500 000.
    expect(ex.sida1.rader.find((r) => r.atgard === "Nytt kok")?.belopp_brutto).toBe(
      400_000,
    );
    expect(ex.ruta4_brutto).toBe(400_000);
    // Reparationen sjalv dras inte av – utanfor fonstret.
    const repRad = ex.sida2.rader.find((r) => r.atgard === "Slipa golv");
    expect(repRad?.belopp_brutto).toBe(0);
    expect(repRad?.avdragsgill_del_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("agarandel under 100 % ger variant gemensam_med_andel och individuella belopp efter andel", () => {
    const p = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Nytt kok",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ projekt: [p], kostnader: [k], medlemskap: { agarandel: 50 } }),
    );
    expect(ex.delagarvariant).toBe("gemensam_med_andel");
    expect(ex.ruta4_brutto).toBe(800_000);
    expect(ex.ruta4_individuellt).toBe(400_000);
  });

  it("summorna pekas ut som ruta 4 (grundforbattring) och ruta 5 (reparation)", () => {
    const grund = projekt({
      id: "p1",
      kategori: "grundforbattring",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      kategori: "reparation",
      namn: "Mala om",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: true,
      kvarvarande_andel: 1,
    });
    const k1 = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 600_000,
      projekt_id: "p1",
    });
    const k2 = kostnad({
      id: "k2",
      betaldatum: "2030-05-01",
      totalbelopp: 550_000,
      projekt_id: "p2",
    });
    const ex = byggK6aExport(
      bygg({ projekt: [grund, rep], kostnader: [k1, k2] }),
    );
    expect(ex.ruta4_brutto).toBe(600_000);
    expect(ex.ruta5_brutto).toBe(550_000);
  });

  it("export ar avstangd i insamlingslage (fastighet)", () => {
    expect(() =>
      byggK6aExport(
        bygg({
          bostad: {
            upplatelseform: "fastighet",
            tilltradesdatum: "2010-01-01",
            forsaljningsdatum: "2032-06-01",
          },
        }),
      ),
    ).toThrow(/insamlingslage/);
  });

  it("export kan inte genereras innan bostaden ar markerad som sald", () => {
    expect(() =>
      byggK6aExport(
        bygg({
          bostad: {
            upplatelseform: "bostadsratt",
            tilltradesdatum: "2010-01-01",
            forsaljningsdatum: null,
          },
        }),
      ),
    ).toThrow(/sald/);
  });
});
