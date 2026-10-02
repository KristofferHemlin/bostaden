import { describe, expect, it } from "vitest";
import { bostadHeader } from "@/lib/bostad-header";

// Toppraden (docs/design.md, Skrivbordsvyn) visar adressen. Bostader skapade
// innan adressen blev obligatorisk (2026-10-01) kan sakna den – det ar inte ett
// kantfall utan det lage varje befintligt konto kan vara i. Da star
// upplatelseformen dar: "Lagenheten" eller "Huset". Aldrig tomt, aldrig ett
// bindestreck.

const utan = { adress: null };

describe("bostadHeader", () => {
  it("visar adressen", () => {
    expect(
      bostadHeader({ ...utan, adress: "Ulriksborgsgatan 7", upplatelseform: "bostadsratt" })
        .bostadsnamn,
    ).toBe("Ulriksborgsgatan 7");
  });

  it("bostadsratt utan adress visar Lagenheten", () => {
    expect(bostadHeader({ ...utan, upplatelseform: "bostadsratt" }).bostadsnamn).toBe(
      "Lägenheten",
    );
  });

  it("fastighet utan adress visar Huset", () => {
    expect(bostadHeader({ ...utan, upplatelseform: "fastighet" }).bostadsnamn).toBe("Huset");
  });

  it("en adress med bara mellanslag raknas som saknad", () => {
    expect(
      bostadHeader({ ...utan, adress: "   ", upplatelseform: "fastighet" }).bostadsnamn,
    ).toBe("Huset");
  });

  it("toppraden ar aldrig tom och aldrig ett bindestreck", () => {
    for (const upplatelseform of ["bostadsratt", "fastighet"] as const) {
      const namn = bostadHeader({ ...utan, adress: "", upplatelseform }).bostadsnamn;
      expect(namn.trim()).not.toBe("");
      expect(namn).not.toMatch(/^[-–—]$/);
    }
  });
});
