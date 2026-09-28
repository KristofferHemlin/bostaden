import { describe, expect, it } from "vitest";
import { arTomtUtkast, INTE_TOMT_UTKAST } from "@/lib/tomt-utkast";

// Ett tomt utkast finns inte (docs/design.md, "Kvittolistan"). Ett utkast utan
// bade bilaga och ifyllda falt raknas inte i "N kvitton att klassificera",
// visas inte i kvittolistan och inte bland de sex senaste. Har utkastet ett
// paborjat varde ligger det kvar och syns. Uppmatt 2026-09-28: tre sadana
// rader efter nagra avbrutna uppladdningar, tva helt tomma, grupperade under
// "Utan datum, 0 kr".

const tomt = {
  totalbelopp: null,
  leverantor: null,
  dokumentdatum: null,
  betaldatum: null,
  anteckning: null,
  rot_utnyttjat: null,
  forsakringsersattning: null,
  antalBilagor: 0,
};

describe("arTomtUtkast", () => {
  it("utkast utan bilaga och utan falt ar tomt", () => {
    expect(arTomtUtkast(tomt)).toBe(true);
  });

  it("en tom eller blank anteckning ar inget paborjat varde", () => {
    expect(arTomtUtkast({ ...tomt, anteckning: "" })).toBe(true);
    expect(arTomtUtkast({ ...tomt, anteckning: "   " })).toBe(true);
  });

  it("utkast med en bilaga ligger kvar", () => {
    expect(arTomtUtkast({ ...tomt, antalBilagor: 1 })).toBe(false);
  });

  it("utkast med ett ifyllt falt ligger kvar", () => {
    expect(arTomtUtkast({ ...tomt, anteckning: "Kakel till badrummet" })).toBe(false);
    expect(arTomtUtkast({ ...tomt, leverantor: "Bauhaus" })).toBe(false);
    expect(arTomtUtkast({ ...tomt, dokumentdatum: new Date("2026-08-22") })).toBe(false);
    expect(arTomtUtkast({ ...tomt, betaldatum: new Date("2026-08-22") })).toBe(false);
    expect(arTomtUtkast({ ...tomt, rot_utnyttjat: 900_000 })).toBe(false);
    expect(arTomtUtkast({ ...tomt, forsakringsersattning: 100 })).toBe(false);
  });

  it("ett sparat kvitto ar aldrig ett tomt utkast, aven utan bilaga", () => {
    expect(arTomtUtkast({ ...tomt, totalbelopp: 102_095 })).toBe(false);
  });
});

describe("INTE_TOMT_UTKAST (databasvillkoret) speglar samma regel", () => {
  it("utesluter bara rader dar ALLA villkor for ett tomt utkast galler", () => {
    expect(INTE_TOMT_UTKAST).toEqual({
      NOT: {
        totalbelopp: null,
        leverantor: null,
        dokumentdatum: null,
        betaldatum: null,
        rot_utnyttjat: null,
        forsakringsersattning: null,
        bilagor: { none: {} },
        OR: [{ anteckning: null }, { anteckning: { equals: "" } }],
      },
    });
  });
});
