import { beforeEach, describe, expect, it, vi } from "vitest";

// Storleken i kortet Bostaden (docs/design.md, "Installningssidan":
// "Storleken får aldrig tiodubblas tyst"). Till 2026-11-09 tog tolkningen
// bort allt som inte var en siffra, sa "72,5" sparades som 725 m². Tills
// faltet tar decimaler avvisas de med ett besked – ingen migrering, storleken
// lases inte av nagonting.

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
  kravBostad: vi.fn(async () => ({ anvandareId: ANVANDARE, bostadId: BOSTAD, agarandel: 100 })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { sparaBostaden } from "@/app/installningar/actions";

function formulardata(storlek: string): FormData {
  const data = new FormData();
  data.set("upplatelseform", "fastighet");
  data.set("adress", "Storgatan 1");
  data.set("storlek", storlek);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
  h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "fastighet", forsaljningsdatum: null });
  h.medlemskapFindMany.mockResolvedValue([
    { agarandel: 100, anvandare: { id: ANVANDARE, epost: "anna@exempel.se" } },
  ]);
  h.inbjudanFindMany.mockResolvedValue([]);
});

describe("storleken tar hela kvadratmeter", () => {
  // Lydelsen star inte citerad i docs/design.md – bara att beskedet ska saga
  // att faltet tar hela kvadratmeter. Det ar det som provas.
  it.each(["72,5", "72.5", "72,0"])("%s avvisas med beskedet om hela kvadratmeter och sparas inte", async (text) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat.falt).toBe("storlek");
    expect(resultat.fel).toMatch(/hela kvadratmeter/);
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  it.each(["72 m2", "ca 72", "72kvm"])("%s avvisas i stallet for att bli ett annat tal", async (text) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat.falt).toBe("storlek");
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["72", 72],
    [" 72 ", 72],
    ["1 200", 1200],
  ])("%s sparas som %i", async (text, varde) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate.mock.calls[0]?.[0].data.storlek).toBe(varde);
  });

  it("ett tomt falt sparas som null", async () => {
    await sparaBostaden({}, formulardata(""));
    expect(h.bostadUpdate.mock.calls[0]?.[0].data.storlek).toBeNull();
  });
});
