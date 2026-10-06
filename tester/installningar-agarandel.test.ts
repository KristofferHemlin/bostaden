import { beforeEach, describe, expect, it, vi } from "vitest";

// Servern nekar ett ogiltigt agarandelsvarde precis som granssnittet
// (docs/produktspec.md 4.7, CLAUDE.md "Samma kontroll pa servern som i
// granssnittet"). Agarandelen ligger pa kortet Forvarvet (docs/design.md,
// "Installningssidan"). I en delad bostad provas den dessutom mot de andras:
// en andring som tar summan over 100 % avvisas.

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

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    tilltradesdatum: "2018-06-01",
    agarandel: "",
    forsta_agare: "nej",
    ...over,
  };
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

describe("agarandel valideras aven pa servern", () => {
  it("avvisar 1000 – det klassiska skrivfelet som skulle gora avdraget tio ganger for stort", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "1000" }));

    expect(resultat.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("avvisar noll", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "0" }));

    expect(resultat.fel).toBeTruthy();
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("sparar ett giltigt decimalvarde", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "33,33" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.medlemskapUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agarandel: 33.33 } }),
    );
  });

  it("tolkar ett tomt falt som hela bostaden, 100", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.medlemskapUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agarandel: 100 } }),
    );
  });
});

describe("summan av andelarna i en delad bostad", () => {
  beforeEach(() => {
    h.medlemskapFindMany.mockResolvedValue([
      { agarandel: 50, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
      { agarandel: 50, anvandare: { id: "33333333-3333-3333-3333-333333333333", epost: "doris@exempel.se" } },
    ]);
  });

  it("avvisar en egen andel som skulle ta summan over 100 %", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "60" }));

    expect(resultat.fel).toContain("110");
    expect(h.bostadUpdate).not.toHaveBeenCalled();
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("raknar in en utestaende inbjudans reserverade andel", async () => {
    h.medlemskapFindMany.mockResolvedValue([
      { agarandel: 50, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
    ]);
    h.inbjudanFindMany.mockResolvedValue([{ id: "i", epost: "doris@exempel.se", agarandel: 50 }]);

    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "" }));

    expect(resultat.fel).toContain("150");
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("tillater en summa under 100 %", async () => {
    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "25" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.medlemskapUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agarandel: 25 } }),
    );
  });

  it("tillater att en for hog summa sanks, aven om den inte hinner under 100 % i ett steg", async () => {
    // Tva medlemmar fran innan andelen fragades vid inbjudan: 100 + 100.
    h.medlemskapFindMany.mockResolvedValue([
      { agarandel: 100, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
      { agarandel: 100, anvandare: { id: "33333333-3333-3333-3333-333333333333", epost: "doris@exempel.se" } },
    ]);

    const resultat = await sparaForvarvet({}, formulardata({ agarandel: "50" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.medlemskapUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agarandel: 50 } }),
    );
  });
});
