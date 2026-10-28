import { describe, expect, it } from "vitest";
import { ANDEL_SAKNAS, agarandelFel, agarandelFranText } from "@/lib/agarandel";

// Agarandelen multiplicerar hela underlaget: skrivs 1000 i stallet for 100
// blir avdraget tio ganger for stort utan att nagot ser fel ut (docs/
// produktspec.md 4.7, CLAUDE.md). Dessa tester galler den delade valideringen
// – bade faltkomponenten (agarandel-falt.tsx) och servern (installningar/
// actions.ts) anropar samma funktioner.
//
// Ett tomt falt ar ett fel sedan 2026-10-28 (CLAUDE.md, "Andelen ar null
// tills den besvarats"). Det betydde hela bostaden till dess.

describe("agarandelFel", () => {
  it("avvisar ett tomt falt – det betyder inte hela bostaden", () => {
    expect(agarandelFel("")).toBe(ANDEL_SAKNAS);
    expect(agarandelFel("   ")).toBe(ANDEL_SAKNAS);
  });

  it("avvisar noll", () => {
    expect(agarandelFel("0")).not.toBeNull();
  });

  it("tillater exakt 100", () => {
    expect(agarandelFel("100")).toBeNull();
  });

  it("avvisar varden over 100, t.ex. det klassiska skrivfelet 1000", () => {
    expect(agarandelFel("1000")).not.toBeNull();
    expect(agarandelFel("101")).not.toBeNull();
  });

  it("tillater decimaler, med bade komma och punkt", () => {
    expect(agarandelFel("33,33")).toBeNull();
    expect(agarandelFel("33.33")).toBeNull();
  });

  it("avvisar text som inte gar att tolka som ett tal", () => {
    expect(agarandelFel("abc")).not.toBeNull();
  });
});

describe("agarandelFranText", () => {
  it("ger inget tal for ett tomt falt – aldrig 100", () => {
    expect(agarandelFranText("")).toBeUndefined();
  });

  it("tolkar ett giltigt varde", () => {
    expect(agarandelFranText("50")).toBe(50);
    expect(agarandelFranText("33,33")).toBeCloseTo(33.33);
  });

  it("underkanner noll", () => {
    expect(agarandelFranText("0")).toBeUndefined();
  });

  it("underkanner varden over 100", () => {
    expect(agarandelFranText("1000")).toBeUndefined();
  });
});
