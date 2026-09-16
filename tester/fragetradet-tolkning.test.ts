import { describe, expect, it } from "vitest";
import {
  atgardKategoriText,
  fraga3Relevant,
  fraga4Relevant,
  fraga5Relevant,
  harledFragetradetSvar,
  harReparationsdel,
  tolkaFragetradet,
  tolkaSkickForvarv,
  TOMT_FRAGETRADSSVAR,
  type FragetradetSvar,
} from "@/doman/fragetradet";

// Fragetradet (produktspec 4.1): fraga 2-4 avgor om atgarden ar en ren
// grundforbattring (klart direkt) eller ett utbyte (vidare till fraga 5).
// Grenar som inte paverkar resultatet ska hoppas over – testat har via
// relevans-funktionerna som styr vilka fragor UI:t visar.

describe("relevans – vilka fragor som ska stallas", () => {
  it("fraga 3 stalls bara nar fraga 2 ar 'nej'", () => {
    expect(fraga3Relevant({ byggdeNytt: "" })).toBe(false);
    expect(fraga3Relevant({ byggdeNytt: "ja" })).toBe(false);
    expect(fraga3Relevant({ byggdeNytt: "nej" })).toBe(true);
  });

  it("fraga 4 stalls bara nar fraga 2 och 3 bada ar 'nej'", () => {
    expect(
      fraga4Relevant({ byggdeNytt: "nej", andradePlanlosning: "ja" }),
    ).toBe(false);
    expect(
      fraga4Relevant({ byggdeNytt: "nej", andradePlanlosning: "" }),
    ).toBe(false);
    expect(
      fraga4Relevant({ byggdeNytt: "nej", andradePlanlosning: "nej" }),
    ).toBe(true);
    expect(
      fraga4Relevant({ byggdeNytt: "ja", andradePlanlosning: "nej" }),
    ).toBe(false);
  });

  it("fraga 5 (och reparationsdelen) stalls bara nar fraga 4 ar 'bytt'", () => {
    const bas = { byggdeNytt: "nej", andradePlanlosning: "nej" } as const;
    expect(fraga5Relevant({ ...bas, nyttEllerBytt: "nytt" })).toBe(false);
    expect(fraga5Relevant({ ...bas, nyttEllerBytt: "bytt" })).toBe(true);
    expect(harReparationsdel({ ...bas, nyttEllerBytt: "bytt" })).toBe(true);
    expect(harReparationsdel({ ...bas, nyttEllerBytt: "nytt" })).toBe(false);
  });

  it("reparationsdelen finns oavsett vad fraga 5 sedan svaras – battre kvalitet lamnar ocksa en reparationsdel", () => {
    const svar = {
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "bytt",
    } as const;
    expect(harReparationsdel(svar)).toBe(true);
  });
});

describe("tolkaFragetradet – de fyra terminala grenarna", () => {
  it("fraga 2 = ja ger nybyggnad, hela beloppet grundforbattring", () => {
    const svar: FragetradetSvar = { ...TOMT_FRAGETRADSSVAR, byggdeNytt: "ja" };
    expect(tolkaFragetradet(svar)).toEqual({
      atgardstyp: "nybyggnad",
      battre_kvalitet: null,
      merkostnad: null,
    });
  });

  it("fraga 3 = ja ger planlosning", () => {
    const svar: FragetradetSvar = {
      ...TOMT_FRAGETRADSSVAR,
      byggdeNytt: "nej",
      andradePlanlosning: "ja",
    };
    expect(tolkaFragetradet(svar)).toEqual({
      atgardstyp: "planlosning",
      battre_kvalitet: null,
      merkostnad: null,
    });
  });

  it("fraga 4 = nytt ger nytt_tillagg", () => {
    const svar: FragetradetSvar = {
      ...TOMT_FRAGETRADSSVAR,
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "nytt",
    };
    expect(tolkaFragetradet(svar)).toEqual({
      atgardstyp: "nytt_tillagg",
      battre_kvalitet: null,
      merkostnad: null,
    });
  });

  it("fraga 5 = liknande ger utbytt/battre_kvalitet=false, ingen merkostnad", () => {
    const svar: FragetradetSvar = {
      ...TOMT_FRAGETRADSSVAR,
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "bytt",
      battreEllerLiknande: "liknande",
    };
    expect(tolkaFragetradet(svar)).toEqual({
      atgardstyp: "utbytt",
      battre_kvalitet: false,
      merkostnad: null,
    });
  });

  it("fraga 5 = battre med giltig merkostnad ger utbytt/battre_kvalitet=true", () => {
    const svar: FragetradetSvar = {
      ...TOMT_FRAGETRADSSVAR,
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "bytt",
      battreEllerLiknande: "battre",
      merkostnad: 50_000,
    };
    expect(tolkaFragetradet(svar)).toEqual({
      atgardstyp: "utbytt",
      battre_kvalitet: true,
      merkostnad: 50_000,
    });
  });

  it("fraga 5 = battre utan merkostnad (null eller <= 0) ar ofardigt – Skatteverkets verktyg avvisar noll", () => {
    const utanMerkostnad: FragetradetSvar = {
      ...TOMT_FRAGETRADSSVAR,
      byggdeNytt: "nej",
      andradePlanlosning: "nej",
      nyttEllerBytt: "bytt",
      battreEllerLiknande: "battre",
      merkostnad: null,
    };
    expect(tolkaFragetradet(utanMerkostnad)).toBeNull();

    const nollMerkostnad: FragetradetSvar = {
      ...utanMerkostnad,
      merkostnad: 0,
    };
    expect(tolkaFragetradet(nollMerkostnad)).toBeNull();
  });

  it("ett ofardigt trad (t.ex. bara fraga 2 obesvarad) ger null", () => {
    expect(tolkaFragetradet(TOMT_FRAGETRADSSVAR)).toBeNull();
    expect(
      tolkaFragetradet({
        ...TOMT_FRAGETRADSSVAR,
        byggdeNytt: "nej",
        andradePlanlosning: "nej",
        nyttEllerBytt: "bytt",
      }),
    ).toBeNull(); // fraga 5 obesvarad
  });
});

describe("harledFragetradetSvar – motsatsen, for redigeringsformularet", () => {
  it("harleder ratt gren for varje atgardstyp, och rundtrippar genom tolkaFragetradet", () => {
    const fall: {
      atgardstyp: "nybyggnad" | "planlosning" | "nytt_tillagg" | "utbytt";
      battre_kvalitet: boolean | null;
      merkostnad: number | null;
    }[] = [
      { atgardstyp: "nybyggnad", battre_kvalitet: null, merkostnad: null },
      { atgardstyp: "planlosning", battre_kvalitet: null, merkostnad: null },
      { atgardstyp: "nytt_tillagg", battre_kvalitet: null, merkostnad: null },
      { atgardstyp: "utbytt", battre_kvalitet: false, merkostnad: null },
      { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 12_345 },
    ];
    for (const f of fall) {
      const harlett = harledFragetradetSvar(f.atgardstyp, f.battre_kvalitet);
      const svar: FragetradetSvar = { ...harlett, merkostnad: f.merkostnad };
      expect(tolkaFragetradet(svar)).toEqual({
        atgardstyp: f.atgardstyp,
        battre_kvalitet: f.battre_kvalitet,
        merkostnad: f.merkostnad,
      });
    }
  });

  it("atgardstyp = null ger ett tomt svar", () => {
    expect(harledFragetradetSvar(null, null)).toEqual({
      byggdeNytt: "",
      andradePlanlosning: "",
      nyttEllerBytt: "",
      battreEllerLiknande: "",
    });
  });
});

describe("atgardKategoriText – en atgard kan bidra till bade kategorier samtidigt", () => {
  it("null-atgardstyp: behover klassificeras", () => {
    expect(atgardKategoriText(null, null)).toBe("Behöver klassificeras");
  });

  it("nybyggnad/planlosning/nytt_tillagg: alltid grundforbattring", () => {
    expect(atgardKategoriText("nybyggnad", null)).toBe("Grundförbättring");
    expect(atgardKategoriText("planlosning", null)).toBe("Grundförbättring");
    expect(atgardKategoriText("nytt_tillagg", null)).toBe("Grundförbättring");
  });

  it("utbytt + liknande kvalitet: ren reparation", () => {
    expect(atgardKategoriText("utbytt", false)).toBe("Reparation");
  });

  it("utbytt + battre kvalitet: bada kategorierna", () => {
    expect(atgardKategoriText("utbytt", true)).toBe(
      "Grundförbättring och reparation",
    );
  });
});

describe("tolkaSkickForvarv", () => {
  it("tolkar 0-5 som heltal", () => {
    for (let i = 0; i <= 5; i += 1) {
      expect(tolkaSkickForvarv(String(i))).toBe(i);
    }
  });

  it("tomt falt ger null", () => {
    expect(tolkaSkickForvarv("")).toBeNull();
    expect(tolkaSkickForvarv("  ")).toBeNull();
  });

  it("ogiltiga varden ger null", () => {
    expect(tolkaSkickForvarv("6")).toBeNull();
    expect(tolkaSkickForvarv("-1")).toBeNull();
    expect(tolkaSkickForvarv("3.5")).toBeNull();
    expect(tolkaSkickForvarv("abc")).toBeNull();
  });
});
