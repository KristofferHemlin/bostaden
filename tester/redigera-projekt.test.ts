import { describe, expect, it } from "vitest";
import { kostnaderKoppladeTillProjekt } from "@/doman/berakningar";
import {
  domanKostnader,
  PROJEKT_MALA_SOVRUM,
} from "@/doman/seeddata";
import { kostnad } from "./_hjalp";

// Redigering och borttagning av ett projekt. Ett projekt med kopplade kostnader
// far inte tas bort forran kostnaderna flyttats eller kopplats loss.
//
// Vad en omklassificering (nytt svar pa fragetradet) gor med arets troskelsumma
// testas i tester/troskel-ny-modell.test.ts – den beraknas nu via hela
// fragetradet (src/doman/atgardsberakning.ts + src/doman/export-k6a.ts), inte
// via en enkel kategori-filtrering.

describe("kostnaderKoppladeTillProjekt: vad som blockerar en borttagning", () => {
  it("seed-projektet 'Mala sovrum' blockeras av Bauhaus-kvittot", () => {
    const blockerande = kostnaderKoppladeTillProjekt(
      domanKostnader,
      PROJEKT_MALA_SOVRUM,
    );
    expect(blockerande.map((k) => k.id)).toEqual([domanKostnader[0].id]);
  });

  it("ett projekt utan kopplade kostnader blockeras inte", () => {
    expect(
      kostnaderKoppladeTillProjekt(domanKostnader, "finns-inte"),
    ).toEqual([]);
  });

  it("en rad som bara ar privat kopplar inte kostnaden till projektet", () => {
    const k = kostnad({
      id: "k1",
      totalbelopp: 50_000,
      rader: [
        {
          artikel: "torkstativ",
          belopp: 50_000,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    expect(kostnaderKoppladeTillProjekt([k], "p1")).toEqual([]);
  });

  it("en fordelning med andel 0 blockerar inte", () => {
    const k = kostnad({
      id: "k1",
      totalbelopp: 50_000,
      rader: [
        {
          artikel: "rad",
          belopp: 50_000,
          fordelningar: [{ projekt_id: "p1", privat: false, andel: 0 }],
        },
      ],
    });
    expect(kostnaderKoppladeTillProjekt([k], "p1")).toEqual([]);
  });
});
