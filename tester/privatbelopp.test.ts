import { describe, expect, it } from "vitest";
import { enkelPrivatUppdelning } from "@/lib/kostnadsuppdelning";
import type { Kostnad } from "@/doman/typer";

// Privatfaltet pa kvittots detaljvy (produktspec 5, "Kostnadsrad": "det
// vanliga fallet far inte krava bokforing"). enkelPrivatUppdelning kanner
// igen de tva formerna faltet sjalvt hanterar – en enda rad, eller exakt de
// tva rader faltet skapar – och ger null for allt annat, som da bara gar att
// andra via uppdelningsvyn (/dela).

const P = "20000000-0000-0000-0000-000000000001";
const P2 = "20000000-0000-0000-0000-000000000002";

function kostnad(rader: Kostnad["rader"], totalbelopp = 100_000): Kostnad {
  return {
    id: "k1",
    totalbelopp,
    betaldatum: "2026-05-01",
    rot_utnyttjat: 0,
    forsakringsersattning: 0,
    arkiverad: false,
    rader,
  };
}

describe("enkelPrivatUppdelning: enkel kostnad (ingen uppdelning)", () => {
  it("en rad utan fordelning ger privatbelopp 0 och okopplad ovrig del", () => {
    const k = kostnad([{ artikel: "Leverantör", belopp: 100_000, fordelningar: [] }]);
    expect(enkelPrivatUppdelning(k)).toEqual({
      privatbelopp: 0,
      ovrigArtikel: "Leverantör",
      projektId: null,
    });
  });

  it("en rad kopplad till ett projekt bevarar kopplingen", () => {
    const k = kostnad([
      {
        artikel: "Leverantör",
        belopp: 100_000,
        fordelningar: [{ projekt_id: P, privat: false, andel: 1 }],
      },
    ]);
    expect(enkelPrivatUppdelning(k)).toEqual({
      privatbelopp: 0,
      ovrigArtikel: "Leverantör",
      projektId: P,
    });
  });

  it("ett utkast (totalbelopp null) ger null", () => {
    const k = { ...kostnad([]), totalbelopp: null };
    expect(enkelPrivatUppdelning(k)).toBeNull();
  });
});

describe("enkelPrivatUppdelning: den kanoniska privata uppdelningen", () => {
  it("privat rad + ovrig okopplad rad ger nuvarande privatbelopp", () => {
    const k = kostnad([
      { artikel: "Privat", belopp: 40_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] },
      { artikel: "Leverantör", belopp: 60_000, fordelningar: [] },
    ]);
    expect(enkelPrivatUppdelning(k)).toEqual({
      privatbelopp: 40_000,
      ovrigArtikel: "Leverantör",
      projektId: null,
    });
  });

  it("privat rad + ovrig rad kopplad till ett projekt", () => {
    const k = kostnad([
      { artikel: "Leverantör", belopp: 60_000, fordelningar: [{ projekt_id: P, privat: false, andel: 1 }] },
      { artikel: "Privat", belopp: 40_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] },
    ]);
    expect(enkelPrivatUppdelning(k)).toEqual({
      privatbelopp: 40_000,
      ovrigArtikel: "Leverantör",
      projektId: P,
    });
  });
});

describe("enkelPrivatUppdelning: allt annat kraver uppdelningsvyn", () => {
  it("fler an tva rader ger null", () => {
    const k = kostnad([
      { artikel: "a", belopp: 40_000, fordelningar: [{ projekt_id: P, privat: false, andel: 1 }] },
      { artikel: "b", belopp: 30_000, fordelningar: [{ projekt_id: P2, privat: false, andel: 1 }] },
      { artikel: "c", belopp: 30_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] },
    ]);
    expect(enkelPrivatUppdelning(k)).toBeNull();
  });

  it("tva rader kopplade till olika projekt (inget privat) ger null", () => {
    const k = kostnad([
      { artikel: "a", belopp: 50_000, fordelningar: [{ projekt_id: P, privat: false, andel: 1 }] },
      { artikel: "b", belopp: 50_000, fordelningar: [{ projekt_id: P2, privat: false, andel: 1 }] },
    ]);
    expect(enkelPrivatUppdelning(k)).toBeNull();
  });

  it("en delad andel pa den ovriga raden ger null", () => {
    const k = kostnad([
      { artikel: "a", belopp: 60_000, fordelningar: [{ projekt_id: P, privat: false, andel: 0.5 }] },
      { artikel: "b", belopp: 40_000, fordelningar: [{ projekt_id: null, privat: true, andel: 1 }] },
    ]);
    expect(enkelPrivatUppdelning(k)).toBeNull();
  });

  it("en enda rad med tva fordelningar ger null", () => {
    const k = kostnad([
      {
        artikel: "a",
        belopp: 100_000,
        fordelningar: [
          { projekt_id: P, privat: false, andel: 0.5 },
          { projekt_id: null, privat: true, andel: 0.5 },
        ],
      },
    ]);
    expect(enkelPrivatUppdelning(k)).toBeNull();
  });
});
