import { describe, expect, it } from "vitest";
import { bidragForKostnad } from "@/doman/berakningar";
import {
  inlineUppdelningTillIndata,
  tolkaUppdelning,
} from "@/lib/kostnadsuppdelning";
import type { Kostnad } from "@/doman/typer";

// docs/design.md, "Uppdelning av kvitto vid inmatning": uppdelningen ligger i
// sjalva kostnadsformularet som en utfallbar del. Inga procenttal, inget malval
// per rad – anvandaren anger artikel och belopp och markerar vad som ar privat.
// Resten hor till den befintliga gruppering man ev. kopplat kostnaden till via
// genvagen langst ned, annars blir raderna okopplade.
// inlineUppdelningTillIndata oversatter den formen till tolkaUppdelnings indata;
// sjalva invarianterna (summa = totalbelopp, bidrag, ROT) testas i
// dela-kostnad.test.ts och galler oforandrat.

const PROJEKT = "20000000-0000-0000-0000-000000000001";

function medRader(totalbelopp: number, rader: Kostnad["rader"]): Kostnad {
  return {
    id: "k1",
    totalbelopp,
    betaldatum: "2026-08-22",
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader,
  };
}

// Bauhaus-kvittot ur produktspec avsnitt 11 sett som formularets rader: fyra
// rader till atgarden, torkstativet markerat privat.
const BAUHAUS = [
  { artikel: "XT KORT VINKELPENSEL", belopp: "179,00", privat: false },
  { artikel: "ELITE ROLLERSET 18 C", belopp: "169,00", privat: false },
  { artikel: "PRECISION INOMHUS PR", belopp: "94,95", privat: false },
  { artikel: "LIVING VÄGGFÄRG HE", belopp: "349,00", privat: false },
  { artikel: "TORKSTATIV SUSSI BLA", belopp: "229,00", privat: true },
];

describe("inlineUppdelningTillIndata: befintligt projekt", () => {
  it("icke-privata rader hor till det valda malet, den privata blir privat", () => {
    const indata = inlineUppdelningTillIndata(BAUHAUS, PROJEKT);
    const r = tolkaUppdelning(indata, 102_095);
    if ("fel" in r) throw new Error(r.fel);

    expect(r.rader).toHaveLength(5);
    expect(
      r.rader.slice(0, 4).every((x) =>
        x.fordelningar.every(
          (f) => f.projekt_id === PROJEKT && !f.privat && f.andel === 1,
        ),
      ),
    ).toBe(true);
    expect(r.rader[4].fordelningar).toEqual([
      { projekt_id: null, privat: true, andel: 1 },
    ]);
    expect(r.projektIder).toEqual([PROJEKT]);

    // Torkstativet bidrar med 0, de fyra andra med 791,95 kr.
    expect(bidragForKostnad(medRader(102_095, r.rader), PROJEKT)).toBe(79_195);
  });

  it("ingen andel-inmatning – alla projektrader ligger pa 100 %", () => {
    const indata = inlineUppdelningTillIndata(BAUHAUS, PROJEKT);
    expect(indata.every((r) => r.andel === "")).toBe(true);
    const r = tolkaUppdelning(indata, 102_095);
    if ("fel" in r) throw new Error(r.fel);
    expect(
      r.rader
        .flatMap((x) => x.fordelningar)
        .filter((f) => !f.privat)
        .every((f) => f.andel === 1),
    ).toBe(true);
  });

  it("radernas belopp maste ga ihop med totalbeloppet", () => {
    const indata = inlineUppdelningTillIndata(BAUHAUS.slice(0, 4), PROJEKT);
    expect("fel" in tolkaUppdelning(indata, 102_095)).toBe(true);
  });
});

describe("inlineUppdelningTillIndata: utan projektkoppling", () => {
  it("tomt mal ger okopplade rader – ingen fordelning pa de icke-privata", () => {
    const indata = inlineUppdelningTillIndata(
      [
        { artikel: "material", belopp: "800,00", privat: false },
        { artikel: "krukväxt", belopp: "200,00", privat: true },
      ],
      "",
    );
    const r = tolkaUppdelning(indata, 100_000);
    if ("fel" in r) throw new Error(r.fel);
    expect(r.rader[0].fordelningar).toEqual([]);
    expect(r.rader[1].fordelningar).toEqual([
      { projekt_id: null, privat: true, andel: 1 },
    ]);
    expect(r.projektIder).toEqual([]);
  });
});
