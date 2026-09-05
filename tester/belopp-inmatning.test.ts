import { describe, expect, it } from "vitest";
import { formateraBeloppInmatning, oreFranKronor } from "@/lib/format";

// docs/design.md, Typografi: "Det gäller även medan man skriver." Ett beloppsfält
// formaterar löpande – 4000000 blir 4 000 000 under inmatningen, med hårt
// mellanslag som tusentalsavgränsare och komma som decimaltecken.
// formateraBeloppInmatning ar tolkningen: den tar det anvandaren skriver eller
// klistrar in och ger tillbaka den svenska visningsformen. Sjalva markorlogiken
// (att markoren stannar, att radering bakat genom avgransarna fungerar) ligger i
// komponenten och testas dar den ar synlig; har testas bara stranga -> strang.

const HÅRT = " ";

describe("formateraBeloppInmatning: gruppering av heltal", () => {
  it("4000000 blir 4 000 000", () => {
    expect(formateraBeloppInmatning("4000000")).toBe(`4${HÅRT}000${HÅRT}000`);
  });

  it("redan grupperat med hårt mellanslag lämnas oförändrat", () => {
    expect(formateraBeloppInmatning(`4${HÅRT}000${HÅRT}000`)).toBe(
      `4${HÅRT}000${HÅRT}000`,
    );
  });

  it("grupperat med vanligt mellanslag normaliseras till hårt", () => {
    expect(formateraBeloppInmatning("4 000 000")).toBe(
      `4${HÅRT}000${HÅRT}000`,
    );
  });

  it("tre siffror grupperas inte", () => {
    expect(formateraBeloppInmatning("999")).toBe("999");
  });

  it("fyra siffror får en avgränsare", () => {
    expect(formateraBeloppInmatning("1020")).toBe(`1${HÅRT}020`);
  });

  it("kort tal utan avgränsare passerar rakt igenom", () => {
    expect(formateraBeloppInmatning("72")).toBe("72");
  });
});

describe("formateraBeloppInmatning: inklistrade belopp", () => {
  it("punkter tolkas som tusentalsavgränsare – 4.000.000 blir 4 000 000", () => {
    expect(formateraBeloppInmatning("4.000.000")).toBe(
      `4${HÅRT}000${HÅRT}000`,
    );
  });

  it("en ensam punkt före tre siffror är också tusental – 4.000 blir 4 000", () => {
    expect(formateraBeloppInmatning("4.000")).toBe(`4${HÅRT}000`);
  });

  it("punkt som decimaltecken i utländskt format – 1020.95 blir 1 020,95", () => {
    expect(formateraBeloppInmatning("1020.95")).toBe(`1${HÅRT}020,95`);
  });

  it("punkt-tusental och kommadecimal tillsammans – 1.020,95 blir 1 020,95", () => {
    expect(formateraBeloppInmatning("1.020,95")).toBe(`1${HÅRT}020,95`);
  });

  it("belopp med kr och blanksteg – '3 250 000 kr' blir 3 250 000", () => {
    expect(formateraBeloppInmatning("3 250 000 kr")).toBe(
      `3${HÅRT}250${HÅRT}000`,
    );
  });

  it("skräptecken utan siffror ger tom sträng", () => {
    expect(formateraBeloppInmatning("kr")).toBe("");
    expect(formateraBeloppInmatning("")).toBe("");
  });
});

describe("formateraBeloppInmatning: decimalkomma tillsammans med tusentalsavgränsare", () => {
  it("1020,95 blir 1 020,95", () => {
    expect(formateraBeloppInmatning("1020,95")).toBe(`1${HÅRT}020,95`);
  });

  it("1234567,5 blir 1 234 567,5", () => {
    expect(formateraBeloppInmatning("1234567,5")).toBe(
      `1${HÅRT}234${HÅRT}567,5`,
    );
  });

  it("mer än två decimaler kortas till öre", () => {
    expect(formateraBeloppInmatning("1020,958")).toBe(`1${HÅRT}020,95`);
  });

  it("avslutande komma lämnas kvar medan man skriver", () => {
    expect(formateraBeloppInmatning("1020,")).toBe(`1${HÅRT}020,`);
  });

  it("komma först ger 0, så nästa tecken blir en decimal", () => {
    expect(formateraBeloppInmatning(",")).toBe("0,");
  });

  it("avslutande punkt medan man skriver blir ett decimalkomma", () => {
    expect(formateraBeloppInmatning("5.")).toBe("5,");
  });
});

describe("formateraBeloppInmatning: nollor", () => {
  it("en ensam nolla behålls", () => {
    expect(formateraBeloppInmatning("0")).toBe("0");
  });

  it("inledande nollor tas bort när en riktig siffra följer", () => {
    expect(formateraBeloppInmatning("007")).toBe("7");
    expect(formateraBeloppInmatning("04")).toBe("4");
  });

  it("noll komma fem behålls", () => {
    expect(formateraBeloppInmatning("0,5")).toBe("0,5");
    expect(formateraBeloppInmatning("00,5")).toBe("0,5");
  });

  it(".5 blir 0,5", () => {
    expect(formateraBeloppInmatning(".5")).toBe("0,5");
  });
});

describe("formateraBeloppInmatning: idempotent och serverkompatibel", () => {
  it("att formatera en redan formaterad sträng ändrar inget", () => {
    for (const s of ["4000000", "1020,95", "1020,", "0,5", "999", ",", "5."]) {
      const en = formateraBeloppInmatning(s);
      expect(formateraBeloppInmatning(en)).toBe(en);
    }
  });

  it("oreFranKronor läser den formaterade strängen rätt", () => {
    expect(oreFranKronor(formateraBeloppInmatning("4000000"))).toBe(400_000_000);
    expect(oreFranKronor(formateraBeloppInmatning("1020,95"))).toBe(102_095);
    expect(oreFranKronor(formateraBeloppInmatning("1020.95"))).toBe(102_095);
    expect(oreFranKronor(formateraBeloppInmatning("4.000.000"))).toBe(
      400_000_000,
    );
    expect(oreFranKronor(formateraBeloppInmatning("3 250 000 kr"))).toBe(
      325_000_000,
    );
  });
});
