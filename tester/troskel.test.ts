import { describe, expect, it } from "vitest";
import { avdragsgrundandeArsbelopp, troskelUppnadd } from "@/doman/berakningar";

const TROSKEL = 500_000; // 5 000 kr i oren

describe("5 000-kronorstroskeln per kalenderar", () => {
  it("4 210 kr under ett kalenderar ger 0 kr avdragsgillt, inte 4 210", () => {
    expect(avdragsgrundandeArsbelopp(421_000, TROSKEL)).toBe(0);
  });

  it("5 200 kr under ett kalenderar ger 5 200 kr, inte 200", () => {
    expect(avdragsgrundandeArsbelopp(520_000, TROSKEL)).toBe(520_000);
  });

  it("understiger aret troskeln faller hela arets utgifter bort", () => {
    expect(troskelUppnadd(499_999, TROSKEL)).toBe(false);
    expect(avdragsgrundandeArsbelopp(499_999, TROSKEL)).toBe(0);
  });

  it("exakt 5 000 kr nar troskeln", () => {
    expect(troskelUppnadd(500_000, TROSKEL)).toBe(true);
    expect(avdragsgrundandeArsbelopp(500_000, TROSKEL)).toBe(500_000);
  });
});
