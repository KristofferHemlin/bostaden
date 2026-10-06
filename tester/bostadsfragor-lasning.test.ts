import { describe, expect, it } from "vitest";
import {
  bostadsfragorForBerakning,
  bostadsfragornaBesvarade,
  forstaAgaren,
  lagringAvBostadsfragor,
  lagringVidBytAvUpplatelseform,
  lasBostadsfragor,
  tolkaBostadsfragesvar,
} from "@/doman/bostadsfragor";

// src/doman/bostadsfragor.ts: det enda stallet som laser de lagrade
// kolumnerna och det enda stallet som avgor om bostadsfragorna ar besvarade.
// Kolumnerna defaultar till false, och false ar svaret som TILLATER
// reparationsavdrag – ett obesvarat far darfor aldrig lasas som "Nej".

function lagrat(
  nybyggd: boolean,
  ombildning: boolean,
  besvarade: boolean,
  upplatelseform: "bostadsratt" | "fastighet" = "bostadsratt",
) {
  return {
    upplatelseform,
    nybyggd_vid_forvarv: nybyggd,
    ombildning_fran_hyresratt: ombildning,
    bostadsfragor_besvarade: besvarade,
  };
}

describe("forstaAgaren: true, false eller null", () => {
  it("en ny bostad (kolumnernas standardvarden) ar obesvarad, inte ett nej", () => {
    expect(forstaAgaren(lagrat(false, false, false))).toBeNull();
  });

  it("ett besvarat nej ar false", () => {
    expect(forstaAgaren(lagrat(false, false, true))).toBe(false);
  });

  it("ett lagrat ja raknas som svar aven utan flaggan – bara ett aktivt Ja skriver true", () => {
    expect(forstaAgaren(lagrat(true, false, false))).toBe(true);
  });
});

describe("bostadsfragornaBesvarade, bostadsratt: varje fraga som galler, givet svaren", () => {
  it("obesvarad forsta agare: inte besvarade", () => {
    expect(bostadsfragornaBesvarade({ upplatelseform: "bostadsratt", forstaAgare: null, ombildning: null })).toBe(false);
  });

  it("nej: ombildningen stalls inte, och fragorna ar besvarade", () => {
    expect(bostadsfragornaBesvarade({ upplatelseform: "bostadsratt", forstaAgare: false, ombildning: null })).toBe(true);
  });

  it("ja utan ombildningssvar: inte besvarade", () => {
    expect(bostadsfragornaBesvarade({ upplatelseform: "bostadsratt", forstaAgare: true, ombildning: null })).toBe(false);
  });

  it("ja med ombildningssvar: besvarade", () => {
    expect(bostadsfragornaBesvarade({ upplatelseform: "bostadsratt", forstaAgare: true, ombildning: false })).toBe(true);
  });
});

describe("tillståndet som uppmättes i produktionen 2026-10-06", () => {
  // Ja och ombildning nej sparades i installningarna, flaggan false.
  //
  // VANT 2026-10-06. Fallet slog forst fast att tillstandet var BESVARAT – det
  // kodifierade en kringgang som ett krav. Ombildningens "nej" var ett forval
  // som sparades, inte ett svar, och ett lagrat false bevisar ingenting utan
  // flaggan (src/doman/bostadsfragor.ts, regeln vid lagratSvar). Ett lagrat
  // true ar daremot sitt eget bevis, sa forsta agaren star kvar som "Ja".
  const b = lagrat(true, false, false);

  it("forsta agaren ar besvarad med ja, ombildningen ar obesvarad", () => {
    expect(lasBostadsfragor(b)).toEqual({
      upplatelseform: "bostadsratt",
      forstaAgare: true,
      ombildning: null,
    });
  });

  it("bostadsfragorna ar darmed obesvarade, och genomgangen fragar om ombildningen", () => {
    expect(bostadsfragornaBesvarade(lasBostadsfragor(b))).toBe(false);
  });

  it("och berakningen far inget svar", () => {
    expect(bostadsfragorForBerakning(b).nybyggd_vid_forvarv).toBeNull();
  });
});

describe("samma regel for bada kolumnerna: true ar sitt eget bevis, false kraver flaggan", () => {
  it("ett lagrat ombildnings-ja raknas som svar aven utan flaggan", () => {
    expect(lasBostadsfragor(lagrat(true, true, false)).ombildning).toBe(true);
  });

  it("ett lagrat ombildnings-nej med flaggan ar ett svar", () => {
    expect(lasBostadsfragor(lagrat(true, false, true)).ombildning).toBe(false);
  });
});

describe("byte av upplatelseform nollstaller flaggan, at bada hallen", () => {
  it("bara ett faktiskt byte nollstaller", () => {
    expect(lagringVidBytAvUpplatelseform("bostadsratt", "bostadsratt")).toEqual({});
    expect(lagringVidBytAvUpplatelseform("fastighet", "fastighet")).toEqual({});
    expect(lagringVidBytAvUpplatelseform("fastighet", "bostadsratt")).toEqual({
      bostadsfragor_besvarade: false,
    });
    expect(lagringVidBytAvUpplatelseform("bostadsratt", "fastighet")).toEqual({
      bostadsfragor_besvarade: false,
    });
  });

  it("fastighet med ja blir bostadsratt: forsta agaren star kvar, ombildningen fragas", () => {
    const fore = lagrat(true, false, true, "fastighet");
    expect(bostadsfragornaBesvarade(lasBostadsfragor(fore))).toBe(true);

    const efter = {
      ...fore,
      upplatelseform: "bostadsratt" as const,
      ...lagringVidBytAvUpplatelseform("fastighet", "bostadsratt"),
    };
    expect(lasBostadsfragor(efter)).toEqual({
      upplatelseform: "bostadsratt",
      forstaAgare: true,
      ombildning: null,
    });
    expect(bostadsfragornaBesvarade(lasBostadsfragor(efter))).toBe(false);
  });

  it("bostadsratt med nej blir fastighet: forsta agaren fragas igen", () => {
    const fore = lagrat(false, false, true, "bostadsratt");
    const efter = {
      ...fore,
      upplatelseform: "fastighet" as const,
      ...lagringVidBytAvUpplatelseform("bostadsratt", "fastighet"),
    };
    expect(lasBostadsfragor(efter).forstaAgare).toBeNull();
    expect(bostadsfragornaBesvarade(lasBostadsfragor(efter))).toBe(false);
  });
});

describe("bostadsfragorForBerakning: obesvarat blir null, aldrig false", () => {
  it("en ny bostad ger nybyggd_vid_forvarv null", () => {
    expect(bostadsfragorForBerakning(lagrat(false, false, false)).nybyggd_vid_forvarv).toBeNull();
  });

  it("ett besvarat nej ger false", () => {
    expect(bostadsfragorForBerakning(lagrat(false, false, true)).nybyggd_vid_forvarv).toBe(false);
  });
});

describe("tolkning och lagring – samma for genomgangen och installningarna", () => {
  it("tomt forsta agaren ar obesvarat och skriver ingenting", () => {
    const t = tolkaBostadsfragesvar("", "", "bostadsratt");
    expect(t).toEqual({
      svar: { upplatelseform: "bostadsratt", forstaAgare: null, ombildning: null },
    });
    if ("svar" in t) expect(lagringAvBostadsfragor(t.svar)).toEqual({});
  });

  it("ja utan ombildningssvar ar ett fel", () => {
    expect(tolkaBostadsfragesvar("ja", "", "bostadsratt")).toHaveProperty("fel");
  });

  it("nej satter flaggan och ror inte ombildningen", () => {
    const t = tolkaBostadsfragesvar("nej", "ja", "bostadsratt");
    if (!("svar" in t)) throw new Error("väntade ett svar");
    expect(lagringAvBostadsfragor(t.svar)).toEqual({
      nybyggd_vid_forvarv: false,
      bostadsfragor_besvarade: true,
    });
  });

  it("ja och ombildning satter bada och flaggan", () => {
    const t = tolkaBostadsfragesvar("ja", "nej", "bostadsratt");
    if (!("svar" in t)) throw new Error("väntade ett svar");
    expect(lagringAvBostadsfragor(t.svar)).toEqual({
      nybyggd_vid_forvarv: true,
      ombildning_fran_hyresratt: false,
      bostadsfragor_besvarade: true,
    });
  });
});

// docs/regelkallor.md, Fastigheter: ombildning ar ett bostadsrattsbegrepp. En
// nybyggd villa kan inte ha kommit ur en ombildning, sa for en fastighet ar
// forsta agaren den enda fragan – villkoret ligger i bostadsfragornaBesvarade.
describe("fastighet: forsta agaren ar den enda fragan", () => {
  it("ja utan ombildningssvar ar besvarat", () => {
    expect(
      bostadsfragornaBesvarade({ upplatelseform: "fastighet", forstaAgare: true, ombildning: null }),
    ).toBe(true);
  });

  it("nej ar besvarat", () => {
    expect(
      bostadsfragornaBesvarade({ upplatelseform: "fastighet", forstaAgare: false, ombildning: null }),
    ).toBe(true);
  });

  it("obesvarat ar fortfarande obesvarat", () => {
    expect(
      bostadsfragornaBesvarade({ upplatelseform: "fastighet", forstaAgare: null, ombildning: null }),
    ).toBe(false);
  });

  it("ja tolkas utan ombildningssvar, och ombildningen skrivs inte", () => {
    const t = tolkaBostadsfragesvar("ja", "", "fastighet");
    if (!("svar" in t)) throw new Error("väntade ett svar");
    expect(lagringAvBostadsfragor(t.svar)).toEqual({
      nybyggd_vid_forvarv: true,
      bostadsfragor_besvarade: true,
    });
  });

  it("ett lagrat ombildnings-ja lases aldrig for en fastighet", () => {
    const b = lagrat(true, true, true, "fastighet");
    expect(lasBostadsfragor(b).ombildning).toBeNull();
    // Nybyggd utan ombildning: reparationerna faller bort.
    expect(bostadsfragorForBerakning(b)).toEqual({
      nybyggd_vid_forvarv: true,
      ombildning_fran_hyresratt: false,
    });
  });
});
