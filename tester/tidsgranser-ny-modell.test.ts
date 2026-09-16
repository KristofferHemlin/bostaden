import { describe, expect, it } from "vitest";
import { delaIKategorier, tillampaTidsgranser } from "@/doman/atgardsberakning";
import { kostnad, REGELPARAMETRAR } from "./_hjalp";

describe("aret bestams av betaldatum, femarsfonstret galler bara reparationen", () => {
  it("reparation betald 2026 ingar inte i underlaget vid forsaljning 2032", () => {
    const k = kostnad({ totalbelopp: 300_000, betaldatum: "2026-05-01" });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      merkostnad: null,
    });
    const resultat = tillampaTidsgranser(uppdelning, {
      betaldatum: "2026-05-01",
      forsaljningsAr: 2032,
      femarsfonsterAr: 5,
      upplatelseform: "fastighet",
      bostadenNybyggdVidForvarv: false,
      regelparametrar: REGELPARAMETRAR,
    });
    expect(resultat.reparationsunderlag).toBe(0);
  });

  it("grundforbattring betald 2015 ingar i underlaget vid forsaljning 2032 – grundforbattringar har inget femarsfonster", () => {
    const k = kostnad({ totalbelopp: 300_000, betaldatum: "2015-05-01" });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "nybyggnad",
      battre_kvalitet: null,
      merkostnad: null,
    });
    const resultat = tillampaTidsgranser(uppdelning, {
      betaldatum: "2015-05-01",
      forsaljningsAr: 2032,
      femarsfonsterAr: 5,
      upplatelseform: "fastighet",
      bostadenNybyggdVidForvarv: false,
      regelparametrar: REGELPARAMETRAR,
    });
    expect(resultat.grundforbattringsdel).toBe(300_000);
  });
});

describe("bakre gransen for grundforbattringar beror pa upplatelseform", () => {
  it("grundforbattring i smahus betald 1951 ger 0 kr; betald 1953 ger avdrag", () => {
    const svar = { atgardstyp: "nybyggnad", battre_kvalitet: null, merkostnad: null } as const;
    const fore = tillampaTidsgranser(
      delaIKategorier(kostnad({ totalbelopp: 300_000, betaldatum: "1951-06-01" }), svar),
      {
        betaldatum: "1951-06-01",
        forsaljningsAr: 2026,
        femarsfonsterAr: 5,
        upplatelseform: "fastighet",
        bostadenNybyggdVidForvarv: false,
        regelparametrar: REGELPARAMETRAR,
      },
    );
    expect(fore.grundforbattringsdel).toBe(0);

    const efter = tillampaTidsgranser(
      delaIKategorier(kostnad({ totalbelopp: 300_000, betaldatum: "1953-06-01" }), svar),
      {
        betaldatum: "1953-06-01",
        forsaljningsAr: 2026,
        femarsfonsterAr: 5,
        upplatelseform: "fastighet",
        bostadenNybyggdVidForvarv: false,
        regelparametrar: REGELPARAMETRAR,
      },
    );
    expect(efter.grundforbattringsdel).toBe(300_000);
  });

  it("grundforbattring i bostadsratt betald 1973 ger 0 kr; betald 1975 ger avdrag", () => {
    const svar = { atgardstyp: "nybyggnad", battre_kvalitet: null, merkostnad: null } as const;
    const fore = tillampaTidsgranser(
      delaIKategorier(kostnad({ totalbelopp: 300_000, betaldatum: "1973-06-01" }), svar),
      {
        betaldatum: "1973-06-01",
        forsaljningsAr: 2026,
        femarsfonsterAr: 5,
        upplatelseform: "bostadsratt",
        bostadenNybyggdVidForvarv: false,
        regelparametrar: REGELPARAMETRAR,
      },
    );
    expect(fore.grundforbattringsdel).toBe(0);

    const efter = tillampaTidsgranser(
      delaIKategorier(kostnad({ totalbelopp: 300_000, betaldatum: "1975-06-01" }), svar),
      {
        betaldatum: "1975-06-01",
        forsaljningsAr: 2026,
        femarsfonsterAr: 5,
        upplatelseform: "bostadsratt",
        bostadenNybyggdVidForvarv: false,
        regelparametrar: REGELPARAMETRAR,
      },
    );
    expect(efter.grundforbattringsdel).toBe(300_000);
  });
});
