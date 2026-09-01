import { describe, expect, it } from "vitest";
import { bidragForKostnad, harledKostnadstillstand } from "@/doman/berakningar";
import { tolkaUppdelning } from "@/lib/kostnadsuppdelning";
import type { Kostnad } from "@/doman/typer";

// Steg 10: uppdelning av ett kvitto pa radniva. tolkaUppdelning tolkar
// formularets rader till domanens radform och validerar invarianterna
// (produktspec 5 "Kostnadsrad" + 4.2): summan av radernas belopp MASTE vara lika
// med kostnadens totalbelopp, en rads fordelning far summera till hogst 100 %
// (resten ar okopplat), och ett ROT-/forsakringskvitto far bara kopplas till ett
// projekt. Sjalva bidraget raknas av den befintliga domanlogiken – ingen ny
// berakningsregel i steg 10.

const P = "20000000-0000-0000-0000-000000000001";
const P2 = "20000000-0000-0000-0000-000000000002";

/** Bygger en doman-Kostnad av tolkaUppdelnings rader sa att bidraget kan raknas. */
function medRader(
  totalbelopp: number,
  rader: Kostnad["rader"],
  over: Partial<Kostnad> = {},
): Kostnad {
  return {
    id: "k1",
    totalbelopp,
    betaldatum: "2026-05-01",
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader,
    ...over,
  };
}

// Bauhaus-kvittot ur produktspec avsnitt 11: 1 020,95 kr, fem rader dar
// torkstativet pa 229 kr ar privat och de fyra andra pa 791,95 kr hor till
// projektet.
const BAUHAUS = [
  { artikel: "XT KORT VINKELPENSEL", belopp: "179,00", mal: P, andel: "" },
  { artikel: "ELITE ROLLERSET 18 C", belopp: "169,00", mal: P, andel: "" },
  { artikel: "PRECISION INOMHUS PR", belopp: "94,95", mal: P, andel: "" },
  { artikel: "LIVING VÄGGFÄRG HE", belopp: "349,00", mal: P, andel: "" },
  { artikel: "TORKSTATIV SUSSI BLA", belopp: "229,00", mal: "privat", andel: "" },
];

describe("tolkaUppdelning: Bauhaus-kvittot", () => {
  it("fem rader dar torkstativet ar privat och de fyra andra hor till projektet", () => {
    const r = tolkaUppdelning(BAUHAUS, 102_095);
    if ("fel" in r) throw new Error(r.fel);
    expect(r.rader).toHaveLength(5);
    expect(r.rader.map((x) => x.belopp)).toEqual([
      17_900, 16_900, 9_495, 34_900, 22_900,
    ]);
    expect(r.rader.slice(0, 4).every((x) =>
      x.fordelningar.every(
        (f) => f.projekt_id === P && !f.privat && f.andel === 1,
      ),
    )).toBe(true);
    expect(r.rader[4].fordelningar).toEqual([
      { projekt_id: null, privat: true, andel: 1 },
    ]);
    expect(r.projektIder).toEqual([P]);
  });

  it("projektsumman blir 791,95 kr och den privata raden bidrar med 0", () => {
    const r = tolkaUppdelning(BAUHAUS, 102_095);
    if ("fel" in r) throw new Error(r.fel);
    const k = medRader(102_095, r.rader);
    expect(bidragForKostnad(k, P)).toBe(79_195);
  });

  it("radernas belopp maste summera till totalbeloppet – for lite avvisas", () => {
    const utanTorkstativ = BAUHAUS.slice(0, 4);
    expect("fel" in tolkaUppdelning(utanTorkstativ, 102_095)).toBe(true);
  });

  it("for mycket pa raderna avvisas ocksa", () => {
    const forMycket = [
      ...BAUHAUS,
      { artikel: "extra", belopp: "1,00", mal: "", andel: "" },
    ];
    expect("fel" in tolkaUppdelning(forMycket, 102_095)).toBe(true);
  });
});

describe("tolkaUppdelning: partiell fordelning och okopplat", () => {
  it("en rad fordelad 60 % bidrar med 60 % av beloppet", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "material", belopp: "1 000,00", mal: P, andel: "60" },
        { artikel: "rest", belopp: "500,00", mal: "privat", andel: "" },
      ],
      150_000,
    );
    if ("fel" in r) throw new Error(r.fel);
    expect(r.rader[0].fordelningar).toEqual([
      { projekt_id: P, privat: false, andel: 0.6 },
    ]);
    const k = medRader(150_000, r.rader);
    expect(bidragForKostnad(k, P)).toBe(60_000); // 100 000 * 0,6, ingen ROT
  });

  it("tom andel tolkas som 100 %", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "a", belopp: "100,00", mal: P, andel: "" },
        { artikel: "b", belopp: "100,00", mal: P, andel: "" },
      ],
      20_000,
    );
    if ("fel" in r) throw new Error(r.fel);
    expect(r.rader.every((x) => x.fordelningar[0].andel === 1)).toBe(true);
  });

  it("mal tomt ger en rad utan fordelning – okopplat, utanfor bidraget", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "kopplad", belopp: "100,00", mal: P, andel: "" },
        { artikel: "okopplad", belopp: "100,00", mal: "", andel: "" },
      ],
      20_000,
    );
    if ("fel" in r) throw new Error(r.fel);
    expect(r.rader[1].fordelningar).toEqual([]);
    const k = medRader(20_000, r.rader);
    expect(bidragForKostnad(k, P)).toBe(10_000); // bara den kopplade raden
    expect(harledKostnadstillstand(k).kopplad).toBe(true);
  });

  it("andel utanfor 1–100 % avvisas", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "a", belopp: "100,00", mal: P, andel: "150" },
        { artikel: "b", belopp: "100,00", mal: P, andel: "" },
      ],
      20_000,
    );
    expect("fel" in r).toBe(true);
  });
});

describe("tolkaUppdelning: grindar", () => {
  it("farre an tva rader avvisas", () => {
    const r = tolkaUppdelning(
      [{ artikel: "allt", belopp: "100,00", mal: P, andel: "" }],
      10_000,
    );
    expect("fel" in r).toBe(true);
  });

  it("tomma extrarader ignoreras och blockerar inte", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "a", belopp: "100,00", mal: P, andel: "" },
        { artikel: "b", belopp: "100,00", mal: "privat", andel: "" },
        { artikel: "", belopp: "", mal: "", andel: "" },
      ],
      20_000,
    );
    expect("fel" in r).toBe(false);
  });

  it("rad utan belopp avvisas", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "a", belopp: "", mal: P, andel: "" },
        { artikel: "b", belopp: "100,00", mal: P, andel: "" },
      ],
      10_000,
    );
    expect("fel" in r).toBe(true);
  });

  it("rad utan artikel avvisas", () => {
    const r = tolkaUppdelning(
      [
        { artikel: "", belopp: "100,00", mal: P, andel: "" },
        { artikel: "b", belopp: "100,00", mal: P, andel: "" },
      ],
      20_000,
    );
    expect("fel" in r).toBe(true);
  });
});

describe("tolkaUppdelning: ROT och forsakringsersattning (4.2)", () => {
  it("ett ROT-/forsakringskvitto far bara kopplas till ett projekt", () => {
    const tvaProjekt = [
      { artikel: "a", belopp: "100,00", mal: P, andel: "" },
      { artikel: "b", belopp: "100,00", mal: P2, andel: "" },
    ];
    expect(
      "fel" in tolkaUppdelning(tvaProjekt, 20_000, { endastEttProjekt: true }),
    ).toBe(true);
    expect(
      "fel" in tolkaUppdelning(tvaProjekt, 20_000, { endastEttProjekt: false }),
    ).toBe(false);
  });

  it("privat rad rakas inte som ett andra projekt", () => {
    const r = tolkaUppdelning(BAUHAUS, 102_095, { endastEttProjekt: true });
    expect("fel" in r).toBe(false);
  });

  it("ROT drar ner bidraget aven nar kvittot ar uppdelat", () => {
    const r = tolkaUppdelning(BAUHAUS, 102_095, { endastEttProjekt: true });
    if ("fel" in r) throw new Error(r.fel);
    const utanRot = bidragForKostnad(medRader(102_095, r.rader), P);
    const medRot = bidragForKostnad(
      medRader(102_095, r.rader, { rot_utnyttjat: 20_000 }),
      P,
    );
    expect(utanRot).toBe(79_195);
    expect(medRot).toBeLessThan(utanRot);
    expect(medRot).toBeGreaterThan(0);
  });
});
