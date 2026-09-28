import { describe, expect, it } from "vitest";
import { formateraKronor, rotRadILaslage } from "@/lib/format";

// ROT-raden i kvittots lasläge (docs/design.md, "ROT-avdrag"): ett kvitto pa
// 50 000 kr med 10 000 i ROT ger 40 000 i underlaget, och utan raden star de
// tva talen pa olika skarmar. Raden syns bara nar beloppet ar storre an noll –
// pa det stora flertalet kvitton vore den brus.

describe("rotRadILaslage", () => {
  it("ett ROT-belopp over noll visas som kronor, som de andra uppgifterna", () => {
    expect(rotRadILaslage(1_000_000)).toBe(formateraKronor(1_000_000));
  });

  it("tomt ROT-falt ger ingen rad", () => {
    expect(rotRadILaslage(null)).toBe(null);
  });

  it("noll ger ingen rad", () => {
    expect(rotRadILaslage(0)).toBe(null);
  });
});
