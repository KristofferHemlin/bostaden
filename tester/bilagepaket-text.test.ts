// Textbyggarna for bilagepaketet: filnamnet och sidhuvudet pa varje
// bilagesida (docs/produktspec.md avsnitt 8, "Bilagepaketet som PDF"). Rena
// funktioner, testas isolerat utan databas – precis som
// arkivexport-namngivning.test.ts.
//
// Beloppen byggs med formateraKronor sjalv (inte handskrivna strangar) eftersom
// den anvander hart mellanslag (U+00A0) som tusentalsavgransare.

import { describe, expect, it } from "vitest";
import {
  bilagepaketAvdragsforklaring,
  bilagepaketFilnamn,
  bilagepaketSidhuvud,
} from "@/lib/bilagepaket/text";
import { formateraKronor } from "@/lib/format";

describe("bilagepaketFilnamn", () => {
  it("bygger 'Bostadsunderlag <adress> <forsaljningsar>.pdf'", () => {
    expect(bilagepaketFilnamn("Ulriksborgsgatan 7", 2026)).toBe(
      "Bostadsunderlag Ulriksborgsgatan 7 2026.pdf",
    );
  });

  it("ersatter tecken otillatna i Windows-filnamn med bindestreck", () => {
    const filnamn = bilagepaketFilnamn('Kvarnen 3:1 / "Norr"', 2027);
    expect(filnamn).not.toMatch(/["/:]/);
    expect(filnamn.endsWith("2027.pdf")).toBe(true);
  });
});

describe("bilagepaketSidhuvud", () => {
  it("bygger sidhuvudet i det last formatet", () => {
    const rad = bilagepaketSidhuvud({
      nummer: 7,
      atgard: "Omstrukturera lägenhet",
      ar: 2026,
      leverantor: "BAUHAUS",
      totalbelopp: 199705,
    });
    expect(rad).toBe(
      `Bilaga 7 · Omstrukturera lägenhet · 2026 · BAUHAUS ${formateraKronor(199705)}`,
    );
  });

  it("visar en fallback nar leverantoren saknas", () => {
    const rad = bilagepaketSidhuvud({
      nummer: 1,
      atgard: "Nytt kök",
      ar: 2026,
      leverantor: null,
      totalbelopp: 50000,
    });
    expect(rad).toBe(`Bilaga 1 · Nytt kök · 2026 · Okänd leverantör ${formateraKronor(50000)}`);
  });

  it("upprepar inte namnet nar atgard och leverantor ar samma ord", () => {
    const rad = bilagepaketSidhuvud({
      nummer: 1,
      atgard: "JANS MÅLERI AB",
      ar: 2016,
      leverantor: "JANS MÅLERI AB",
      totalbelopp: 3442500,
    });
    expect(rad).toBe(`Bilaga 1 · JANS MÅLERI AB · 2016 · ${formateraKronor(3442500)}`);
    // Namnet forekommer bara en gang i strangen.
    expect(rad.match(/JANS MÅLERI AB/g)).toHaveLength(1);
  });

  it("jamforelsen ar skiftlages- och blankstegsokanslig", () => {
    const rad = bilagepaketSidhuvud({
      nummer: 2,
      atgard: "  Jans Måleri AB  ",
      ar: 2016,
      leverantor: "jans måleri ab",
      totalbelopp: 100000,
    });
    expect(rad.match(/måleri/gi)).toHaveLength(1);
  });
});

describe("bilagepaketAvdragsforklaring", () => {
  it("utelamnas helt nar varken ROT eller forsakringsersattning dragits av", () => {
    expect(
      bilagepaketAvdragsforklaring({ rotUtnyttjat: 0, forsakringsersattning: 0 }),
    ).toEqual([]);
  });

  it("visar en dampad ROT-rad nar ROT dragits av", () => {
    const rader = bilagepaketAvdragsforklaring({
      rotUtnyttjat: 750000,
      forsakringsersattning: 0,
    });
    expect(rader).toEqual([`varav ROT ${formateraKronor(750000)}, avgår`]);
  });

  it("visar en dampad forsakringsrad nar forsakringsersattning dragits av", () => {
    const rader = bilagepaketAvdragsforklaring({
      rotUtnyttjat: 0,
      forsakringsersattning: 500000,
    });
    expect(rader).toEqual([
      `varav försäkringsersättning ${formateraKronor(500000)}, avgår`,
    ]);
  });

  it("visar bada raderna nar bade ROT och forsakringsersattning dragits av", () => {
    const rader = bilagepaketAvdragsforklaring({
      rotUtnyttjat: 750000,
      forsakringsersattning: 500000,
    });
    expect(rader).toEqual([
      `varav ROT ${formateraKronor(750000)}, avgår`,
      `varav försäkringsersättning ${formateraKronor(500000)}, avgår`,
    ]);
  });
});
