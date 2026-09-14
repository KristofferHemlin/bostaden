import { describe, expect, it } from "vitest";
import {
  sistaDagenIManaden,
  tilltradesdatumfel,
  tilltradesdatumIso,
} from "@/lib/tilltradesdatum";

// Tilltradesdatumet matas in som tre falt – ar, manad, dag – i stallet for
// <input type="date"> (den infodda valjaren tvingar pa Android fram manadsvis
// bladdring bakat). Har testas bara den rena valideringslogiken: kalenderns
// existens och framtidsspärren, provade lopande medan man skriver – inte bara
// vid submit. Faltkomponentens fokushantering testas dar den ar synlig.

const IDAG = "2026-09-14";

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

describe("tilltradesdatumfel", () => {
  it("ger inget fel medan falten fortfarande fylls i", () => {
    expect(tilltradesdatumfel("199", "", "", IDAG)).toBeNull();
    expect(tilltradesdatumfel("1997", "0", "", IDAG)).toBeNull();
  });

  it("underkanner en omojlig manad direkt, aven utan dag ifylld", () => {
    expect(tilltradesdatumfel("1997", "13", "", IDAG)).toBe("Ogiltig månad.");
    expect(tilltradesdatumfel("1997", "00", "", IDAG)).toBe("Ogiltig månad.");
  });

  it("underkanner en omojlig dag direkt, aven utan manad eller ar ifyllda", () => {
    expect(tilltradesdatumfel("", "", "32", IDAG)).toBe("Ogiltig dag.");
    expect(tilltradesdatumfel("", "", "00", IDAG)).toBe("Ogiltig dag.");
  });

  it("underkanner den 31 april forst nar alla tre falt ar ifyllda", () => {
    expect(tilltradesdatumfel("2020", "04", "3", IDAG)).toBeNull();
    expect(tilltradesdatumfel("2020", "04", "31", IDAG)).toBe("Ogiltig dag.");
  });

  it("den 29 februari ar giltig ett skottar men inte annars", () => {
    expect(tilltradesdatumfel("2024", "02", "29", IDAG)).toBeNull();
    expect(tilltradesdatumfel("2023", "02", "29", IDAG)).toBe("Ogiltig dag.");
  });

  it("avvisar ett datum i framtiden", () => {
    expect(tilltradesdatumfel("2026", "09", "15", IDAG)).toBe(
      "Tillträdesdatum kan inte ligga i framtiden.",
    );
  });

  it("dagens datum ar inte framtid", () => {
    expect(tilltradesdatumfel("2026", "09", "14", IDAG)).toBeNull();
  });

  it("ett giltigt datum i det forflutna ger inget fel", () => {
    expect(tilltradesdatumfel("1997", "06", "23", IDAG)).toBeNull();
  });
});

describe("tilltradesdatumIso", () => {
  it("ger ISO-strangen for ett fullstandigt giltigt datum", () => {
    expect(tilltradesdatumIso("1997", "06", "23", IDAG)).toBe("1997-06-23");
  });

  it("ger tom strang nar falten inte ar fullstandiga", () => {
    expect(tilltradesdatumIso("1997", "6", "23", IDAG)).toBe("");
  });

  it("ger tom strang for ett omojligt datum", () => {
    expect(tilltradesdatumIso("2020", "04", "31", IDAG)).toBe("");
  });

  it("ger tom strang for ett datum i framtiden", () => {
    expect(tilltradesdatumIso("2026", "09", "15", IDAG)).toBe("");
  });
});
