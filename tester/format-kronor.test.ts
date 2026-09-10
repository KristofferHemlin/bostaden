import { describe, expect, it } from "vitest";
import {
  formateraKronor,
  formateraKronorEllerStreck,
  oreFranKronor,
} from "@/lib/format";

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

describe("formateraKronor visar oren bara nar de ar skilda fran noll", () => {
  // docs/design.md, Typografi: "7 925,90 kr" behaller sina oren, men troskeln
  // skrivs "5 000 kr" och inte "5 000,00 kr". Tva nollor efter ett jamnt belopp
  // ar brus. Galler all utskrift av belopp, inte bara troskeln.

  it("jamnt kronbelopp skrivs helt utan decimaler", () => {
    expect(formateraKronor(500_000)).toMatch(/^5.000.kr$/);
    expect(formateraKronor(500_000)).not.toContain(",");
  });

  it("noll kronor skrivs utan oren", () => {
    expect(formateraKronor(0)).toMatch(/^0.kr$/);
  });

  it("belopp med oren behaller bada decimalerna", () => {
    expect(formateraKronor(792_590)).toMatch(/^7.925,90.kr$/);
  });

  it("oren som slutar pa noll raknas anda som skilda fran noll", () => {
    expect(formateraKronor(1_050)).toMatch(/^10,50.kr$/);
  });

  it("ensiffrig oresdel fylls ut till tva decimaler", () => {
    expect(formateraKronor(1_005)).toMatch(/^10,05.kr$/);
  });

  it("formateraKronorEllerStreck arver regeln", () => {
    expect(formateraKronorEllerStreck(22_900)).toMatch(/^229.kr$/);
    expect(formateraKronorEllerStreck(null)).toBe("–");
  });
});
