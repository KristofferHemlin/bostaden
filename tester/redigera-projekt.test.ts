import { describe, expect, it } from "vitest";
import {
  arssummaForBostad,
  kostnaderKoppladeTillProjekt,
  troskelgrundandeArsbelopp,
} from "@/doman/berakningar";
import {
  domanKostnader,
  PROJEKT_MALA_SOVRUM,
} from "@/doman/seeddata";
import { kostnad, projekt } from "./_hjalp";

// Redigering och borttagning av ett projekt. Ett projekt med kopplade kostnader
// far inte tas bort forran kostnaderna flyttats eller kopplats loss – och
// omklassificering (fraga 2/3) ska slaa igenom i arets troskelsumma direkt.

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

describe("omklassificering rakas om i arets troskelsumma direkt", () => {
  const k = kostnad({
    id: "k1",
    betaldatum: "2026-05-01",
    totalbelopp: 300_000,
    projekt_id: "p1",
  });

  it("reparation med slitet_vid_tilltrade = null ingar i troskelsumman", () => {
    const p = projekt({ id: "p1", kategori: "reparation" });
    expect(
      troskelgrundandeArsbelopp({ kostnader: [k], projekt: [p] }, 2026),
    ).toBe(300_000);
  });

  it("efter omklassificering till slitet_vid_tilltrade = false faller bidraget bort", () => {
    const p = projekt({
      id: "p1",
      kategori: "reparation",
      slitet_vid_tilltrade: false,
    });
    // Den rana arssumman ser fortfarande beloppet ...
    expect(arssummaForBostad({ kostnader: [k], projekt: [p] }, 2026)).toBe(
      300_000,
    );
    // ... men troskelsumman gor det inte langre.
    expect(
      troskelgrundandeArsbelopp({ kostnader: [k], projekt: [p] }, 2026),
    ).toBe(0);
  });

  it("omklassificering till grundforbattring tar in bidraget oavsett skick", () => {
    const p = projekt({
      id: "p1",
      kategori: "grundforbattring",
      slitet_vid_tilltrade: false,
    });
    expect(
      troskelgrundandeArsbelopp({ kostnader: [k], projekt: [p] }, 2026),
    ).toBe(300_000);
  });
});
