import { describe, expect, it } from "vitest";
import {
  inlagtArsbelopp,
  kostnadensAr,
  rotForBelopp,
  samlatBelopp,
} from "@/doman/berakningar";
import type { Kostnad } from "@/doman/typer";
import { bilagepaketAvdragsforklaring } from "@/lib/bilagepaket/text";
import { formateraKronor } from "@/lib/format";
import { grupperaPerAr, kvittoradText, rotAvgarRad } from "@/lib/kvittolista";
import { kostnad } from "./_hjalp";

// docs/design.md, Listrader: "Men varje summa raknar efter ROT", "Darav foljer
// att en rad med ROT maste visa sitt avdrag" och "Arsrubriken och Inlagt {ar}
// maste rakna samma sak" – privat del raknas aldrig, aret ar betaldatumets, och
// ROT (liksom forsakringsersattning) avgar.

/** En kvittopost som kvittolistan bygger den; datum = betaldatum, annars
 *  dokumentdatum som reserv (for sorteringen, aldrig for aret). */
function post(k: Kostnad, dokumentdatum = "2026-01-15") {
  return { kostnad: k, datum: k.betaldatum ?? dokumentdatum };
}

function grupp(poster: ReturnType<typeof post>[], ar: number | null) {
  return grupperaPerAr(poster).find((g) => g.ar === ar);
}

// De tva kvittona som avvikelsen mattes pa 2026-10-01.
const BYGGMAX = kostnad({ id: "byggmax", betaldatum: "2026-09-12", totalbelopp: 100_000_000, projekt_id: null });
const NORDSTROM = kostnad({
  id: "nordstrom",
  betaldatum: "2026-09-08",
  totalbelopp: 6_081_250,
  rot_utnyttjat: 1_158_750,
});

// Ett kvitto med bade privat del och ROT: 10 000 kr, 3 000 kr ROT, 1 000 kr
// privat. Den privata delen raknas bort forst, ROT darefter (CLAUDE.md,
// "Avrakning, fordelning och andel"): 10 000 - 1 000 - 3 000 = 6 000 kr.
const PRIVAT_OCH_ROT = kostnad({
  id: "privat-rot",
  betaldatum: "2026-04-01",
  totalbelopp: 1_000_000,
  rot_utnyttjat: 300_000,
  rader: [
    { artikel: "arbete", belopp: 900_000, fordelningar: [] },
    {
      artikel: "privat",
      belopp: 100_000,
      fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
    },
  ],
});

// Obetald faktura, dokumentdaterad 2026. Hor inte till nagot ar.
const UTAN_BETALDATUM = kostnad({ id: "obetald", betaldatum: null, totalbelopp: 250_000 });

describe("kvittolistans arsrubrik raknar samma sak som Inlagt {ar}", () => {
  it("summerar efter ROT – 1 049 225 kr, inte 1 060 812,50", () => {
    expect(grupp([post(BYGGMAX), post(NORDSTROM)], 2026)?.summa).toBe(104_922_500);
  });

  it("raknar inte den privata delen, och ROT avgar – 6 000 kr", () => {
    const g = grupp([post(PRIVAT_OCH_ROT)], 2026);
    expect(g?.summa).toBe(600_000);
    expect(g?.summa).toBe(inlagtArsbelopp({ kostnader: [PRIVAT_OCH_ROT] }, 2026));
  });

  it("en kostnad utan betaldatum hamnar under Utan betaldatum och i ingen arssumma", () => {
    const poster = [post(NORDSTROM), post(UTAN_BETALDATUM, "2026-08-01")];
    expect(kostnadensAr(UTAN_BETALDATUM)).toBeNull();
    expect(grupp(poster, null)?.poster.map((p) => p.kostnad.id)).toEqual(["obetald"]);
    expect(grupp(poster, 2026)?.poster.map((p) => p.kostnad.id)).toEqual(["nordstrom"]);
    expect(grupp(poster, 2026)?.summa).toBe(4_922_500);
    expect(inlagtArsbelopp({ kostnader: [NORDSTROM, UTAN_BETALDATUM] }, 2026)).toBe(4_922_500);
  });

  it("livstidssumman raknar kostnaden utan betaldatum anda", () => {
    expect(samlatBelopp({ kostnader: [NORDSTROM, UTAN_BETALDATUM] })).toBe(5_172_500);
  });

  it("varje arsgrupp ar lika med Inlagt {ar} for samma kvitton", () => {
    const kostnader = [
      BYGGMAX,
      NORDSTROM,
      PRIVAT_OCH_ROT,
      UTAN_BETALDATUM,
      kostnad({ id: "2025", betaldatum: "2025-12-30", totalbelopp: 420_000, rot_utnyttjat: 120_000 }),
      kostnad({ id: "arkiverad", betaldatum: "2026-02-02", arkiverad: true }),
      { ...kostnad({ id: "utkast", betaldatum: "2026-03-03" }), totalbelopp: null },
    ];
    const grupper = grupperaPerAr(kostnader.map((k) => post(k)));
    expect(grupper.map((g) => g.ar)).toEqual([null, 2026, 2025]);
    for (const g of grupper) {
      if (g.ar === null) continue;
      expect(g.summa).toBe(inlagtArsbelopp({ kostnader }, g.ar));
    }
  });

  it("arsrubriken gar att rakna ihop av raderna: totalbelopp minus visad ROT", () => {
    const poster = [post(BYGGMAX), post(NORDSTROM)];
    const ihopraknat = poster.reduce(
      (s, p) =>
        s + (p.kostnad.totalbelopp ?? 0) - rotForBelopp(p.kostnad, p.kostnad.totalbelopp ?? 0),
      0,
    );
    expect(grupp(poster, 2026)?.summa).toBe(ihopraknat);
  });
});

describe("rotForBelopp", () => {
  it("ar kostnadens ROT rakt av for hela totalbeloppet", () => {
    expect(rotForBelopp(NORDSTROM, 6_081_250)).toBe(1_158_750);
  });

  it("ar proportionell for en del av kostnaden, som bidraget", () => {
    // 10 000 kr med 3 000 kr ROT, 60 % till projektet: 6 000 - 1 800 = 4 200.
    const k = kostnad({ totalbelopp: 1_000_000, rot_utnyttjat: 300_000 });
    expect(rotForBelopp(k, 600_000)).toBe(180_000);
  });

  it("ar 0 utan ROT", () => {
    expect(rotForBelopp(BYGGMAX, 100_000_000)).toBe(0);
  });
});

describe("rotAvgarRad", () => {
  it("visar avdraget pa en rad med ROT", () => {
    expect(rotAvgarRad(1_158_750)).toBe(
      `varav ROT ${formateraKronor(1_158_750)}, avgår`,
    );
    expect(formateraKronor(1_158_750).replace(/\s/g, " ")).toBe("11 587,50 kr");
  });

  it("ger ingen extra rad utan ROT", () => {
    expect(rotAvgarRad(null)).toBeUndefined();
    expect(rotAvgarRad(0)).toBeUndefined();
  });

  it("har samma lydelse som PDF-paketets rad", () => {
    expect([rotAvgarRad(750_000)]).toEqual(
      bilagepaketAvdragsforklaring({ rotUtnyttjat: 750_000, forsakringsersattning: 0 }),
    );
  });
});

describe("kvittoradText – samma rad i kvittolistan och genomgangen", () => {
  // Fynd 2026-10-02: genomgangen visade BYGGMAX SOLNA som huvudtext och
  // "BYGGMAX SOLNA · 2026-09-12" under. Utan anteckning ar leverantoren
  // huvudtext och den dampade raden bara datumet.
  it("utan anteckning: leverantoren en gang, datumet under", () => {
    expect(
      kvittoradText({ anteckning: null, leverantor: "BYGGMAX SOLNA", datum: "2026-09-12" }),
    ).toEqual({ namn: "BYGGMAX SOLNA", underrad: "2026-09-12" });
  });

  it("med anteckning: anteckningen som huvudtext, leverantor och datum under", () => {
    expect(
      kvittoradText({ anteckning: "Målade sovrummet", leverantor: "BAUHAUS", datum: "2026-03-01" }),
    ).toEqual({ namn: "Målade sovrummet", underrad: "BAUHAUS · 2026-03-01" });
  });

  it("utan nagot: inget namn, anroparen valjer", () => {
    expect(kvittoradText({ anteckning: "  ", leverantor: null, datum: null })).toEqual({
      namn: null,
      underrad: "",
    });
  });
});
