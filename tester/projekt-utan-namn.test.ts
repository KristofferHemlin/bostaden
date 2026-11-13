import { describe, expect, it } from "vitest";
import { hogVisningsnamn, projektnamnKarta } from "@/doman/genomgang";

// Ett projekt utan namn heter som sina kvitton (docs/design.md, "Projekt som
// skapades före omläggningen"): "2 kvitton · BAUHAUS, Jysk". Bara projekt
// skapade före 2026-11-13 kan sakna namn. Flyttat hit från genomgångens
// test när genomgången revs – funktionen lever vidare.

describe("hogVisningsnamn", () => {
  it("listar leverantorer i forsta-forekomst-ordning, utan dubbletter", () => {
    expect(
      hogVisningsnamn([{ leverantor: "BAUHAUS" }, { leverantor: "Jysk" }, { leverantor: "BAUHAUS" }]),
    ).toBe("3 kvitton · BAUHAUS, Jysk");
  });

  it("ental bojs ratt: '1 kvitto', inte '1 kvitton'", () => {
    expect(hogVisningsnamn([{ leverantor: "Hornbach" }])).toBe("1 kvitto · Hornbach");
  });

  it("saknar alla kvitton leverantor blir det bara antalet", () => {
    expect(hogVisningsnamn([{ leverantor: null }, { leverantor: null }])).toBe("2 kvitton");
  });
});

// CLAUDE.md, "Lika tidsstämplar är ingen ordning": två kvitton med samma
// datum ska ge samma namn oavsett i vilken ordning databasen lämnar dem.
describe("projektnamnKarta med lika datum", () => {
  const d = new Date("2025-04-02T00:00:00.000Z");
  const kvitto = (leverantor: string) => ({
    leverantor, betaldatum: d, dokumentdatum: d,
    rader: [{ fordelningar: [{ projekt_id: "p" }] }],
  });

  it("förutsättningen: datumen är lika, så bara den sista nyckeln skiljer dem", () => {
    expect(kvitto("Byggmax").betaldatum.getTime()).toBe(kvitto("BAUHAUS").betaldatum.getTime());
  });

  it("samma namn i båda ordningarna", () => {
    const projekt = [{ id: "p", namn: "" }];
    const a = projektnamnKarta(projekt, [kvitto("Byggmax"), kvitto("BAUHAUS")]).get("p");
    const b = projektnamnKarta(projekt, [kvitto("BAUHAUS"), kvitto("Byggmax")]).get("p");
    expect(a).toBe("2 kvitton · BAUHAUS, Byggmax");
    expect(b).toBe(a);
  });
});
