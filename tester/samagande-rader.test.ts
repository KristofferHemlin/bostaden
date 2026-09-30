import { describe, expect, it } from "vitest";
import { andelForUnderlag, arDeladBostad, upphovsrad } from "@/lib/samagande";

// docs/design.md, "Samagande – medlemskapet". Raderna "Tillagt av" och
// "Besvarat av" visas bara nar bostaden har fler an en medlem – ensam ar de
// brus – och uteblir nar uppgiften saknas i stallet for att gissa.

const JAG = "11111111-1111-1111-1111-111111111111";
const ANNAN = "22222222-2222-2222-2222-222222222222";

describe("upphovsrad", () => {
  it("sager 'Tillagt av dig' for en egen post i en delad bostad", () => {
    expect(upphovsrad("Tillagt", { id: JAG, epost: "jag@exempel.se" }, JAG, 2)).toBe(
      "Tillagt av dig",
    );
  });

  it("sager den andras e-postadress for hennes post", () => {
    expect(
      upphovsrad("Tillagt", { id: ANNAN, epost: "annan@exempel.se" }, JAG, 2),
    ).toBe("Tillagt av annan@exempel.se");
  });

  it("anvander samma form for klassificeringssvaren", () => {
    expect(upphovsrad("Besvarat", { id: JAG, epost: "jag@exempel.se" }, JAG, 2)).toBe(
      "Besvarat av dig",
    );
    expect(
      upphovsrad("Besvarat", { id: ANNAN, epost: "annan@exempel.se" }, JAG, 3),
    ).toBe("Besvarat av annan@exempel.se");
  });

  it("uteblir for en ensam agare, aven nar uppgiften finns", () => {
    expect(upphovsrad("Tillagt", { id: JAG, epost: "jag@exempel.se" }, JAG, 1)).toBeNull();
    expect(upphovsrad("Besvarat", { id: JAG, epost: "jag@exempel.se" }, JAG, 1)).toBeNull();
  });

  it("uteblir for ett aldre kvitto utan uppgift – gissar inte", () => {
    expect(upphovsrad("Tillagt", null, JAG, 2)).toBeNull();
    expect(upphovsrad("Besvarat", null, JAG, 2)).toBeNull();
  });
});

describe("arDeladBostad – styr exportvyns rad om hela bostaden", () => {
  it("ar falsk for en ensam agare", () => {
    expect(arDeladBostad(1)).toBe(false);
  });

  it("ar sann sa snart bostaden har fler an en medlem", () => {
    expect(arDeladBostad(2)).toBe(true);
    expect(arDeladBostad(3)).toBe(true);
  });
});

// docs/design.md, "Samagande – medlemskapet": i en delad bostad ar andelarna
// inte satta forran de fragas vid forsaljningen. Underlaget galler da hela
// bostaden, och en gammal andel fran tiden som ensam agare far inte halvera
// talen under en rubrik som sager hela.
describe("andelForUnderlag", () => {
  it("en ensam agare behaller sin andel", () => {
    expect(andelForUnderlag(50, 1)).toBe(50);
    expect(andelForUnderlag(100, 1)).toBe(100);
  });

  it("i en delad bostad finns ingen personlig andel – null, inte den gamla", () => {
    expect(andelForUnderlag(50, 2)).toBeNull();
    expect(andelForUnderlag(100, 2)).toBeNull();
  });
});
