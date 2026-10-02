import { describe, expect, it } from "vitest";
import {
  bidragForKostnad,
  bostadensBelopp,
  inlagtArsbelopp,
  privatBelopp,
  rotForBelopp,
} from "@/doman/berakningar";
import type { Kostnad } from "@/doman/typer";
import { formateraKronor } from "@/lib/format";
import { grupperaPerAr, privatAvgarRad, rotAvgarRad } from "@/lib/kvittolista";
import { kostnad } from "./_hjalp";

// CLAUDE.md, "Avrakning, fordelning och andel": ROT fordelas aldrig pa en
// privat del. Den privata delen raknas bort forst, ROT darefter. 10 000 kr med
// 3 000 kr ROT och 1 000 kr privat bidrar med 6 000 kr, inte 6 300.
// docs/design.md, Listrader: raderna gar ihop exakt – totalbelopp minus
// "varav ROT … avgår" minus "varav … hörde inte till bostaden, avgår".

function kvitto(over: { rot?: number; privat?: number; id?: string }): Kostnad {
  const totalbelopp = 1_000_000;
  const privat = over.privat ?? 0;
  return kostnad({
    id: over.id ?? "k",
    betaldatum: "2026-04-01",
    totalbelopp,
    rot_utnyttjat: over.rot ?? 0,
    rader: [
      {
        artikel: "bostaden",
        belopp: totalbelopp - privat,
        fordelningar: [{ projekt_id: "p1", privat: false, andel: 1 }],
      },
      ...(privat > 0
        ? [
            {
              artikel: "privat",
              belopp: privat,
              fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
            },
          ]
        : []),
    ],
  });
}

const BARA_ROT = kvitto({ id: "rot", rot: 300_000 });
const BARA_PRIVAT = kvitto({ id: "privat", privat: 100_000 });
const BADA = kvitto({ id: "bada", rot: 300_000, privat: 100_000 });

/** Det raden visar: totalbelopp minus de avgar-rader den bar. */
function radernasSumma(k: Kostnad): number {
  return (
    (k.totalbelopp ?? 0) -
    rotForBelopp(k, bostadensBelopp(k)) -
    privatBelopp(k)
  );
}

describe("privat del raknas bort fore ROT", () => {
  it.each([
    ["bara ROT", BARA_ROT, 700_000],
    ["bara privat", BARA_PRIVAT, 900_000],
    ["bade ROT och privat – 6 000 kr, inte 6 300", BADA, 600_000],
  ])("%s", (_namn, k, vantat) => {
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(vantat);
    expect(bidragForKostnad(k, "p1")).toBe(vantat);
  });

  it("fordelning mellan atgarder ar fortfarande proportionell – 4 200 kr", () => {
    const k = kostnad({ totalbelopp: 1_000_000, rot_utnyttjat: 300_000, andel: 0.6 });
    expect(bidragForKostnad(k, "p1")).toBe(420_000);
  });
});

describe("arsrubriken gar att rakna ihop av raderna", () => {
  it.each([
    ["bara ROT", BARA_ROT],
    ["bara privat", BARA_PRIVAT],
    ["bade ROT och privat", BADA],
  ])("%s", (_namn, k) => {
    const grupp = grupperaPerAr([{ kostnad: k, datum: k.betaldatum }])[0];
    expect(grupp.summa).toBe(radernasSumma(k));
  });

  it("alla tre i samma ar", () => {
    const kostnader = [BARA_ROT, BARA_PRIVAT, BADA];
    const grupp = grupperaPerAr(kostnader.map((k) => ({ kostnad: k, datum: k.betaldatum })))[0];
    expect(grupp.summa).toBe(kostnader.reduce((s, k) => s + radernasSumma(k), 0));
    expect(grupp.summa).toBe(2_200_000);
  });
});

describe("avgar-raderna", () => {
  it("ROT-raden visar hela ROT-beloppet aven nar en del ar privat", () => {
    expect(rotAvgarRad(rotForBelopp(BADA, bostadensBelopp(BADA)))).toBe(
      `varav ROT ${formateraKronor(300_000)}, avgår`,
    );
  });

  it("privatraden: varav 1 000 kr hörde inte till bostaden, avgår", () => {
    expect(privatAvgarRad(privatBelopp(BADA))).toBe(
      `varav ${formateraKronor(100_000)} hörde inte till bostaden, avgår`,
    );
  });

  it("ingen privatrad utan privat del", () => {
    expect(privatBelopp(BARA_ROT)).toBe(0);
    expect(privatAvgarRad(0)).toBeUndefined();
  });
});
