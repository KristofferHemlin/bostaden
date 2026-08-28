import { describe, expect, it } from "vitest";
import { arssummaForBostad, kalenderAr } from "@/doman/berakningar";
import { kostnad, projekt } from "./_hjalp";

describe("aret bestams av betaldatum, aldrig av fakturadatum", () => {
  it("faktura daterad 2026-12-20, betald 2027-01-08, tillhor kalenderar 2027", () => {
    expect(kalenderAr("2027-01-08")).toBe(2027);
  });

  it("kostnaden raknas in 2027, inte 2026", () => {
    const k = kostnad({ betaldatum: "2027-01-08" });
    const p = [projekt({ id: "p1" })];
    expect(arssummaForBostad({ kostnader: [k], projekt: p }, 2026)).toBe(0);
    expect(arssummaForBostad({ kostnader: [k], projekt: p }, 2027)).toBe(100_000);
  });
});
