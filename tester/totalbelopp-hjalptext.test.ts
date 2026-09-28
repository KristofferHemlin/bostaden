import { describe, expect, it } from "vitest";
import { totalbeloppHjalptext } from "@/lib/format";

// Hjalptexten under Totalbelopp (docs/design.md, "ROT-avdrag"). Pa en faktura
// dar ROT redan ar avraknat ar slutsumman inte totalbeloppet – den som skriver
// in den far ett underlag som ar for lagt med hela ROT-beloppet. Texten byter
// darfor lydelse nar ROT-faltet har ett belopp, i inmatningen och i
// kvittots andringslage.

const KVITTO = "Hela kvittosumman, t.ex. 1 020,95.";

describe("totalbeloppHjalptext", () => {
  it("tomt ROT-falt ger kvittotexten", () => {
    expect(totalbeloppHjalptext("")).toBe(KVITTO);
    expect(totalbeloppHjalptext("   ")).toBe(KVITTO);
  });

  it("ett ROT-belopp ger texten om summan fore avdraget", () => {
    const text = totalbeloppHjalptext("11 587,50");
    expect(text).not.toBe(KVITTO);
    expect(text).toMatch(/innan ROT drogs av/);
    expect(text).toMatch(/inklusive moms/);
  });

  it("noll i ROT-faltet ar inget belopp", () => {
    expect(totalbeloppHjalptext("0")).toBe(KVITTO);
    expect(totalbeloppHjalptext("0,00")).toBe(KVITTO);
  });

  it("text som inte ar ett belopp ger kvittotexten", () => {
    expect(totalbeloppHjalptext("vet ej")).toBe(KVITTO);
  });
});
