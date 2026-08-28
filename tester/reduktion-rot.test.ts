import { describe, expect, it } from "vitest";
import { bidragForKostnad, reduktionsfaktor } from "@/doman/berakningar";
import { kostnad } from "./_hjalp";

describe("ROT och forsakringsersattning dras bort fore summering", () => {
  it("ROT-reducerad del av arbetskostnad ar borta ur bidraget", () => {
    // 10 000 kr, varav 4 000 kr arbetskostnad med 3 000 kr utnyttjad ROT.
    // Berakningen bryr sig bara om totalbelopp och rot_utnyttjat.
    const k = kostnad({ totalbelopp: 1_000_000, rot_utnyttjat: 300_000 });
    // avdragsgrundande = 1 000 000 - 300 000 = 700 000 -> faktor 0,7
    expect(reduktionsfaktor(k)).toBeCloseTo(0.7, 10);
    expect(bidragForKostnad(k, "p1")).toBe(700_000);
  });

  it("10 000 kr med 3 000 kr ROT, rad fordelad 60 %, bidrar med 4 200 kr", () => {
    const k = kostnad({
      totalbelopp: 1_000_000,
      rot_utnyttjat: 300_000,
      andel: 0.6,
    });
    expect(bidragForKostnad(k, "p1")).toBe(420_000);
  });

  it("forsakringsersattning dras bort pa samma satt som ROT", () => {
    const k = kostnad({ totalbelopp: 1_000_000, forsakringsersattning: 200_000 });
    expect(bidragForKostnad(k, "p1")).toBe(800_000);
  });
});
