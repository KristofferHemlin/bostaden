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

// CLAUDE.md, "Agarandel": andelen tillampas oavsett hur manga som delar
// bostaden. Villkoret ar inte antalet medlemmar utan om andelarna ar
// trovardiga – summan av medlemmarnas andelar ar hogst 100 %. Ar den storre
// gar ingen andel att lita pa, och underlaget galler hela bostaden (null).
describe("andelForUnderlag", () => {
  it("en ensam agare behaller sin andel", () => {
    expect(andelForUnderlag({ egenAndel: 50, medlemsandelar: [50] })).toEqual({ slag: "andel", andel: 50 });
    expect(andelForUnderlag({ egenAndel: 100, medlemsandelar: [100] })).toEqual({ slag: "andel", andel: 100 });
  });

  it("i en delad bostad dar andelarna gar ihop galler lasarens andel", () => {
    expect(andelForUnderlag({ egenAndel: 50, medlemsandelar: [50, 50] })).toEqual({ slag: "andel", andel: 50 });
    expect(andelForUnderlag({ egenAndel: 70, medlemsandelar: [70, 30] })).toEqual({ slag: "andel", andel: 70 });
  });

  it("en summa under 100 % ar inget hinder – tva syskon av tre ser var sin fjardedel", () => {
    expect(andelForUnderlag({ egenAndel: 25, medlemsandelar: [25, 25] })).toEqual({ slag: "andel", andel: 25 });
  });

  it("en summa over 100 % ger ingen andel – aldrig den egna", () => {
    expect(andelForUnderlag({ egenAndel: 100, medlemsandelar: [100, 100] })).toEqual({ slag: "gar_inte_ihop" });
    expect(andelForUnderlag({ egenAndel: 50, medlemsandelar: [50, 100] })).toEqual({ slag: "gar_inte_ihop" });
  });

  // CLAUDE.md, "Andelen ar null tills den besvarats": null ar varken 0 eller
  // 100, och en obesvarad andel ar ett annat lage an att andelarna inte gar ihop.
  it("en obesvarad egen andel ar inte_angiven, aldrig 100", () => {
    expect(andelForUnderlag({ egenAndel: null, medlemsandelar: [null] })).toEqual({ slag: "inte_angiven" });
    expect(andelForUnderlag({ egenAndel: null, medlemsandelar: [null, 50] })).toEqual({ slag: "inte_angiven" });
  });

  it("en annans obesvarade andel hoppas over i summan – den ar inte 100", () => {
    expect(andelForUnderlag({ egenAndel: 50, medlemsandelar: [50, null] })).toEqual({ slag: "andel", andel: 50 });
    expect(andelForUnderlag({ egenAndel: 100, medlemsandelar: [100, null] })).toEqual({ slag: "andel", andel: 100 });
  });

  it("de angivna over 100 % gar inte ihop, aven nar lasaren inte svarat", () => {
    expect(andelForUnderlag({ egenAndel: null, medlemsandelar: [null, 60, 50] })).toEqual({ slag: "gar_inte_ihop" });
  });
});
