import { describe, expect, it } from "vitest";
import { delaIKategorier, tillampaTidsgranser } from "@/doman/atgardsberakning";
import { kostnad, REGELPARAMETRAR } from "./_hjalp";

// Produktspec 4.9: berakningsreglerna ar identiska mellan upplatelseformerna –
// enda skillnaden ar den bakre tidsgransen for grundforbattringar (1952 for
// smahus, 1974 for bostadsratt).

describe("paritet mellan bostadsratt och fastighet", () => {
  function korMed(upplatelseform: "fastighet" | "bostadsratt", betaldatum: string) {
    const k = kostnad({ totalbelopp: 300_000, betaldatum });
    const uppdelning = delaIKategorier(k, {
      atgardstyp: "nybyggnad",
      battre_kvalitet: null,
      merkostnad: null,
    });
    return tillampaTidsgranser(uppdelning, {
      betaldatum,
      forsaljningsAr: 2026,
      femarsfonsterAr: 5,
      upplatelseform,
      bostadenNybyggdVidForvarv: false,
      regelparametrar: REGELPARAMETRAR,
    });
  }

  it("samma indata ger samma resultat for bada formerna nar bakre gransen inte ar i fraga", () => {
    const fastighet = korMed("fastighet", "2020-06-01");
    const bostadsratt = korMed("bostadsratt", "2020-06-01");
    expect(fastighet).toEqual(bostadsratt);
    expect(fastighet).toEqual({ grundforbattringsdel: 300_000, reparationsunderlag: 0 });
  });

  it("undantaget ar den bakre tidsgransen: 1960 ligger efter fastighetens grans (1952) men fore bostadsrattens (1974)", () => {
    const fastighet = korMed("fastighet", "1960-06-01");
    const bostadsratt = korMed("bostadsratt", "1960-06-01");
    expect(fastighet.grundforbattringsdel).toBe(300_000);
    expect(bostadsratt.grundforbattringsdel).toBe(0);
  });
});
