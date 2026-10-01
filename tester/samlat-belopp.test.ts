import { describe, expect, it } from "vitest";
import { inlagtArsbelopp, samlatBelopp } from "@/doman/berakningar";
import { kostnad } from "./_hjalp";

// docs/design.md, Metrikblock: "Totalt inlagt" ar summan av allt som lagts in
// pa bostaden, oavsett ar och oavsett klassificering – aven kostnader utan
// betaldatum och kostnader fore tilltradet. Annars samma tal som "Inlagt {ar}".

describe("samlatBelopp", () => {
  it("omfattar kostnader fran flera ar, inte bara innevarande", () => {
    const kostnader = [
      kostnad({ id: "a", betaldatum: "2022-05-10", totalbelopp: 300_000 }),
      kostnad({ id: "b", betaldatum: "2024-11-02", totalbelopp: 120_000 }),
      kostnad({ id: "c", betaldatum: "2026-03-15", totalbelopp: 50_000 }),
    ];
    expect(samlatBelopp({ kostnader })).toBe(470_000);
  });

  it("omfattar oklassificerade kostnader", () => {
    const k = kostnad({ projekt_id: null, totalbelopp: 421_000 });
    expect(samlatBelopp({ kostnader: [k] })).toBe(421_000);
  });

  it("raknar inte med utkast", () => {
    const kostnader = [
      kostnad({ id: "a", totalbelopp: 100_000 }),
      { ...kostnad({ id: "b" }), totalbelopp: null },
    ];
    expect(samlatBelopp({ kostnader })).toBe(100_000);
  });

  it("omfattar kostnader utan betaldatum – till skillnad fran arssumman", () => {
    const k = kostnad({ betaldatum: null, totalbelopp: 250_000 });
    expect(samlatBelopp({ kostnader: [k] })).toBe(250_000);
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(0);
  });

  it("omfattar kostnader betalda fore tilltradet", () => {
    // Summan tar inte in bostaden alls – tilltradet kan inte begransa den.
    const k = kostnad({ betaldatum: "2015-06-01", totalbelopp: 80_000 });
    expect(samlatBelopp({ kostnader: [k] })).toBe(80_000);
  });

  it("drar av ROT och utesluter privat precis som arssumman", () => {
    const k = kostnad({
      totalbelopp: 1_000_000,
      rot_utnyttjat: 300_000,
      rader: [
        { artikel: "arbete", belopp: 900_000, fordelningar: [] },
        {
          artikel: "privat",
          belopp: 100_000,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    expect(samlatBelopp({ kostnader: [k] })).toBe(
      inlagtArsbelopp({ kostnader: [k] }, 2026),
    );
  });

  it("raknar inte med arkiverade kostnader", () => {
    const k = kostnad({ arkiverad: true });
    expect(samlatBelopp({ kostnader: [k] })).toBe(0);
  });

  it("en bostad utan kostnader ger 0, inte ett tomt varde", () => {
    expect(samlatBelopp({ kostnader: [] })).toBe(0);
  });
});
