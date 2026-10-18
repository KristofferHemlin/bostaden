import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Fragetradet, TOMMA_SVAR } from "@/app/projekt/fragetradet";
import {
  merkostnadBehoverBekraftas,
  projektetsBelopp,
} from "@/doman/atgardsberakning";
import { beloppIKolumnen, byggK6aExport } from "@/doman/export-k6a";
import {
  merkostnadAndratText,
  merkostnadOverBeloppetText,
} from "@/doman/regeltext";
import type { Kostnad, Projekt } from "@/doman/typer";
import {
  merkostnadOverBeloppetFel,
  tolkaFragetradetFormData,
} from "@/lib/fragetradet-formdata";
import { REGELPARAMETRAR, kostnad, projekt } from "./_hjalp";

// CLAUDE.md, steg 2: 0 < merkostnad < projektets belopp – strangt i bada
// andar. Avlast i Skatteverkets e-tjanst 2026-10-18: 10 000 kr i kostnad med
// 12 000 kr i merkostnad avvisas, och 10 000 mot 10 000 avvisas ocksa.
//
// Utan taket gav ett projekt med 10 000 kr kvar och 12 000 kr i merkostnad
// 12 000 kr pa sida 1 – mer an som betalats – och −2 000 kr i
// beloppkolumnen pa sida 2.

const NAMN = "Bytte fönster";

function fragetradet(merkostnad: string): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    namn: NAMN,
    byggde_nytt: "nej",
    andrade_planlosning: "nej",
    nytt_eller_bytt: "bytt",
    battre_eller_liknande: "battre",
    merkostnad,
    skick_forvarv: "1",
  })) {
    f.set(k, v);
  }
  return f;
}

describe("frågeträdet vägrar en merkostnad som inte är mindre än projektets belopp", () => {
  const PROJEKT_10_000 = { belopp: 1_000_000 };

  it("12 000 kr mot ett projekt på 10 000 kr vägras, vid merkostnaden", () => {
    expect(tolkaFragetradetFormData(fragetradet("12 000"), PROJEKT_10_000)).toEqual({
      fel: merkostnadOverBeloppetFel(NAMN, 1_000_000),
      falt: "merkostnad",
    });
  });

  it("exakt 10 000 kr vägras också – med samma mening", () => {
    expect(tolkaFragetradetFormData(fragetradet("10 000"), PROJEKT_10_000)).toEqual({
      fel: merkostnadOverBeloppetFel(NAMN, 1_000_000),
      falt: "merkostnad",
    });
  });

  it("9 999,99 kr går igenom", () => {
    const t = tolkaFragetradetFormData(fragetradet("9 999,99"), PROJEKT_10_000);
    expect("fel" in t).toBe(false);
  });

  it("meningen säger vilket projekt och vilket belopp", () => {
    expect(merkostnadOverBeloppetFel(NAMN, 1_000_000)).toBe(
      "Ange en merkostnad mindre än 10 000 kr – det är vad ”Bytte fönster” kostade.",
    );
  });
});

describe("taket i beräkningen", () => {
  // Ett projekt som krympt efter att fragan besvarades: 10 000 kr kvar,
  // merkostnad 12 000 kr.
  const P: Projekt = projekt({
    id: "f",
    namn: NAMN,
    atgardstyp: "utbytt",
    battre_kvalitet: true,
    merkostnad: 1_200_000,
    merkostnad_bas: 5_000_000,
    skick_forvarv: 1,
    skick_forsaljning: 4,
  });
  const K: Kostnad[] = [
    kostnad({ id: "kvar", totalbelopp: 1_000_000, betaldatum: "2023-03-01", projekt_id: "f" }),
  ];
  const ex = byggK6aExport({
    bostad: { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
    medlemskap: { agarandel: 100 },
    projekt: [P],
    kostnader: K,
    kostnader_med_bilaga: [],
    regelparametrar: REGELPARAMETRAR,
  });

  it("inget negativt belopp i beloppkolumnen på sida 2", () => {
    for (const r of ex.sida2.rader) {
      expect(beloppIKolumnen(r)).toBeGreaterThanOrEqual(0);
    }
    expect(beloppIKolumnen(ex.sida2.rader[0])).toBe(0);
  });

  it("ingen grundförbättring större än det som betalats", () => {
    expect(ex.sida1.rader[0].avdragsgill_del_brutto).toBe(1_000_000);
    expect(ex.ruta4_brutto).toBe(1_000_000);
  });

  it("och en upplysning på projektets rad, med båda beloppen", () => {
    expect(ex.sida1.rader[0].varningar).toContain(
      merkostnadOverBeloppetText(NAMN, 1_200_000, 1_000_000),
    );
  });
});

describe("omfrågningen när projektet ändrats", () => {
  const BAS = projekt({
    id: "f",
    namn: NAMN,
    atgardstyp: "utbytt",
    battre_kvalitet: true,
    merkostnad: 1_200_000,
    skick_forvarv: 1,
    skick_forsaljning: 4,
  });
  const K: Kostnad[] = [
    kostnad({ id: "a", totalbelopp: 3_000_000, betaldatum: "2022-12-10", projekt_id: "f" }),
  ];

  it("projektets belopp är det kvittona bidrar med, före ROT", () => {
    expect(projektetsBelopp(K, "f")).toBe(3_000_000);
  });

  it("50 000 kr när frågan besvarades, 30 000 kr i dag: frågan ställs igen", () => {
    const p = { ...BAS, merkostnad_bas: 5_000_000 };
    expect(merkostnadBehoverBekraftas(p, 3_000_000)).toBe("projektet_andrat");
    const ex = byggK6aExport({
      bostad: { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
      medlemskap: { agarandel: 100 },
      projekt: [p],
      kostnader: K,
      kostnader_med_bilaga: [],
      regelparametrar: REGELPARAMETRAR,
    });
    expect(ex.sida1.rader[0].varningar).toEqual([merkostnadAndratText(NAMN)]);
    // Ingen nedskalning: merkostnaden raknas som den besvarades.
    expect(ex.sida1.rader[0].avdragsgill_del_brutto).toBe(1_200_000);
  });

  it("oförändrat projekt: ingen fråga", () => {
    expect(merkostnadBehoverBekraftas({ ...BAS, merkostnad_bas: 3_000_000 }, 3_000_000)).toBeNull();
  });

  it("svar från innan beloppet sparades går inte att jämföra och markeras inte", () => {
    expect(merkostnadBehoverBekraftas({ ...BAS, merkostnad_bas: null }, 3_000_000)).toBeNull();
  });

  it("men taket gäller också för dem", () => {
    expect(
      merkostnadBehoverBekraftas({ ...BAS, merkostnad: 3_000_000, merkostnad_bas: null }, 3_000_000),
    ).toBe("inte_mindre_an_beloppet");
  });
});

describe("raden under ett svar som gör hela beloppet till grundförbättring", () => {
  const RADEN = "Hela beloppet, 85 000 kr, räknas då som grundförbättring.";
  const rendera = (varden: Partial<typeof TOMMA_SVAR>) =>
    renderToStaticMarkup(
      createElement(Fragetradet, {
        varden: { ...TOMMA_SVAR, ...varden },
        onChange: () => {},
        helaBeloppet: 8_500_000,
      }),
    );

  it("fråga 2: ja", () => {
    expect(rendera({ byggdeNytt: "ja" })).toContain(RADEN);
  });

  it("fråga 3: ja", () => {
    expect(rendera({ byggdeNytt: "nej", andradePlanlosning: "ja" })).toContain(RADEN);
  });

  it("fråga 4: det är nytt", () => {
    expect(
      rendera({ byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "nytt" }),
    ).toContain(RADEN);
  });

  it("inte när svaret inte smittar hela beloppet", () => {
    expect(rendera({})).not.toContain("Hela beloppet");
    expect(rendera({ byggdeNytt: "nej" })).not.toContain("Hela beloppet");
    expect(
      rendera({ byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "bytt" }),
    ).not.toContain("Hela beloppet");
  });

  it("ingen hänvisning till att dela upp kvittot", () => {
    expect(rendera({ byggdeNytt: "ja" })).not.toMatch(/dela upp/i);
  });
});
