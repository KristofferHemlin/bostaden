import { describe, expect, it } from "vitest";
import {
  arssummaForBostad,
  avdragsgrundandeArsbelopp,
  bidragForKostnad,
} from "@/doman/berakningar";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import {
  KOSTNAD_BAUHAUS,
  PROJEKT_MALA_SOVRUM,
  SEED_KOSTNADER,
  SEED_PROJEKT,
  SEED_REGELPARAMETRAR,
  domanKostnader,
  domanProjekt,
} from "@/doman/seeddata";

const bauhaus = SEED_KOSTNADER.find((k) => k.id === KOSTNAD_BAUHAUS)!;

describe("Bauhaus-kvittot ur produktspec avsnitt 11", () => {
  it("radernas belopp summerar till totalbeloppet 1 020,95 kr", () => {
    const summa = bauhaus.rader.reduce((s, r) => s + r.belopp, 0);
    expect(summa).toBe(102_095);
    expect(summa).toBe(bauhaus.totalbelopp);
  });

  it("projektsumman ar 791,95 kr och den privata artikeln 229,00 kr", () => {
    expect(bidragForKostnad(bauhaus, PROJEKT_MALA_SOVRUM)).toBe(79_195);
    const privat = bauhaus.rader
      .filter((r) => r.fordelningar.some((f) => f.privat))
      .reduce((s, r) => s + r.belopp, 0);
    expect(privat).toBe(22_900);
  });

  it("projektet 'Mala sovrum' ar en reparation som annu inte fatt sina fyra svar", () => {
    const p = SEED_PROJEKT.find((x) => x.id === PROJEKT_MALA_SOVRUM)!;
    expect(p.kategori).toBe("reparation");
    expect(p.slitet_vid_tilltrade).toBeNull();
    expect(p.motivering).toBeNull();
  });

  it("arssumman 2026 hamnar under troskeln och ger 0 kr avdragsgillt", () => {
    const troskel = slaUppRegelparameter(
      SEED_REGELPARAMETRAR,
      "troskelbelopp",
      "2026-12-31",
    );
    const arssumma = arssummaForBostad(
      { kostnader: domanKostnader, projekt: domanProjekt },
      2026,
    );
    expect(arssumma).toBe(79_195 + 149_500 + 69_000); // 297 695 oren = 2 976,95 kr
    expect(arssumma).toBeLessThan(troskel);
    expect(avdragsgrundandeArsbelopp(arssumma, troskel)).toBe(0);
  });
});
