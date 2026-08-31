import { describe, expect, it } from "vitest";
import { andelFranProcent } from "@/lib/format";

// Steg 7: forslitningens kvarvarande andel matas in i procent i
// forsaljningsflodet men lagras som 0..1 (schemat: kvarvarande_andel
// Decimal(5,4)). Tom strang = anvandaren har inte satt andelen an och far inte
// blockera – da null, aldrig 0.

describe("andelFranProcent", () => {
  it("tolkar heltalsprocent", () => {
    expect(andelFranProcent("80")).toBe(0.8);
  });

  it("tolkar procent med enhetstecken och mellanslag", () => {
    expect(andelFranProcent(" 80 % ")).toBe(0.8);
  });

  it("tolkar decimalprocent med komma", () => {
    expect(andelFranProcent("33,33")).toBeCloseTo(0.3333, 6);
  });

  it("0 procent ar giltigt – helt forbrukat av slitage", () => {
    expect(andelFranProcent("0")).toBe(0);
  });

  it("100 procent ger 1", () => {
    expect(andelFranProcent("100")).toBe(1);
  });

  it("tom strang ger null, inte 0 – andelen ar inte satt an", () => {
    expect(andelFranProcent("")).toBeNull();
    expect(andelFranProcent("   ")).toBeNull();
  });

  it("over 100 procent avvisas", () => {
    expect(andelFranProcent("101")).toBeNull();
  });

  it("negativ procent avvisas", () => {
    expect(andelFranProcent("-5")).toBeNull();
  });

  it("skrap avvisas", () => {
    expect(andelFranProcent("typ 80")).toBeNull();
    expect(andelFranProcent("abc")).toBeNull();
  });
});
