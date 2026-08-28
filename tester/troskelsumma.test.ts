import { describe, expect, it } from "vitest";
import {
  arssummaForBostad,
  troskelgrundandeArsbelopp,
} from "@/doman/berakningar";
import { kostnad, projekt } from "./_hjalp";

describe("vad som ingar i arets troskelsumma (produktspec 4.2)", () => {
  it("reparation med battre_skick_vid_forsaljning = false ingar inte i arets troskelsumma", () => {
    const rep = projekt({
      id: "p1",
      kategori: "reparation",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: false,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-05-01",
      totalbelopp: 300_000,
      projekt_id: "p1",
    });
    const indata = { kostnader: [k], projekt: [rep] };
    expect(arssummaForBostad(indata, 2030)).toBe(300_000); // den rana arssumman ser beloppet
    expect(troskelgrundandeArsbelopp(indata, 2030)).toBe(0); // troskelsumman gor det inte
  });

  it("reparation med slitet_vid_tilltrade = false ingar inte heller i troskelsumman", () => {
    const rep = projekt({
      id: "p1",
      kategori: "reparation",
      slitet_vid_tilltrade: false,
      battre_skick_vid_forsaljning: true,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-05-01",
      totalbelopp: 300_000,
      projekt_id: "p1",
    });
    expect(
      troskelgrundandeArsbelopp({ kostnader: [k], projekt: [rep] }, 2030),
    ).toBe(0);
  });

  it("reparation utanfor femarsfonstret ingar i sitt utgiftsars troskelsumma", () => {
    // Femarsfonstret provas inte har – bara vid sjalva avdraget. Utgiften VAR en
    // forbattringsutgift nar den lades ned.
    const rep = projekt({
      id: "p1",
      kategori: "reparation",
      slitet_vid_tilltrade: true,
      battre_skick_vid_forsaljning: true,
    });
    const k = kostnad({
      id: "k1",
      betaldatum: "2026-05-01",
      totalbelopp: 300_000,
      projekt_id: "p1",
    });
    expect(
      troskelgrundandeArsbelopp({ kostnader: [k], projekt: [rep] }, 2026),
    ).toBe(300_000);
  });

  it("null pa en grind exkluderar inte – bara ett uttryckligt false", () => {
    const rep = projekt({ id: "p1", kategori: "reparation" }); // bada grindar null
    const k = kostnad({
      id: "k1",
      betaldatum: "2030-05-01",
      totalbelopp: 300_000,
      projekt_id: "p1",
    });
    expect(
      troskelgrundandeArsbelopp({ kostnader: [k], projekt: [rep] }, 2030),
    ).toBe(300_000);
  });
});
