import { describe, expect, it } from "vitest";
import { inlagtArsbelopp } from "@/doman/berakningar";
import { kostnad } from "./_hjalp";

// Produktspec avsnitt 2b + 7: oversiktens "Inlagt {ar}" ar summan av allt som
// lagts in under aret, klassificerat eller ej. Till skillnad fran arssumman
// kravs ingen projektkoppling. Privat raknas bort, ROT/forsakringsersattning
// dras av proportionellt, arkiverat och obetalt raknas aldrig.

describe("inlagtArsbelopp", () => {
  it("okopplad kostnad raknas in – till skillnad fran arssumman", () => {
    const k = kostnad({ projekt_id: null, totalbelopp: 421_000 });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(421_000);
  });

  it("kopplad kostnad raknas in med hela beloppet", () => {
    const k = kostnad({ totalbelopp: 520_000 });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(520_000);
  });

  it("privat markerad rad raknas bort", () => {
    const k = kostnad({
      totalbelopp: 102_095,
      rader: [
        {
          artikel: "projektmaterial",
          belopp: 79_195,
          fordelningar: [],
        },
        {
          artikel: "torkstativ",
          belopp: 22_900,
          fordelningar: [{ projekt_id: null, privat: true, andel: 1 }],
        },
      ],
    });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(79_195);
  });

  it("delvis fordelad rad raknas anda in helt – klassificeringen ar uppskjuten", () => {
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
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(100_000);
  });

  it("ROT dras av proportionellt, precis som i arssumman", () => {
    // 10 000 kr, 3 000 kr ROT -> reduktionsfaktor 0,7 -> 7 000 kr inlagt
    const k = kostnad({ totalbelopp: 1_000_000, rot_utnyttjat: 300_000 });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(700_000);
  });

  it("kostnad utan betaldatum raknas inte in", () => {
    const k = kostnad({ betaldatum: null });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(0);
  });

  it("arkiverad kostnad raknas inte in", () => {
    const k = kostnad({ arkiverad: true });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(0);
  });

  it("betaldatum styr aret", () => {
    const k = kostnad({ betaldatum: "2027-01-08", totalbelopp: 500_000 });
    expect(inlagtArsbelopp({ kostnader: [k] }, 2026)).toBe(0);
    expect(inlagtArsbelopp({ kostnader: [k] }, 2027)).toBe(500_000);
  });
});
