// Filnamnen ar hela arkivexportens funktion (docs/produktspec.md avsnitt 12,
// CLAUDE.md steg 14) – testas darfor isolerat, rent, utan databas och Storage.
//
// Beloppen byggs med formateraKronor sjalv (inte handskrivna strangar) eftersom
// den anvander hart mellanslag (U+00A0) som tusentalsavgransare – en vanlig
// mellanslagstangent i ett handskrivet forvantat varde skulle ge ett falskt
// negativt test.

import { describe, expect, it } from "vitest";
import { byggArkivsokvagar, type ArkivfilIndata } from "@/lib/arkivexport/namngivning";
import { formateraKronor } from "@/lib/format";

function fil(overrides: Partial<ArkivfilIndata> = {}): ArkivfilIndata {
  return {
    bilagaId: "b1",
    betaldatum: new Date("2026-04-14"),
    leverantor: "BAUHAUS",
    anteckning: null,
    belopp: 199705,
    andelse: "jpg",
    ...overrides,
  };
}

describe("byggArkivsokvagar", () => {
  it("lagger kostnaden i en mapp per betalar, med jamnt belopp utan oren", () => {
    const [resultat] = byggArkivsokvagar([
      fil({ betaldatum: new Date("2025-03-05"), leverantor: "K-Bygg Sverige AB", belopp: 465900 }),
    ]);
    expect(resultat.sokvag).toBe(
      `2025/2025-03-05 K-Bygg Sverige AB ${formateraKronor(465900)}.jpg`,
    );
    expect(formateraKronor(465900)).toBe("4 659 kr"); // jamnt belopp – inga oren
  });

  it("visar oren nar beloppet inte ar jamnt", () => {
    const [resultat] = byggArkivsokvagar([fil({ belopp: 199705 })]);
    expect(resultat.sokvag).toBe(`2026/2026-04-14 BAUHAUS ${formateraKronor(199705)}.jpg`);
    expect(formateraKronor(199705)).toBe("1 997,05 kr");
  });

  it("anvander anteckningen nar leverantor saknas", () => {
    const [resultat] = byggArkivsokvagar([
      fil({ leverantor: null, anteckning: "Jans Maleri AB", betaldatum: null, belopp: 3442500 }),
    ]);
    expect(resultat.sokvag).toBe(`utan-datum/Jans Maleri AB ${formateraKronor(3442500)}.jpg`);
  });

  it("skriver bara datum och belopp nar bade leverantor och anteckning saknas", () => {
    const [resultat] = byggArkivsokvagar([
      fil({ leverantor: null, anteckning: null, betaldatum: new Date("2026-04-18"), belopp: 24890 }),
    ]);
    expect(resultat.sokvag).toBe(`2026/2026-04-18 ${formateraKronor(24890)}.jpg`);
  });

  it("lagger kostnader utan betaldatum i mappen utan-datum", () => {
    const [resultat] = byggArkivsokvagar([fil({ betaldatum: null })]);
    expect(resultat.sokvag.startsWith("utan-datum/")).toBe(true);
  });

  it("numrerar kolliderande sokvagar -2, -3 direkt efter beloppet", () => {
    const resultat = byggArkivsokvagar([
      fil({ bilagaId: "b1" }),
      fil({ bilagaId: "b2" }),
      fil({ bilagaId: "b3" }),
    ]);
    const grund = `2026/2026-04-14 BAUHAUS ${formateraKronor(199705)}`;
    expect(resultat.map((r) => r.sokvag)).toEqual([
      `${grund}.jpg`,
      `${grund}-2.jpg`,
      `${grund}-3.jpg`,
    ]);
  });

  it("kolliderar inte nar filandelsen skiljer", () => {
    const resultat = byggArkivsokvagar([
      fil({ bilagaId: "b1", andelse: "jpg" }),
      fil({ bilagaId: "b2", andelse: "pdf" }),
    ]);
    const grund = `2026/2026-04-14 BAUHAUS ${formateraKronor(199705)}`;
    expect(resultat.map((r) => r.sokvag)).toEqual([`${grund}.jpg`, `${grund}.pdf`]);
  });

  it("ersatter tecken otillatna i Windows-filnamn med bindestreck", () => {
    const [resultat] = byggArkivsokvagar([
      fil({ leverantor: 'A/S "Bygg": Norr?*<>|\\Syd' }),
    ]);
    expect(resultat.sokvag).toBe(
      `2026/2026-04-14 A-S -Bygg-- Norr------Syd ${formateraKronor(199705)}.jpg`,
    );
    // Inga tecken fran den otillatna mangden far finnas kvar nagonstans i sokvagen.
    expect(resultat.sokvag).not.toMatch(/["*<>?|\\]/);
  });

  it("kortar av ett mycket langt leverantorsnamn utan att trunkera datum eller belopp", () => {
    const langtNamn = "Ett Extremt Langt Leverantorsnamn ".repeat(20).trim();
    const [resultat] = byggArkivsokvagar([fil({ leverantor: langtNamn })]);

    expect(resultat.sokvag.startsWith("2026/2026-04-14 ")).toBe(true);
    expect(resultat.sokvag.endsWith(`${formateraKronor(199705)}.jpg`)).toBe(true);
    // Namndelen (utan mapp och filandelse) hamnar inom rimlig langd for vanliga filsystem.
    const namndel = resultat.sokvag.slice(resultat.sokvag.indexOf("/") + 1, -".jpg".length);
    expect(namndel.length).toBeLessThanOrEqual(200);
  });
});
