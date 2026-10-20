import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import { AVRUNDAT_TILL_HELA_KRONOR, rutorForLasaren } from "@/doman/blankett";
import { andelForUnderlag } from "@/lib/samagande";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// CLAUDE.md, "Agarandel", och docs/design.md, "Samagande – medlemskapet":
// etiketten "Förs till K5, ruta x" far bara sta bredvid ett tal som ar
// lasarens eget. Uppmatt i produktionen 2026-10-19: tva delagare pa 50/50 sag
// bada hela bostadens 205 973,42 kr bredvid "Förs till K5, ruta 4" – tillsammans
// ett dubbelt yrkande.
//
// Kedjan ar densamma som exportvyns (src/app/export/page.tsx): andelen ur
// medlemmarnas andelar, underlaget med den andelen, och sist vad rutorna visar.
// Talen ar ett verkligt underlag ur produktionen.
//
// Blanketten tar hela kronor (CLAUDE.md, "Blanketten tar hela kronor"): talet
// bredvid "Förs till" avrundas uppat, sist av allt och efter agarandelen.
// Raderna behaller sina oren – de ar dokumentation och ska stamma exakt.

const GRUND = 20_597_342; // 205 973,42 kr
const REPARATION = 23_300_000; // 233 000 kr

function underlag({
  egenAndel,
  medlemsandelar,
}: {
  egenAndel: number;
  medlemsandelar: number[];
}) {
  const andel = andelForUnderlag({ egenAndel, medlemsandelar });
  const indata: K6aIndata = {
    bostad: {
      upplatelseform: "fastighet",
      tilltradesdatum: "2010-01-01",
      forsaljningsdatum: "2032-06-01",
      nybyggd_vid_forvarv: false,
    },
    medlemskap: { agarandel: andel ?? 100 },
    projekt: [
      projekt({ id: "p1", atgardstyp: "nybyggnad", namn: "Altan" }),
      projekt({
        id: "p2",
        atgardstyp: "utbytt",
        battre_kvalitet: false,
        namn: "Fasad",
        skick_forvarv: 0,
        skick_forsaljning: 5, // skickfaktor 1
      }),
    ],
    kostnader: [
      kostnad({ id: "k1", betaldatum: "2030-04-01", totalbelopp: GRUND, projekt_id: "p1" }),
      kostnad({ id: "k2", betaldatum: "2030-05-01", totalbelopp: REPARATION, projekt_id: "p2" }),
    ],
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
  };
  const ex = byggK6aExport(indata);
  return { ...rutorForLasaren(ex, "fastighet", andel), ex };
}

describe("Förs till-raden visar lasarens eget tal", () => {
  it("tva medlemmar pa 50/50: halva bostaden, aldrig hela", () => {
    const r = underlag({ egenAndel: 50, medlemsandelar: [50, 50] });
    // 102 986,71 -> 102 987; 116 500 ar redan hela kronor och ror sig inte.
    expect(r.ruta4).toEqual({ etikett: "Förs till K5, ruta 4", belopp: 10_298_700, avrundat: true });
    expect(r.ruta5).toEqual({ etikett: "Förs till K5, ruta 5", belopp: 11_650_000, avrundat: false });
  });

  it("en medlem med andel 50 %: samma tal som tidigare – rattningen tar inte bort andelen", () => {
    const r = underlag({ egenAndel: 50, medlemsandelar: [50] });
    expect(r.ruta4).toEqual({ etikett: "Förs till K5, ruta 4", belopp: 10_298_700, avrundat: true });
    expect(r.ruta5).toEqual({ etikett: "Förs till K5, ruta 5", belopp: 11_650_000, avrundat: false });
  });

  it("en ensam agare av hela bostaden: hela bostadens tal ar hennes eget", () => {
    const r = underlag({ egenAndel: 100, medlemsandelar: [100] });
    // 205 973,42 -> 205 974.
    expect(r.ruta4).toEqual({ etikett: "Förs till K5, ruta 4", belopp: 20_597_400, avrundat: true });
    expect(r.ruta5).toEqual({ etikett: "Förs till K5, ruta 5", belopp: REPARATION, avrundat: false });
  });

  it("summa under 100 %: var och en ser sin egen andel", () => {
    const r = underlag({ egenAndel: 25, medlemsandelar: [25, 25] });
    expect(r.ruta4.etikett).toBe("Förs till K5, ruta 4");
    // 205 973,42 × 0,25 = 51 493,355 → 51 493,36 i raderna → 51 494 att fora in.
    expect(r.ruta4.belopp).toBe(5_149_400);
  });

  it("summa over 100 %: hela bostadens belopp, men utan etiketten", () => {
    const r = underlag({ egenAndel: 100, medlemsandelar: [100, 100] });
    // Inget tal att skriva av – da finns inget skal att avrunda det.
    expect(r.ruta4).toEqual({ etikett: null, belopp: GRUND, avrundat: false });
    expect(r.ruta5).toEqual({ etikett: null, belopp: REPARATION, avrundat: false });
  });
});

describe("raderna behaller sina oren, bara Förs till-talet avrundas", () => {
  it("hela bostaden och andelen per rad ar exakta", () => {
    const { ex, ruta4 } = underlag({ egenAndel: 50, medlemsandelar: [50, 50] });
    const [rad] = ex.sida1.rader;
    expect(rad.belopp_brutto).toBe(GRUND); // 205 973,42
    expect(rad.belopp_individuellt).toBe(10_298_671); // 102 986,71
    expect(ex.ruta4_brutto).toBe(GRUND);
    expect(ex.ruta4_individuellt).toBe(10_298_671);
    expect(ruta4.belopp).toBe(10_298_700); // bara har
  });

  it("meningen forklarar varfor talet skiljer sig fran raderna", () => {
    expect(AVRUNDAT_TILL_HELA_KRONOR).toMatch(/hela kronor/);
  });
});
