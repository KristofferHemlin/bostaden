import { describe, expect, it } from "vitest";
import {
  avrundaReparationUppat,
  delaIKategorier,
  tillampaSkickfaktor,
  tillampaTidsgranser,
} from "@/doman/atgardsberakning";
import { kostnad, REGELPARAMETRAR } from "./_hjalp";

// De sex forsta fallen i CLAUDE.md ar verifierade mot Skatteverkets e-tjanst
// 2026-09-15 och far inte justeras for att koden ska passera – gar de inte
// igenom ar det koden som ar fel.

describe("fragetradet delar avdragsgrundande i grundforbattring och reparation", () => {
  it("utbytt, battre kvalitet, 1 000 kr med 500 kr merkostnad, skick 1->4: 500 kr grundforbattring, 300 kr reparation", () => {
    const k = kostnad({ totalbelopp: 100_000 });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: 50_000,
    });
    // Merkostnaden dras av innan skickfaktorn tillampas, aldrig efter: 500 kr
    // grundforbattring + 500 kr reparationsunderlag, inte 600 kr reparation.
    expect(uppdelning).toEqual({
      grundforbattringsdel: 50_000,
      reparationsunderlag: 50_000,
    });
    const avdrag = tillampaSkickfaktor(uppdelning, 1, 4);
    expect(avdrag.grundforbattring).toBe(50_000);
    expect(avrundaReparationUppat(avdrag.reparation)).toBe(30_000);
  });

  it("utbytt, liknande kvalitet, 3 000 kr, skick 0->5: 0 kr grundforbattring, 3 000 kr reparation", () => {
    const k = kostnad({ totalbelopp: 300_000 });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      merkostnad: null,
    });
    expect(uppdelning).toEqual({
      grundforbattringsdel: 0,
      reparationsunderlag: 300_000,
    });
    const avdrag = tillampaSkickfaktor(uppdelning, 0, 5);
    expect(avdrag.grundforbattring).toBe(0);
    expect(avrundaReparationUppat(avdrag.reparation)).toBe(300_000);
  });

  it("utbytt, liknande kvalitet, 3 000 kr, skick 3->3: 0 kr i bada kategorierna", () => {
    const k = kostnad({ totalbelopp: 300_000 });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      merkostnad: null,
    });
    const avdrag = tillampaSkickfaktor(uppdelning, 3, 3);
    expect(avdrag.grundforbattring).toBe(0);
    expect(avrundaReparationUppat(avdrag.reparation)).toBe(0);
  });

  it("skick 4->1 ger 0 kr, aldrig ett negativt belopp", () => {
    const k = kostnad({ totalbelopp: 300_000 });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      merkostnad: null,
    });
    const avdrag = tillampaSkickfaktor(uppdelning, 4, 1);
    expect(avdrag.reparation).toBe(0);
    expect(avrundaReparationUppat(avdrag.reparation)).toBe(0);
  });

  it("byggt nytt eller andrad planlosning: hela beloppet blir grundforbattring, skickfragorna paverkar aldrig resultatet", () => {
    const k = kostnad({ totalbelopp: 500_000 });
    for (const atgardstyp of ["nybyggnad", "planlosning", "nytt_tillagg"] as const) {
      const uppdelning = delaIKategorier(k, {
        atgardstyp,
        battre_kvalitet: null,
        merkostnad: null,
      });
      expect(uppdelning).toEqual({
        grundforbattringsdel: 500_000,
        reparationsunderlag: 0,
      });
      // Fragorna 6-7 stalls aldrig for en ren grundforbattring – vilket skick
      // man an matar in paverkar aldrig reparationen, den finns inte.
      const avdrag = tillampaSkickfaktor(uppdelning, 0, 5);
      expect(avdrag.reparation).toBe(0);
      expect(avdrag.grundforbattring).toBe(500_000);
    }
  });

  it("utbytt, battre kvalitet, 3 000 kr med 1 kr merkostnad, skick 1->4, ar 2022 vid forsaljning 2026: 1 kr grundforbattring, 1 800 kr reparation", () => {
    const k = kostnad({ totalbelopp: 300_000, betaldatum: "2022-06-01" });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: 100,
    });
    expect(uppdelning).toEqual({
      grundforbattringsdel: 100,
      reparationsunderlag: 299_900,
    });
    // 2022 ligger inom femarsfonstret (2021-2026) sa tidsgranserna ska inte
    // andra nagot har – detta bekraftar bara att fallet inte rakar sta utanfor.
    const efterTidsgranser = tillampaTidsgranser(uppdelning, {
      betaldatum: "2022-06-01",
      forsaljningsAr: 2026,
      femarsfonsterAr: 5,
      upplatelseform: "fastighet",
      bostadenNybyggdVidForvarv: false,
      regelparametrar: REGELPARAMETRAR,
    });
    expect(efterTidsgranser).toEqual(uppdelning);
    const avdrag = tillampaSkickfaktor(efterTidsgranser, 1, 4);
    expect(avdrag.grundforbattring).toBe(100);
    // 2 999 kr * 0,6 = 1 799,40 kr, som avrundas UPPAT till 1 800 kr – se
    // tester/avrundning-reparation.test.ts for bakgrunden till avrundningen.
    expect(avrundaReparationUppat(avdrag.reparation)).toBe(180_000);
  });
});
