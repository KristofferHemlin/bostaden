// docs/design.md, Exportvyn: "En rad som ger 0 kr maste saga varfor" – fyra
// olika regler ger noll, och de betyder helt olika saker for anvandaren.
// Berakningen (src/doman/atgardsberakning.ts) vet redan vilken regel som slog
// till; det har testar att den forklaringen nar hela vagen fram till raden i
// K6A-exporten, med ratt text for varje orsak, och att en rad med ett belopp
// aldrig far nagon forklaring.

import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import type { Regelparameter } from "@/doman/typer";
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

describe("forklaringen till en 0-kr-rad i K6A-exporten", () => {
  it("aret nadde inte troskeln: sida 1-raden far Skatteverkets egen formulering", () => {
    const p = projekt({ id: "p1", atgardstyp: "nybyggnad", namn: "Liten atgard" });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 421_000, // 4 210 kr, under 5 000 kr-troskeln
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida1.rader.find((r) => r.atgard === "Liten atgard");
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.forklaring).toBe(
      "Kostnaden för det året som åtgärden utfördes behöver sammanlagt uppgå till minst 5\u00a0000\u00a0kronor.",
    );
  });

  it("reparationen ligger utanfor femarsfonstret", () => {
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
      betaldatum: "2026-04-01", // forsaljning 2032, fonster 2027-2032
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.atgard === "Slipa golv");
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.forklaring).toBe("Åtgärden utfördes mer än fem år före försäljningen.");
  });

  it("skicket forbattrades inte: reparationsunderlaget racker sjalvt over troskeln men skickfaktorn ar 0", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Mala om",
      skick_forvarv: 3,
      skick_forsaljning: 3, // ingen forbattring -> skickfaktor 0
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 600_000, // 6 000 kr, over troskeln pa egen hand
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.atgard === "Mala om");
    expect(rad?.belopp_brutto).toBe(600_000); // reparationsunderlaget i sig ar inte 0
    expect(rad?.avdragsgill_del_brutto).toBe(0);
    expect(rad?.forklaring).toBe(
      "Det du bytte ut var i samma eller sämre skick vid försäljningen än vid förvärvet.",
    );
  });

  it("bostaden var nybyggd vid forvarvet", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Nytt golv",
      skick_forvarv: 1,
      skick_forsaljning: 4,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 600_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({
        bostad: {
          upplatelseform: "bostadsratt",
          tilltradesdatum: "2010-01-01",
          forsaljningsdatum: "2032-06-01",
          nybyggd_vid_forvarv: true,
        },
        projekt: [p],
        kostnader: [k],
      }),
    );
    const rad = ex.sida2.rader.find((r) => r.atgard === "Nytt golv");
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.avdragsgill_del_brutto).toBe(0);
    expect(rad?.forklaring).toBe("Allt var nytt vid tillträdet, så reparationer räknas inte.");
  });

  it("en rad med ett belopp far ingen forklaring", () => {
    const grund = projekt({ id: "p1", atgardstyp: "nybyggnad", namn: "Nytt kok" });
    const rep = projekt({
      id: "p2",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Nytt badrumsgolv",
      skick_forvarv: 1,
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
      totalbelopp: 1_000_000,
      projekt_id: "p2",
    });
    const ex = byggK6aExport(bygg({ projekt: [grund, rep], kostnader: [k1, k2] }));

    const grundRad = ex.sida1.rader.find((r) => r.atgard === "Nytt kok");
    expect(grundRad?.belopp_brutto).toBe(800_000);
    expect(grundRad?.forklaring).toBeNull();

    const repRad = ex.sida2.rader.find((r) => r.atgard === "Nytt badrumsgolv");
    expect(repRad?.belopp_brutto).toBe(1_000_000);
    expect(repRad?.avdragsgill_del_brutto).toBe(800_000);
    expect(repRad?.forklaring).toBeNull();
  });

  it("saknad skickfraga ger en varning, inte en forklaring – de tva ar olika saker", () => {
    const p = projekt({
      id: "p1",
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      namn: "Mala om",
      skick_forvarv: null,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-04-01",
      totalbelopp: 600_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(bygg({ projekt: [p], kostnader: [k] }));
    const rad = ex.sida2.rader.find((r) => r.atgard === "Mala om");
    expect(rad?.avdragsgill_del_brutto).toBe(0);
    expect(rad?.forklaring).toBeNull();
    expect(rad?.varningar.length).toBeGreaterThan(0);
  });
});

// docs/design.md, Exportvyn: "Beloppet i den texten skrivs aldrig som en
// bokstavlig siffra i koden." Tröskeln och tidsfönstret är regelparametrar.
// Ändras värdet ska förklaringen följa med – och den ska nämna det värde som
// gällde det år raden gäller, precis som beräkningen gör.
describe("förklaringen följer regelparametern", () => {
  // Tröskeln höjs till 6 000 kr från 2030; 2029 och tidigare gäller 5 000 kr.
  const HOJD_TROSKEL: Regelparameter[] = [
    ...REGELPARAMETRAR.filter((p) => p.nyckel !== "troskelbelopp"),
    {
      nyckel: "troskelbelopp",
      varde: 500_000,
      enhet: "oren",
      giltig_fran: "1970-01-01",
      giltig_till: "2029-12-31",
    },
    {
      nyckel: "troskelbelopp",
      varde: 600_000,
      enhet: "oren",
      giltig_fran: "2030-01-01",
      giltig_till: null,
    },
  ];

  it("ett ändrat tröskelbelopp står i förklaringen, per radens år", () => {
    const p2029 = projekt({ id: "p1", atgardstyp: "nybyggnad", namn: "Altan 2029" });
    const p2030 = projekt({ id: "p2", atgardstyp: "nybyggnad", namn: "Altan 2030" });
    const kostnader = [
      kostnad({ id: "k1", betaldatum: "2029-05-01", totalbelopp: 421_000, projekt_id: "p1" }),
      // 5 500 kr: hade klarat den gamla tröskeln men inte den nya.
      kostnad({ id: "k2", betaldatum: "2030-05-01", totalbelopp: 550_000, projekt_id: "p2" }),
    ];
    const ex = byggK6aExport(
      bygg({ projekt: [p2029, p2030], kostnader, regelparametrar: HOJD_TROSKEL }),
    );
    const rad2029 = ex.sida1.rader.find((r) => r.atgard === "Altan 2029");
    const rad2030 = ex.sida1.rader.find((r) => r.atgard === "Altan 2030");
    expect(rad2029?.belopp_brutto).toBe(0);
    expect(rad2029?.forklaring).toContain("minst 5\u00a0000\u00a0kronor");
    expect(rad2030?.belopp_brutto).toBe(0);
    expect(rad2030?.forklaring).toContain("minst 6\u00a0000\u00a0kronor");
    expect(rad2030?.forklaring).not.toContain("5\u00a0000");
  });

  it("ett ändrat tidsfönster för reparationer står i förklaringen", () => {
    const SEXARSFONSTER: Regelparameter[] = REGELPARAMETRAR.map((p) =>
      p.nyckel === "reparationsfonster_ar" ? { ...p, varde: 6 } : p,
    );
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
      betaldatum: "2025-04-01", // försäljning 2032, sexårsfönster 2026–2032
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const ex = byggK6aExport(
      bygg({ projekt: [p], kostnader: [k], regelparametrar: SEXARSFONSTER }),
    );
    const rad = ex.sida2.rader.find((r) => r.atgard === "Slipa golv");
    expect(rad?.belopp_brutto).toBe(0);
    expect(rad?.forklaring).toBe("Åtgärden utfördes mer än sex år före försäljningen.");
  });
});
