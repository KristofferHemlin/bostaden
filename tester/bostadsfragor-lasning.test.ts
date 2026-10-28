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

// src/doman/bostadsfragor.ts: det enda stallet som avgor om bostadsfragorna
// ar besvarade. Kolumnerna ar nullbara utan forval sedan 2026-10-28 (CLAUDE.md,
// "Andelen ar null tills den besvarats", sista stycket): null ar obesvarat,
// false ar ett besvarat nej. Ingen flagga, ingen oversattning.

function lagrat(
  nybyggd: boolean | null,
  ombildning: boolean | null,
  upplatelseform: "bostadsratt" | "fastighet" = "bostadsratt",
) {
  return { upplatelseform, nybyggd_vid_forvarv: nybyggd, ombildning_fran_hyresratt: ombildning };
}

describe("forstaAgaren: true, false eller null – kolumnens varde", () => {
  it("en ny bostad (null) ar obesvarad", () => {
    expect(forstaAgaren(lagrat(null, null))).toBeNull();
  });

  it("ett lagrat nej ar false – ett svar, utan nagon flagga", () => {
    expect(forstaAgaren(lagrat(false, null))).toBe(false);
  });

  it("ett lagrat ja ar true", () => {
    expect(forstaAgaren(lagrat(true, null))).toBe(true);
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

// CLAUDE.md, testlistan: "Obesvarad ombildning_fran_hyresratt blockerar nar
// bostaden ar en bostadsratt och forsta agaren ar ja, men inte annars." Provat
// fran de lagrade kolumnerna – det ar dar ett obesvarat nej forr kunde gomma sig.
describe("obesvarad ombildning, fran de lagrade kolumnerna", () => {
  it("bostadsratt, forsta agaren ja, ombildningen null: obesvarade", () => {
    expect(bostadsfragornaBesvarade(lasBostadsfragor(lagrat(true, null)))).toBe(false);
  });

  it("bostadsratt, forsta agaren ja, ombildningen nej: besvarade", () => {
    expect(bostadsfragornaBesvarade(lasBostadsfragor(lagrat(true, false)))).toBe(true);
  });

  it("bostadsratt, forsta agaren nej, ombildningen null: besvarade – fragan stalls inte", () => {
    expect(bostadsfragornaBesvarade(lasBostadsfragor(lagrat(false, null)))).toBe(true);
  });

  it("fastighet, forsta agaren ja, ombildningen null: besvarade – fragan stalls inte", () => {
    expect(bostadsfragornaBesvarade(lasBostadsfragor(lagrat(true, null, "fastighet")))).toBe(true);
  });
});

describe("tillståndet som uppmättes i produktionen 2026-10-06", () => {
  // Ja sparades i installningarna, ombildningen lamnades obesvarad. Med
  // flaggan var det ombildningens forval false som maste kannas igen som
  // obesvarat; med nullbara kolumner ar det null, och ingenting behover
  // tolkas.
  const b = lagrat(true, null);

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

describe("byte av upplatelseform gor ett lagrat nej obesvarat, at bada hallen", () => {
  it("bara ett faktiskt byte ror svaren", () => {
    expect(lagringVidBytAvUpplatelseform("bostadsratt", "bostadsratt", lagrat(false, false))).toEqual({});
    expect(lagringVidBytAvUpplatelseform("fastighet", "fastighet", lagrat(false, false))).toEqual({});
  });

  it("ett nej blir null, ett ja star kvar, ett null ror ingenting", () => {
    expect(lagringVidBytAvUpplatelseform("fastighet", "bostadsratt", lagrat(false, false))).toEqual({
      nybyggd_vid_forvarv: null,
      ombildning_fran_hyresratt: null,
    });
    expect(lagringVidBytAvUpplatelseform("bostadsratt", "fastighet", lagrat(true, true))).toEqual({});
    expect(lagringVidBytAvUpplatelseform("bostadsratt", "fastighet", lagrat(null, null))).toEqual({});
  });

  it("fastighet med ja blir bostadsratt: forsta agaren star kvar, ombildningen fragas", () => {
    const fore = lagrat(true, null, "fastighet");
    expect(bostadsfragornaBesvarade(lasBostadsfragor(fore))).toBe(true);

    const efter = {
      ...fore,
      upplatelseform: "bostadsratt" as const,
      ...lagringVidBytAvUpplatelseform("fastighet", "bostadsratt", fore),
    };
    expect(lasBostadsfragor(efter)).toEqual({
      upplatelseform: "bostadsratt",
      forstaAgare: true,
      ombildning: null,
    });
    expect(bostadsfragornaBesvarade(lasBostadsfragor(efter))).toBe(false);
  });

  it("bostadsratt med nej blir fastighet: forsta agaren fragas igen", () => {
    const fore = lagrat(false, null, "bostadsratt");
    const efter = {
      ...fore,
      upplatelseform: "fastighet" as const,
      ...lagringVidBytAvUpplatelseform("bostadsratt", "fastighet", fore),
    };
    expect(lasBostadsfragor(efter).forstaAgare).toBeNull();
    expect(bostadsfragornaBesvarade(lasBostadsfragor(efter))).toBe(false);
  });
});

describe("bostadsfragorForBerakning: obesvarat blir null, aldrig false", () => {
  it("en ny bostad ger nybyggd_vid_forvarv null", () => {
    expect(bostadsfragorForBerakning(lagrat(null, null)).nybyggd_vid_forvarv).toBeNull();
  });

  it("ett besvarat nej ger false", () => {
    expect(bostadsfragorForBerakning(lagrat(false, null)).nybyggd_vid_forvarv).toBe(false);
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

  it("nej skriver svaret och ror inte ombildningen", () => {
    const t = tolkaBostadsfragesvar("nej", "ja", "bostadsratt");
    if (!("svar" in t)) throw new Error("väntade ett svar");
    expect(lagringAvBostadsfragor(t.svar)).toEqual({ nybyggd_vid_forvarv: false });
  });

  it("ja och ombildning skriver bada", () => {
    const t = tolkaBostadsfragesvar("ja", "nej", "bostadsratt");
    if (!("svar" in t)) throw new Error("väntade ett svar");
    expect(lagringAvBostadsfragor(t.svar)).toEqual({
      nybyggd_vid_forvarv: true,
      ombildning_fran_hyresratt: false,
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
    expect(lagringAvBostadsfragor(t.svar)).toEqual({ nybyggd_vid_forvarv: true });
  });

  it("ett lagrat ombildnings-ja lases aldrig for en fastighet", () => {
    const b = lagrat(true, true, "fastighet");
    expect(lasBostadsfragor(b).ombildning).toBeNull();
    // Nybyggd utan ombildning: reparationerna faller bort.
    expect(bostadsfragorForBerakning(b)).toEqual({
      nybyggd_vid_forvarv: true,
      ombildning_fran_hyresratt: false,
    });
  });
});
