import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/produktspec.md 4.1: bostadsfragorna ("Var du första ägaren?",
// "Ombildning från hyresrätt?") ska blockera genomgången tills de är
// BESVARADE – inte bara ha ett värde. Installningarna visar alltid ett
// konkret forval for dem (aldrig ett obesvarat), sa en sparning dar handlar
// oftast om nagot helt annat. Sparar nagon dar fore genomgangen nagonsin
// korts far forvalet darfor ALDRIG tystas ned som ett bekraftat svar.
//
// Sedan 2026-09-30 ligger forsta agaren och ombildningen bredvid varandra i
// kortet Forvarvet. Det skriver aldrig bostadsfragor_besvarade – flaggan satts
// bara fran genomgangens Bostadsfragor.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  bostadUpdate: vi.fn(),
  medlemskapUpdateMany: vi.fn(),
  medlemskapFindMany: vi.fn(),
  inbjudanFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const klient = {
    bostad: { findUniqueOrThrow: h.bostadFindUniqueOrThrow, update: h.bostadUpdate },
    medlemskap: { updateMany: h.medlemskapUpdateMany, findMany: h.medlemskapFindMany },
    inbjudan: { findMany: h.inbjudanFindMany },
  };
  return { prisma: { ...klient, $transaction: (fn: (k: typeof klient) => unknown) => fn(klient) } };
});

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({
    anvandareId: ANVANDARE,
    bostadId: BOSTAD,
    agarandel: 100,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

/** Standard: en ensam agare pa 100 %, inga utestaende inbjudningar. */
function ensamAgare() {
  h.medlemskapFindMany.mockResolvedValue([
    { agarandel: 100, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
  ]);
  h.inbjudanFindMany.mockResolvedValue([]);
}

import { sparaForvarvet } from "@/app/installningar/actions";

function formulardata(varden: Record<string, string>): FormData {
  const data = new FormData();
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
  ensamAgare();
});

describe("bostadsfragor_besvarade satts aldrig fran installningarna", () => {
  it("Forvarvet sparar forsta agaren men ror aldrig flaggan", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "", forsta_agare: "nej" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBe(false);
    expect(data).not.toHaveProperty("bostadsfragor_besvarade");
  });

  it("Forvarvet sparar ombildningen men ror aldrig flaggan", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "", forsta_agare: "ja", ombildning: "nej" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBe(true);
    expect(data.ombildning_fran_hyresratt).toBe(false);
    expect(data).not.toHaveProperty("bostadsfragor_besvarade");
  });
});
