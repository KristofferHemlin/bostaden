import { describe, expect, it } from "vitest";
import { agarandelFel, agarandelFranText } from "@/lib/agarandel";

// Agarandelen multiplicerar hela underlaget: skrivs 1000 i stallet for 100
// blir avdraget tio ganger for stort utan att nagot ser fel ut (docs/
// produktspec.md 4.7, CLAUDE.md). Dessa tester galler den delade valideringen
// – bade faltkomponenten (agarandel-falt.tsx) och servern (installningar/
// actions.ts) anropar samma funktioner.

describe("agarandelFel", () => {
  it("tillater ett tomt falt – det betyder hela bostaden", () => {
    expect(agarandelFel("")).toBeNull();
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
  it("tolkar ett tomt falt som hela bostaden, 100", () => {
    expect(agarandelFranText("")).toBe(100);
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
