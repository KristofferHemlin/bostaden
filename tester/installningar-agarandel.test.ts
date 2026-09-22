import { beforeEach, describe, expect, it, vi } from "vitest";

// Servern nekar ett ogiltigt agarandelsvarde precis som granssnittet
// (docs/produktspec.md 4.7, CLAUDE.md "Samma kontroll pa servern som i
// granssnittet"). Agarandelen ligger pa kortet Agandet (docs/design.md,
// "Installningssidan").

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  bostadUpdate: vi.fn(),
  medlemskapUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: {
      findUniqueOrThrow: h.bostadFindUniqueOrThrow,
      update: h.bostadUpdate,
    },
    medlemskap: { updateMany: h.medlemskapUpdateMany },
  },
}));

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

import { sparaAgandet } from "@/app/installningar/actions";

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    agarandel: "",
    forsta_agare: "nej",
    ombildning: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadFindUniqueOrThrow.mockResolvedValue({ bostadsfragor_besvarade: false });
  h.bostadUpdate.mockResolvedValue({});
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
});

describe("agarandel valideras aven pa servern", () => {
  it("avvisar 1000 – det klassiska skrivfelet som skulle gora avdraget tio ganger for stort", async () => {
    const resultat = await sparaAgandet({}, formulardata({ agarandel: "1000" }));

    expect(resultat.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("avvisar noll", async () => {
    const resultat = await sparaAgandet({}, formulardata({ agarandel: "0" }));

    expect(resultat.fel).toBeTruthy();
    expect(h.medlemskapUpdateMany).not.toHaveBeenCalled();
  });

  it("sparar ett giltigt decimalvarde", async () => {
    const resultat = await sparaAgandet({}, formulardata({ agarandel: "33,33" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.medlemskapUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agarandel: 33.33 } }),
    );
  });

  it("tolkar ett tomt falt som hela bostaden, 100", async () => {
    const resultat = await sparaAgandet({}, formulardata({ agarandel: "" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.medlemskapUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { agarandel: 100 } }),
    );
  });
});
