import { describe, expect, it } from "vitest";
import { byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

describe("hog utan atgardstyp (grupperad men inte klassificerad)", () => {
  it("exporten utelamnar den inte tyst – den listas som 'behover klassificeras', och bidrar inte till nagon sida", () => {
    const hog = projekt({
      id: "p1",
      atgardstyp: null,
      namn: "Bauhaus i augusti",
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2026-05-01",
      totalbelopp: 800_000,
      projekt_id: "p1",
    });
    const indata: K6aIndata = {
      bostad: {
        upplatelseform: "bostadsratt",
        tilltradesdatum: "2010-01-01",
        forsaljningsdatum: "2032-06-01",
        nybyggd_vid_forvarv: false,
      },
      medlemskap: { agarandel: 100 },
      projekt: [hog],
      kostnader: [k],
      regelparametrar: REGELPARAMETRAR,
    };

    const ex = byggK6aExport(indata);

    // Inte pa nagon av de tva sidorna...
    expect(ex.sida1.rader).toHaveLength(0);
    expect(ex.sida2.rader).toHaveLength(0);
    // ...men synlig i sin egen lista, med belopp, sa att man ser vad som fattas.
    expect(ex.oklassificerade_hogar).toEqual([
      { namn: "Bauhaus i augusti", ar: 2026, belopp_brutto: 800_000 },
    ]);
    expect(ex.varningar.join(" ")).toContain("Bauhaus i augusti");
  });
});
