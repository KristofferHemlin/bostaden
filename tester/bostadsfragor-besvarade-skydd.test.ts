import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/produktspec.md 4.1: bostadsfragorna ("Var du första ägaren?",
// "Ombildning från hyresrätt?") ska blockera genomgången tills de är
// BESVARADE – inte bara ha ett värde.
//
// Ett aktivt val ar ett svar, var det an gors. Genomgangen lovar att svaren
// kan andras i installningarna, sa kortet Forvarvet skriver dem efter samma
// villkor som genomgangen (src/doman/bostadsfragor.ts). Forvarvet visar inget
// forval for en obesvarad fraga, och ett tomt val skriver ingenting – en
// sparning av nagot helt annat far aldrig tystas ned som ett svar.
//
// Kolumnerna ar nullbara sedan 2026-10-28, och flaggan bostadsfragor_besvarade
// ar borta: ett skrivet false ar svaret, ett oskrivet falt ar obesvarat.
// Andelsfaltet bar ett riktigt tal – det ar inte det som provas har.

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
  // sparaForvarvet laser upplatelseformen – den avgor om ombildningen fragas.
  h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "bostadsratt" });
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
  ensamAgare();
});

describe("Forvarvet skriver bostadsfragorna efter samma villkor som genomgangen", () => {
  it("ett obesvarat forsta agaren skriver ingenting – kolumnen forblir null", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "100", forsta_agare: "" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("nybyggd_vid_forvarv");
    expect(data).not.toHaveProperty("ombildning_fran_hyresratt");
  });

  it("nej ar ett fullstandigt svar och skrivs som false", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "100", forsta_agare: "nej" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBe(false);
  });

  it("ja med ombildningssvar skriver bada", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "100", forsta_agare: "ja", ombildning: "nej" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBe(true);
    expect(data.ombildning_fran_hyresratt).toBe(false);
  });

  it("ja utan ombildningssvar avvisas och ingenting sparas", async () => {
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "100", forsta_agare: "ja", ombildning: "" }),
    );

    expect(resultat.fel).toContain("ombildning");
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  it("for en fastighet ar ja ett fullstandigt svar – ombildningen fragas inte", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "fastighet" });
    const resultat = await sparaForvarvet(
      {},
      formulardata({ tilltradesdatum: "2018-06-01", agarandel: "100", forsta_agare: "ja", ombildning: "" }),
    );

    expect(resultat.fel).toBeUndefined();
    const data = h.bostadUpdate.mock.calls[0][0].data;
    expect(data.nybyggd_vid_forvarv).toBe(true);
    expect(data).not.toHaveProperty("ombildning_fran_hyresratt");
  });
});
