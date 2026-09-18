import { describe, expect, it } from "vitest";
import { datumfel, datumIso, sistaDagenIManaden } from "@/lib/datum";

// Datum matas in som tre falt – ar, manad, dag – i stallet for
// <input type="date"> (den infodda valjaren tvingar pa Android fram manadsvis
// bladdring bakat). Har testas bara den rena valideringslogiken: kalenderns
// existens och den valfria framtidsspärren, provade lopande medan man skriver
// – inte bara vid submit. Faltkomponentens fokushantering testas dar den ar
// synlig.

const IDAG = "2026-09-14";
const FRAMTIDSFEL = "Tillträdesdatum kan inte ligga i framtiden.";

describe("sistaDagenIManaden", () => {
  it("april har 30 dagar", () => {
    expect(sistaDagenIManaden(2026, 4)).toBe(30);
  });

  it("februari har 29 dagar ett skottar", () => {
    expect(sistaDagenIManaden(2024, 2)).toBe(29);
  });

  it("februari har 28 dagar ett vanligt ar", () => {
    expect(sistaDagenIManaden(2023, 2)).toBe(28);
  });
});

describe("datumfel", () => {
  it("ger inget fel medan falten fortfarande fylls i", () => {
    expect(datumfel("199", "", "")).toBeNull();
    expect(datumfel("1997", "0", "")).toBeNull();
  });

  it("underkanner en omojlig manad direkt, aven utan dag ifylld", () => {
    expect(datumfel("1997", "13", "")).toBe("Ogiltig månad.");
    expect(datumfel("1997", "00", "")).toBe("Ogiltig månad.");
  });

  it("underkanner en omojlig dag direkt, aven utan manad eller ar ifyllda", () => {
    expect(datumfel("", "", "32")).toBe("Ogiltig dag.");
    expect(datumfel("", "", "00")).toBe("Ogiltig dag.");
  });

  it("underkanner den 31 april forst nar alla tre falt ar ifyllda", () => {
    expect(datumfel("2020", "04", "3")).toBeNull();
    expect(datumfel("2020", "04", "31")).toBe("Ogiltig dag.");
  });

  it("den 29 februari ar giltig ett skottar men inte annars", () => {
    expect(datumfel("2024", "02", "29")).toBeNull();
    expect(datumfel("2023", "02", "29")).toBe("Ogiltig dag.");
  });

  it("tillater framtida datum nar ingen framtidsspärr ar satt (kvittodatum, betaldatum)", () => {
    expect(datumfel("2099", "01", "01", { idagIso: IDAG })).toBeNull();
  });

  it("avvisar ett datum i framtiden nar en framtidsspärr ar satt (tilltradesdatum)", () => {
    expect(
      datumfel("2026", "09", "15", {
        idagIso: IDAG,
        framtidsFelmeddelande: FRAMTIDSFEL,
      }),
    ).toBe(FRAMTIDSFEL);
  });

  it("dagens datum ar inte framtid", () => {
    expect(
      datumfel("2026", "09", "14", {
        idagIso: IDAG,
        framtidsFelmeddelande: FRAMTIDSFEL,
      }),
    ).toBeNull();
  });

  it("ett giltigt datum i det forflutna ger inget fel, framtidsspärr eller ej", () => {
    expect(datumfel("1997", "06", "23")).toBeNull();
    expect(
      datumfel("1997", "06", "23", {
        idagIso: IDAG,
        framtidsFelmeddelande: FRAMTIDSFEL,
      }),
    ).toBeNull();
  });
});

describe("datumIso", () => {
  it("ger ISO-strangen for ett fullstandigt giltigt datum", () => {
    expect(datumIso("1997", "06", "23")).toBe("1997-06-23");
  });

  it("ger tom strang nar falten inte ar fullstandiga – sa tolkas tre tomma falt som inget varde", () => {
    expect(datumIso("", "", "")).toBe("");
    expect(datumIso("1997", "6", "23")).toBe("");
  });

  it("ger tom strang for ett omojligt datum", () => {
    expect(datumIso("2020", "04", "31")).toBe("");
  });

  it("ger tom strang for ett datum i framtiden bara nar en framtidsspärr ar satt", () => {
    expect(datumIso("2026", "09", "15", { idagIso: IDAG })).toBe(
      "2026-09-15",
    );
    expect(
      datumIso("2026", "09", "15", {
        idagIso: IDAG,
        framtidsFelmeddelande: FRAMTIDSFEL,
      }),
    ).toBe("");
  });
});
