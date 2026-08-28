import { describe, expect, it } from "vitest";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import type { Regelparameter } from "@/doman/typer";
import { REGELPARAMETRAR } from "./_hjalp";

describe("regelparameteruppslag", () => {
  it("uppslag for ett datum 2015 returnerar ett varde, kastar inte fel", () => {
    expect(
      slaUppRegelparameter(REGELPARAMETRAR, "troskelbelopp", "2015-06-01"),
    ).toBe(500_000);
  });

  it("kastar fel nar inget varde galler for datumet i stallet for tyst tillbakafall", () => {
    const bara_framtida: Regelparameter[] = [
      {
        nyckel: "troskelbelopp",
        varde: 600_000,
        enhet: "oren",
        giltig_fran: "2030-01-01",
        giltig_till: null,
      },
    ];
    expect(() =>
      slaUppRegelparameter(bara_framtida, "troskelbelopp", "2015-01-01"),
    ).toThrow();
  });

  it("valjer den period vars intervall omsluter datumet", () => {
    const versionerad: Regelparameter[] = [
      {
        nyckel: "troskelbelopp",
        varde: 500_000,
        enhet: "oren",
        giltig_fran: "1970-01-01",
        giltig_till: "2028-12-31",
      },
      {
        nyckel: "troskelbelopp",
        varde: 700_000,
        enhet: "oren",
        giltig_fran: "2029-01-01",
        giltig_till: null,
      },
    ];
    expect(
      slaUppRegelparameter(versionerad, "troskelbelopp", "2026-05-01"),
    ).toBe(500_000);
    expect(
      slaUppRegelparameter(versionerad, "troskelbelopp", "2031-05-01"),
    ).toBe(700_000);
  });
});
