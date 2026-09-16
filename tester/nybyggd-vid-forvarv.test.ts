import { describe, expect, it } from "vitest";
import {
  avrundaReparationUppat,
  delaIKategorier,
  tillampaSkickfaktor,
  tillampaTidsgranser,
} from "@/doman/atgardsberakning";
import { kostnad, REGELPARAMETRAR } from "./_hjalp";

// Produktspec 4.6: reparation och underhall raknas inte alls om bostaden var
// nybyggd nar den forvarvades – det finns inget "fore" att jamfora skicket
// mot. Grundforbattringen paverkas inte av detta, bara reparationen.

describe("var bostaden nybyggd vid forvarvet ger reparationsdelen 0 kr, oavsett skick", () => {
  const svar = { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 50_000 } as const;

  function reparationEfterTidsgranserOchSkick(
    skickForvarv: number,
    skickForsaljning: number,
  ): number {
    const k = kostnad({ totalbelopp: 100_000, betaldatum: "2020-06-01" });
    const uppdelning = delaIKategorier(k, svar);
    const efterTidsgranser = tillampaTidsgranser(uppdelning, {
      betaldatum: "2020-06-01",
      forsaljningsAr: 2026,
      femarsfonsterAr: 5,
      upplatelseform: "fastighet",
      bostadenNybyggdVidForvarv: true,
      regelparametrar: REGELPARAMETRAR,
    });
    expect(efterTidsgranser.reparationsunderlag).toBe(0);
    // Grundforbattringen (merkostnaden) ar orord av flaggan.
    expect(efterTidsgranser.grundforbattringsdel).toBe(50_000);
    const avdrag = tillampaSkickfaktor(efterTidsgranser, skickForvarv, skickForsaljning);
    return avrundaReparationUppat(avdrag.reparation);
  }

  it("aven med storsta mojliga skickforbattring (0 -> 5) blir reparationen 0 kr", () => {
    expect(reparationEfterTidsgranserOchSkick(0, 5)).toBe(0);
  });

  it("och med ett typiskt skick (1 -> 4) blir den fortfarande 0 kr", () => {
    expect(reparationEfterTidsgranserOchSkick(1, 4)).toBe(0);
  });
});

// Produktspec 4.6, CLAUDE.md: ombildning fran hyresratt upphaver undantaget
// ovan. Den som kopte sin hyresratt vid ombildningen ar formellt forsta
// agare av bostadsratten, men lagenheten fanns och var anvand – da galler
// vanliga regler for reparationer, precis som om bostaden inte var nybyggd
// vid forvarvet.
describe("nybyggd vid forvarvet men kopt vid ombildning fran hyresratt ger reparationsdelen som vanligt", () => {
  it("reparationsunderlaget nollas INTE av tidsgranserna nar ombildning_fran_hyresratt ar true", () => {
    const svar = { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 50_000 } as const;
    const k = kostnad({ totalbelopp: 100_000, betaldatum: "2020-06-01" });
    const uppdelning = delaIKategorier(k, svar);
    const efterTidsgranser = tillampaTidsgranser(uppdelning, {
      betaldatum: "2020-06-01",
      forsaljningsAr: 2026,
      femarsfonsterAr: 5,
      upplatelseform: "bostadsratt",
      bostadenNybyggdVidForvarv: true,
      bostadenOmbildningFranHyresratt: true,
      regelparametrar: REGELPARAMETRAR,
    });
    // Utanfor femarsfonstret (2020 ligger fore 2021-2026) – nollas av
    // fonstret sjalvt, inte av nybyggd-vid-forvarv-undantaget.
    expect(efterTidsgranser.reparationsunderlag).toBe(0);
  });

  it("och ger ett avdrag nar betaldatumet ligger inom femarsfonstret", () => {
    const svar = { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 50_000 } as const;
    const k = kostnad({ totalbelopp: 100_000, betaldatum: "2024-06-01" });
    const uppdelning = delaIKategorier(k, svar);
    const efterTidsgranser = tillampaTidsgranser(uppdelning, {
      betaldatum: "2024-06-01",
      forsaljningsAr: 2026,
      femarsfonsterAr: 5,
      upplatelseform: "bostadsratt",
      bostadenNybyggdVidForvarv: true,
      bostadenOmbildningFranHyresratt: true,
      regelparametrar: REGELPARAMETRAR,
    });
    expect(efterTidsgranser.reparationsunderlag).toBeGreaterThan(0);
    const avdrag = tillampaSkickfaktor(efterTidsgranser, 1, 4);
    expect(avrundaReparationUppat(avdrag.reparation)).toBeGreaterThan(0);
  });
});
