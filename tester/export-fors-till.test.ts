import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import { rutorForLasaren } from "@/doman/blankett";
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
  return rutorForLasaren(byggK6aExport(indata), "fastighet", andel);
}

describe("Förs till-raden visar lasarens eget tal", () => {
  it("tva medlemmar pa 50/50: halva bostaden, aldrig hela", () => {
    const r = underlag({ egenAndel: 50, medlemsandelar: [50, 50] });
    expect(r.ruta4).toEqual({ etikett: "Förs till K5, ruta 4", belopp: 10_298_671 });
    expect(r.ruta5).toEqual({ etikett: "Förs till K5, ruta 5", belopp: 11_650_000 });
  });

  it("en medlem med andel 50 %: samma tal som tidigare – rattningen tar inte bort andelen", () => {
    const r = underlag({ egenAndel: 50, medlemsandelar: [50] });
    expect(r.ruta4).toEqual({ etikett: "Förs till K5, ruta 4", belopp: 10_298_671 });
    expect(r.ruta5).toEqual({ etikett: "Förs till K5, ruta 5", belopp: 11_650_000 });
  });

  it("en ensam agare av hela bostaden: hela bostadens tal ar hennes eget", () => {
    const r = underlag({ egenAndel: 100, medlemsandelar: [100] });
    expect(r.ruta4).toEqual({ etikett: "Förs till K5, ruta 4", belopp: GRUND });
    expect(r.ruta5).toEqual({ etikett: "Förs till K5, ruta 5", belopp: REPARATION });
  });

  it("summa under 100 %: var och en ser sin egen andel", () => {
    const r = underlag({ egenAndel: 25, medlemsandelar: [25, 25] });
    expect(r.ruta4.etikett).toBe("Förs till K5, ruta 4");
    expect(r.ruta4.belopp).toBe(5_149_336); // 205 973,42 × 0,25 = 51 493,355 → 51 493,36
  });

  it("summa over 100 %: hela bostadens belopp, men utan etiketten", () => {
    const r = underlag({ egenAndel: 100, medlemsandelar: [100, 100] });
    expect(r.ruta4).toEqual({ etikett: null, belopp: GRUND });
    expect(r.ruta5).toEqual({ etikett: null, belopp: REPARATION });
  });
});
