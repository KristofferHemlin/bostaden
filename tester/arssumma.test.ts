import { describe, expect, it } from "vitest";
import { arssummaForBostad } from "@/doman/berakningar";
import { kostnad, projekt } from "./_hjalp";

const PROJEKT = [projekt({ id: "p1" })];

describe("arssumman for hela bostaden", () => {
  it("kostnad utan projektkoppling raknas inte in i arssumman", () => {
    const k = kostnad({ projekt_id: null });
    expect(arssummaForBostad({ kostnader: [k], projekt: PROJEKT }, 2026)).toBe(0);
  });

  it("kostnad utan betaldatum raknas inte in i arssumman", () => {
    const k = kostnad({ betaldatum: null });
    expect(arssummaForBostad({ kostnader: [k], projekt: PROJEKT }, 2026)).toBe(0);
  });

  it("kvittorad markerad som privat ingar inte i nagot projekt", () => {
    const k = kostnad({
      totalbelopp: 50_000,
      rader: [
        {
          artikel: "torkstativ",
          belopp: 50_000,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    expect(arssummaForBostad({ kostnader: [k], projekt: PROJEKT }, 2026)).toBe(0);
  });

  it("rad fordelad till 60 % pa ett projekt bidrar med 60 % av beloppet, inte hela", () => {
    const k = kostnad({ totalbelopp: 100_000, andel: 0.6 });
    expect(arssummaForBostad({ kostnader: [k], projekt: PROJEKT }, 2026)).toBe(
      60_000,
    );
  });

  it("resten av en delvis fordelad rad ligger kvar som okopplat och raknas inte", () => {
    const k = kostnad({
      totalbelopp: 100_000,
      rader: [
        {
          artikel: "delad",
          belopp: 100_000,
          fordelningar: [{ projekt_id: "p1", privat: false, andel: 0.6 }],
        },
      ],
    });
    // 40 % ar varken privat eller kopplat -> bidrar 0
    expect(arssummaForBostad({ kostnader: [k], projekt: PROJEKT }, 2026)).toBe(
      60_000,
    );
  });

  it("arkiverad kostnad raknas inte in", () => {
    const k = kostnad({ arkiverad: true });
    expect(arssummaForBostad({ kostnader: [k], projekt: PROJEKT }, 2026)).toBe(0);
  });
});
