import { describe, expect, it } from "vitest";
import { formateraKronor, oreFranKronor } from "@/lib/format";

// Bauhaus-kvittot ar valt for att det har belopp med bade tusentalsavgransare och
// decimaler (produktspec 11). Inmatningsfaltet maste klara alla varianter av hur
// en anvandare skriver "1 020,95".

describe("oreFranKronor tolkar kronsträngar till heltal oren", () => {
  it("svensk form med hart mellanslag och komma", () => {
    expect(oreFranKronor("1 020,95")).toBe(102_095);
  });

  it("vanligt mellanslag som tusentalsavgransare", () => {
    expect(oreFranKronor("1 020,95")).toBe(102_095);
  });

  it("punkt som decimaltecken", () => {
    expect(oreFranKronor("1020.95")).toBe(102_095);
  });

  it("heltal utan decimaler", () => {
    expect(oreFranKronor("1495")).toBe(149_500);
  });

  it("en decimal fylls ut till tva", () => {
    expect(oreFranKronor("10,5")).toBe(1_050);
  });

  it("punkt som tusentalsavgransare, komma som decimal", () => {
    expect(oreFranKronor("1.020,95")).toBe(102_095);
  });

  it("tomt eller skrap ger null, aldrig NaN", () => {
    expect(oreFranKronor("")).toBeNull();
    expect(oreFranKronor("   ")).toBeNull();
    expect(oreFranKronor("abc")).toBeNull();
    expect(oreFranKronor("-5")).toBeNull();
  });

  it("noll ar ett giltigt tal men avvisas av inmatningen pa annat hall", () => {
    expect(oreFranKronor("0")).toBe(0);
  });

  it("tur och retur genom formateraKronor bevarar beloppet", () => {
    const oren = oreFranKronor("1 020,95")!;
    expect(oren).toBe(102_095);
    // Bade grupperingstecknet och mellanslaget fore "kr" ar mellanslag vars
    // exakta kodpunkt beror pa ICU-version resp. ar ett hart mellanslag.
    expect(formateraKronor(oren)).toMatch(/^1.020,95.kr$/);
  });
});
