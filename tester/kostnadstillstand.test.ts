import { describe, expect, it } from "vitest";
import { harledKostnadstillstand } from "@/doman/berakningar";
import { kostnad } from "./_hjalp";

describe("kostnadens tillstand harleds, lagras inte", () => {
  it("obetald och okopplad ar oberoende av varandra", () => {
    const t = harledKostnadstillstand(
      kostnad({ betaldatum: null, projekt_id: null }),
    );
    expect(t).toMatchObject({ obetald: true, okopplad: true, kopplad: false });
  });

  it("en betald men oklassificerad faktura ar okopplad", () => {
    const t = harledKostnadstillstand(kostnad({ projekt_id: null }));
    expect(t).toMatchObject({ obetald: false, okopplad: true });
  });

  it("kopplad sa snart en rad ar fordelad till ett projekt", () => {
    const t = harledKostnadstillstand(kostnad({ projekt_id: "p1" }));
    expect(t).toMatchObject({ kopplad: true, okopplad: false });
  });

  it("en rad som bara ar fordelad till privat ar inte en projektkoppling", () => {
    const t = harledKostnadstillstand(
      kostnad({
        rader: [
          {
            artikel: "torkstativ",
            belopp: 100_000,
            fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
          },
        ],
      }),
    );
    expect(t.okopplad).toBe(true);
  });
});
