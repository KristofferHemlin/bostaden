import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

function bygg(over: Partial<K6aIndata>): K6aIndata {
  return {
    bostad: {
      upplatelseform: "bostadsratt",
      tilltradesdatum: "2010-01-01",
      forsaljningsdatum: "2032-06-01",
      nybyggd_vid_forvarv: false,
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
      atgardstyp: "nybyggnad",
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

  it("reparation betald 2026 ingar inte i underlaget vid forsaljning 2032 (utanfor femarsfonstret)", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Slipa golv",
      skick_forvarv: 0,
      skick_forsaljning: 5,
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

  it("forslitning: avdragsgill del ar reparationsunderlaget gange skickfaktorn", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Nytt badrumsgolv",
      skick_forvarv: 1,
      skick_forsaljning: 5, // skickfaktor 4/5 = 0,8
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

  it("utbytt mot battre kvalitet ger bade en sida 1- och en sida 2-rad for samma atgard och ar", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: 300_000, // 3 000 kr
      namn: "Nytt kok",
      skick_forvarv: 1,
      skick_forsaljning: 4, // skickfaktor 3/5 = 0,6
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 600_000, // 6 000 kr, over troskeln
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const grundRad = ex.sida1.rader.find((r) => r.atgard === "Nytt kok");
    const repRad = ex.sida2.rader.find((r) => r.atgard === "Nytt kok");
    expect(grundRad?.belopp_brutto).toBe(300_000); // merkostnaden
    expect(repRad?.belopp_brutto).toBe(300_000); // resten
    expect(repRad?.avdragsgill_del_brutto).toBe(180_000); // 3 000 kr * 0,6
    expect(ex.ruta4_brutto).toBe(300_000);
    expect(ex.ruta5_brutto).toBe(180_000);
  });

  it("ett projekt vars kostnader spanner over ett arsskifte ger tva rader", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
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
      atgardstyp: "nybyggnad",
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

  it("en reparation vars skick inte forbattrats bidrar anda med hela sitt underlag till arets troskelsumma, och lyfter grundforbattringen over troskeln", () => {
    // Produktspec 4.2: troskeln provas FORE skickbedomningen. Skickfaktorn 0
    // gor reparationens EGET avdrag 0 kr, men den rakas anda med i
    // troskelsumman – till skillnad fran en reparation utanfor femarsfonstret.
    const grund = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Mala om",
      skick_forvarv: 3,
      skick_forsaljning: 3, // ingen forbattring -> skickfaktor 0
    });
    // 4 000 kr grund + 3 000 kr rep. Tillsammans over 5 000 kr-troskeln.
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
    expect(ex.sida1.rader.find((r) => r.atgard === "Nytt kok")?.belopp_brutto).toBe(
      400_000,
    );
    expect(ex.ruta4_brutto).toBe(400_000);
    const repRad = ex.sida2.rader.find((r) => r.atgard === "Mala om");
    expect(repRad?.belopp_brutto).toBe(300_000); // rakades med i troskelsumman
    expect(repRad?.avdragsgill_del_brutto).toBe(0); // men skickfaktorn ar 0
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("reparation utanfor femarsfonstret kan inte lyfta arets grundforbattring over troskeln", () => {
    // Motsatsen till testet ovan: tidsgransen raknas bort FORE troskeln, sa en
    // reparation utanfor fonstret bidrar med 0 kr till troskelsumman.
    const grund = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Slipa golv",
      skick_forvarv: 0,
      skick_forsaljning: 5,
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
    // 400 000 kr grund + 0 kr rep (tidsgransad bort fore troskeln) = 400 000 kr,
    // understiger 500 000 kr-troskeln -> bada faller bort.
    expect(ex.sida1.rader.find((r) => r.atgard === "Nytt kok")?.belopp_brutto).toBe(
      0,
    );
    expect(ex.ruta4_brutto).toBe(0);
    const repRad = ex.sida2.rader.find((r) => r.atgard === "Slipa golv");
    expect(repRad?.belopp_brutto).toBe(0);
    expect(repRad?.avdragsgill_del_brutto).toBe(0);
    expect(ex.ruta5_brutto).toBe(0);
  });

  it("agarandel under 100 % ger variant gemensam_med_andel och individuella belopp efter andel", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
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
      atgardstyp: "nybyggnad",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Mala om",
      skick_forvarv: 0,
      skick_forsaljning: 5, // skickfaktor 1 -> hela beloppet avdragsgillt
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

  it("fastighet ger samma underlag som bostadsratt – ingen domanskillnad", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
      namn: "Nytt kok",
    });
    const rep = projekt({
      id: "p2",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Slipa golv",
      skick_forvarv: 0,
      skick_forsaljning: 5,
    });
    const k1 = kostnad({
      id: "k1",
      betaldatum: "2015-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const k2 = kostnad({
      id: "k2",
      betaldatum: "2030-04-01",
      totalbelopp: 550_000,
      projekt_id: "p2",
    });

    const br = byggK6aExport(
      bygg({
        bostad: {
          upplatelseform: "bostadsratt",
          tilltradesdatum: "2010-01-01",
          forsaljningsdatum: "2032-06-01",
          nybyggd_vid_forvarv: false,
        },
        projekt: [p, rep],
        kostnader: [k1, k2],
      }),
    );
    const fast = byggK6aExport(
      bygg({
        bostad: {
          upplatelseform: "fastighet",
          tilltradesdatum: "2010-01-01",
          forsaljningsdatum: "2032-06-01",
          nybyggd_vid_forvarv: false,
        },
        projekt: [p, rep],
        kostnader: [k1, k2],
      }),
    );

    expect(fast).toEqual(br);
    expect(fast.ruta4_brutto).toBe(800_000);
    expect(fast.ruta5_brutto).toBe(550_000);
  });
});

describe("K6A-exporten utan forsaljningsdatum", () => {
  const osald = {
    upplatelseform: "bostadsratt" as const,
    tilltradesdatum: "2010-01-01",
    forsaljningsdatum: null,
    nybyggd_vid_forvarv: false,
  };

  it("gar att bygga och markerar bostaden som osald", () => {
    const ex = byggK6aExport(bygg({ bostad: osald }));
    expect(ex.sald).toBe(false);
    expect(ex.genererad_for_datum).toBeNull();
  });

  it("sida 1 ar komplett – grundforbattring saknar tidsgrans", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
      namn: "Nytt kok",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2015-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ bostad: osald, projekt: [p], kostnader: [k] }),
    );
    expect(
      ex.sida1.rader.find((r) => r.atgard === "Nytt kok")?.belopp_brutto,
    ).toBe(800_000);
    expect(ex.ruta4_brutto).toBe(800_000);
  });

  it("sida 2 visar rader men ingen avdragsgill del och ruta 5 ar 0 – skickfaktorn kan inte raknas ut fore forsaljningen", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Slipa golv",
      skick_forvarv: 2,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2024-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ bostad: osald, projekt: [p], kostnader: [k] }),
    );
    const rad = ex.sida2.rader.find((r) => r.atgard === "Slipa golv");
    expect(rad?.belopp_brutto).toBe(800_000);
    expect(rad?.avdragsgill_del_brutto).toBeNull();
    expect(rad?.avdragsgill_del_individuellt).toBeNull();
    expect(ex.ruta5_brutto).toBe(0);
    expect(ex.ruta5_individuellt).toBe(0);
  });

  it("femarsfonstret provas inte utan forsaljningsdatum", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Mala om",
      skick_forvarv: 2,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2013-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ bostad: osald, projekt: [p], kostnader: [k] }),
    );
    expect(
      ex.sida2.rader.find((r) => r.atgard === "Mala om")?.belopp_brutto,
    ).toBe(800_000);
  });

  it("troskeln galler fortfarande sida 1 utan forsaljningsdatum", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
      namn: "Liten atgard",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2024-04-01",
      totalbelopp: 421_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ bostad: osald, projekt: [p], kostnader: [k] }),
    );
    expect(ex.ruta4_brutto).toBe(0);
  });

  it("oklassificerade hogar listas som vanligt utan forsaljningsdatum", () => {
    const p = projekt({ id: "p1", atgardstyp: null, namn: "Badrum" });
    const k = kostnad({
      id: "k1",
      betaldatum: "2024-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ bostad: osald, projekt: [p], kostnader: [k] }),
    );
    expect(ex.oklassificerade_hogar.map((h) => h.namn)).toContain("Badrum");
  });

  it("fastighet utan forsaljningsdatum bygger som bostadsratt", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "nybyggnad",
      namn: "Nytt kok",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2015-04-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({
        bostad: { ...osald, upplatelseform: "fastighet" },
        projekt: [p],
        kostnader: [k],
      }),
    );
    expect(ex.sald).toBe(false);
    expect(ex.ruta4_brutto).toBe(800_000);
  });
});
