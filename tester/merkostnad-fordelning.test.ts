import { describe, expect, it } from "vitest";
import {
  delaProjektetIKategorier,
  fordelaMerkostnad,
} from "@/doman/atgardsberakning";
import { beloppIKolumnen, byggK6aExport, type K6aIndata } from "@/doman/export-k6a";
import type { Kostnad, Projekt } from "@/doman/typer";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// CLAUDE.md, steg 2: merkostnaden ar ett tal for hela projektet och ska
// fordelas, inte upprepas. Proportionellt mot varje kostnads andel av
// projektets avdragsgrundande belopp, och delarna summerar till exakt
// merkostnaden.
//
// Uppmatt 2026-10-18: ett fonsterbyte med 30 000 kr i december 2022 och
// 20 000 kr i januari 2023, battre kvalitet, merkostnad 12 000 kr, gav
// 12 000 kr pa bada raderna pa sida 1 – 24 000 kr till ruta 4 i stallet for
// 12 000, och ruta 4 blev 214 000 kr dar den skulle vara 202 000 kr.

const VILLA: K6aIndata["bostad"] = {
  upplatelseform: "fastighet",
  tilltradesdatum: "2016-06-01",
  forsaljningsdatum: "2026-09-15",
  nybyggd_vid_forvarv: false,
};

function bygg(projektlista: Projekt[], kostnader: Kostnad[]) {
  return byggK6aExport({
    bostad: VILLA,
    medlemskap: { agarandel: 100 },
    projekt: projektlista,
    kostnader,
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
  });
}

const FONSTER = projekt({
  id: "fonster",
  namn: "Bytte fönster",
  atgardstyp: "utbytt",
  battre_kvalitet: true,
  merkostnad: 1_200_000,
  skick_forvarv: 1,
  skick_forsaljning: 4,
});
// Ovriga grundforbattringar pa kontot: 190 000 kr, sa att ruta 4 ska bli
// 190 000 + 12 000 = 202 000 kr.
const OVRIGT = projekt({ id: "ovrigt", namn: "Byggde ett uterum", atgardstyp: "nybyggnad" });

describe("fönsterbytet över ett årsskifte", () => {
  const ex = bygg(
    [FONSTER, OVRIGT],
    [
      kostnad({ id: "f2022", totalbelopp: 3_000_000, betaldatum: "2022-12-10", projekt_id: "fonster" }),
      kostnad({ id: "f2023", totalbelopp: 2_000_000, betaldatum: "2023-01-15", projekt_id: "fonster" }),
      kostnad({ id: "uterum", totalbelopp: 19_000_000, betaldatum: "2021-06-01", projekt_id: "ovrigt" }),
    ],
  );
  const sida1 = (ar: number) =>
    ex.sida1.rader.find((r) => r.atgard === "Bytte fönster" && r.ar === ar)!;
  const sida2 = (ar: number) =>
    ex.sida2.rader.find((r) => r.atgard === "Bytte fönster" && r.ar === ar)!;

  it("ruta 4 blir 202 000 kr, inte 214 000", () => {
    expect(ex.ruta4_brutto).toBe(20_200_000);
  });

  it("sida 1: 7 200 kr 2022 och 4 800 kr 2023 – 30/50 och 20/50 av 12 000", () => {
    expect(sida1(2022).avdragsgill_del_brutto).toBe(720_000);
    expect(sida1(2023).avdragsgill_del_brutto).toBe(480_000);
    expect(beloppIKolumnen(sida1(2022))).toBe(720_000);
    expect(beloppIKolumnen(sida1(2023))).toBe(480_000);
  });

  it("sida 2: 22 800 kr 2022 och 15 200 kr 2023", () => {
    expect(beloppIKolumnen(sida2(2022))).toBe(2_280_000);
    expect(beloppIKolumnen(sida2(2023))).toBe(1_520_000);
  });

  it("radernas grundförbättringar summerar till exakt merkostnaden", () => {
    expect(
      ex.sida1.rader
        .filter((r) => r.atgard === "Bytte fönster")
        .reduce((s, r) => s + (r.avdragsgill_del_brutto ?? 0), 0),
    ).toBe(FONSTER.merkostnad);
  });

  it("ingen krona försvinner: grundförbättring + reparationsunderlag är hela kostnaden", () => {
    expect(
      beloppIKolumnen(sida1(2022)) + beloppIKolumnen(sida2(2022)),
    ).toBe(3_000_000);
    expect(
      beloppIKolumnen(sida1(2023)) + beloppIKolumnen(sida2(2023)),
    ).toBe(2_000_000);
  });
});

describe("två kvitton samma år", () => {
  // De blir en rad, och merkostnaden raknas en gang – sa var det redan fore
  // rattningen, och sa ska det forbli.
  const ex = bygg(
    [FONSTER],
    [
      kostnad({ id: "a", totalbelopp: 3_000_000, betaldatum: "2023-03-01", projekt_id: "fonster" }),
      kostnad({ id: "b", totalbelopp: 2_000_000, betaldatum: "2023-09-01", projekt_id: "fonster" }),
    ],
  );

  it("en rad på varje sida, merkostnaden en gång", () => {
    expect(ex.sida1.rader).toHaveLength(1);
    expect(ex.sida2.rader).toHaveLength(1);
    expect(ex.sida1.rader[0].avdragsgill_del_brutto).toBe(1_200_000);
    expect(beloppIKolumnen(ex.sida2.rader[0])).toBe(3_800_000);
    expect(ex.ruta4_brutto).toBe(1_200_000);
  });
});

describe("en merkostnad som inte går jämnt upp", () => {
  it("tre lika stora kostnader och 10 000,01 kr: delarna summerar till exakt merkostnaden", () => {
    const delar = fordelaMerkostnad(1_000_001, [
      { id: "a", bas: 1_000_000 },
      { id: "b", bas: 1_000_000 },
      { id: "c", bas: 1_000_000 },
    ]);
    expect([...delar.values()].reduce((s, d) => s + d, 0)).toBe(1_000_001);
    // Resten pa den storsta – vid lika storlek den forsta.
    expect([...delar.values()]).toEqual([333_335, 333_333, 333_333]);
  });

  it("tre olika stora kostnader: resten hamnar på den största", () => {
    const delar = fordelaMerkostnad(1_000_000, [
      { id: "liten", bas: 100_003 },
      { id: "stor", bas: 700_001 },
      { id: "mellan", bas: 200_007 },
    ]);
    expect([...delar.values()].reduce((s, d) => s + d, 0)).toBe(1_000_000);
    const utanRest = Math.floor((1_000_000 * 700_001) / 1_000_011);
    expect(delar.get("stor")).toBeGreaterThan(utanRest);
  });

  it("genom hela exporten: tre år, 10 000 kr som inte delas jämnt med tre, summan till ruta 4 är exakt", () => {
    const p = projekt({
      id: "tak",
      namn: "Bytte taket",
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: 1_000_000,
      skick_forvarv: 2,
      skick_forsaljning: 4,
    });
    const ex = bygg(
      [p],
      ["2022", "2023", "2024"].map((ar) =>
        kostnad({ id: `t${ar}`, totalbelopp: 1_000_000, betaldatum: `${ar}-05-01`, projekt_id: "tak" }),
      ),
    );
    expect(ex.sida1.rader).toHaveLength(3);
    expect(ex.ruta4_brutto).toBe(1_000_000);
  });

  it("varje del reduceras med sin egen kostnads reduktionsfaktor", () => {
    const u = delaProjektetIKategorier(
      { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 1_200_000 },
      [
        { id: "medRot", bas: 3_000_000, avdragsgrundande: 2_400_000, reduktionsfaktor: 0.8 },
        { id: "utanRot", bas: 2_000_000, avdragsgrundande: 2_000_000, reduktionsfaktor: 1 },
      ],
    );
    expect(u.get("medRot")!.grundforbattringsdel).toBe(720_000 * 0.8);
    expect(u.get("utanRot")!.grundforbattringsdel).toBe(480_000);
  });
});

// CLAUDE.md, steg 2: basen ar brutto, eftersom reduktionsfaktorn redan bar
// reduktionen. Fordelas merkostnaden pa det avdragsgrundande beloppet och
// multipliceras sedan med faktorn dras ROT av tva ganger. Det enda fall som
// skiljer de tva baserna at ar ett projekt med blandad ROT – och det fall
// som inget test fangade 2026-10-18.
describe("blandad ROT inom ett år: basen är brutto", () => {
  // 30 000 kr med 6 000 kr ROT (faktor 0,8) och 20 000 kr utan, samma ar,
  // merkostnad 12 000 kr:
  //   brutto som bas:           12 000 × 30/50 × 0,8 + 12 000 × 20/50 × 1,0 = 10 560,00
  //   avdragsgrundande som bas: 12 000 × 24/44 × 0,8 + 12 000 × 20/44 × 1,0 = 10 690,91
  const ex = bygg(
    [FONSTER],
    [
      kostnad({ id: "medRot", totalbelopp: 3_000_000, rot_utnyttjat: 600_000, betaldatum: "2023-03-01", projekt_id: "fonster" }),
      kostnad({ id: "utanRot", totalbelopp: 2_000_000, betaldatum: "2023-09-01", projekt_id: "fonster" }),
    ],
  );

  it("grundförbättringen blir 10 560 kr, inte 10 690,91", () => {
    expect(ex.sida1.rader).toHaveLength(1);
    expect(ex.sida1.rader[0].avdragsgill_del_brutto).toBe(1_056_000);
    expect(ex.ruta4_brutto).toBe(1_056_000);
  });

  it("reparationsunderlaget är resten av det avdragsgrundande beloppet", () => {
    // 24 000 + 20 000 − 10 560 = 33 440 kr.
    expect(beloppIKolumnen(ex.sida2.rader[0])).toBe(3_344_000);
  });
});

describe("varningen om saknad merkostnad", () => {
  it("står en gång per projekt, inte en gång per år", () => {
    const utan = projekt({ ...FONSTER, merkostnad: null });
    const ex = bygg(
      [utan],
      [
        kostnad({ id: "a", totalbelopp: 3_000_000, betaldatum: "2022-12-10", projekt_id: "fonster" }),
        kostnad({ id: "b", totalbelopp: 2_000_000, betaldatum: "2023-01-15", projekt_id: "fonster" }),
      ],
    );
    expect(
      ex.varningar.filter((v) => v.includes("merkostnaden är inte ifylld")),
    ).toEqual(['Projekt "Bytte fönster": merkostnaden är inte ifylld.']);
  });
});
