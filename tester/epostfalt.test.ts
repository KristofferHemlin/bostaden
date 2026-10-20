import { describe, expect, it } from "vitest";
import { epostfel } from "@/lib/epostfalt";
import { glomtLosenordFel, inloggningensFel } from "@/lib/inloggningsfalt";
import { kontostegetsFel } from "@/app/registrera/validering";

// docs/design.md, "När ett formulär vägrar": samma produkt ger ett svar pa
// samma fraga. Tomt och ogiltigt ar tva olika fel med var sin mening, overallt.
//
// Uppmatt i produktionen 2026-10-19: ett tomt e-postfalt hette "Fyll i din
// e-postadress." pa inloggningen och "Fyll i en giltig e-postadress." i
// registreringen – det senare osant, eftersom ingenting var ifyllt.

const TOMT = "Fyll i din e-postadress.";
const OGILTIGT = "Fyll i en giltig e-postadress, t.ex. du@exempel.se.";

function fd(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
}

describe("e-postregeln", () => {
  it("tomt ar tomt, inte ogiltigt", () => {
    expect(epostfel("")).toBe(TOMT);
  });

  it("en adress som saknar punkten ar ogiltig", () => {
    expect(epostfel("kristoffer@gmailcom")).toBe(OGILTIGT);
    expect(epostfel("abc")).toBe(OGILTIGT);
  });

  it("en giltig adress gar igenom", () => {
    expect(epostfel("kristoffer@gmail.com")).toBeNull();
  });
});

// Varje formular som fragar efter en adress ger samma tva meningar.
const formular: [string, (epost: string) => string | undefined][] = [
  ["inloggningen", (epost) => inloggningensFel(fd({ epost, losenord: "x" }))?.fel],
  ["glömt lösenordet", (epost) => glomtLosenordFel(fd({ epost }))?.fel],
  [
    "registreringen",
    (epost) => kontostegetsFel(fd({ epost, losenord: "hemligt12345" }))?.fel,
  ],
];

describe.each(formular)("%s", (_namn, prova) => {
  it("ett tomt falt far meningen om att fylla i – aldrig den om giltig adress", () => {
    expect(prova("")).toBe(TOMT);
    expect(prova("   ")).toBe(TOMT);
  });

  it("ett ifyllt men ogiltigt falt far meningen om giltig adress", () => {
    expect(prova("kristoffer@gmailcom")).toBe(OGILTIGT);
  });
});
