import { beforeEach, describe, expect, it, vi } from "vitest";

// Kortet Kopet (docs/design.md, "Installningssidan"): kopeskilling,
// kopkostnader, kapitaltillskott, storlek. Kapitaltillskott finns bara for
// bostadsratt (produktspec 4.8) – sparaKopet lasker den AKTUELLA
// upplatelseformen ur databasen sjalv (aldrig ett dolt falt fran ett annat
// kort) och nollstaller kapitaltillskott for en fastighet, oavsett vad
// formularet skulle raka skicka med.

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

import { sparaKopet } from "@/app/installningar/actions";

function formulardata(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const varden: Record<string, string> = {
    storlek: "",
    kopeskilling: "",
    kopkostnader: "",
    kapitaltillskott: "",
    ...over,
  };
  for (const [nyckel, varde] of Object.entries(varden)) data.set(nyckel, varde);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.bostadUpdate.mockResolvedValue({});
});

describe("kapitaltillskott foljer den aktuella upplatelseformen", () => {
  it("sparas som null for en fastighet, aven om ett belopp skickades med", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "fastighet" });

    const resultat = await sparaKopet(
      {},
      formulardata({ kapitaltillskott: "60 000" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kapitaltillskott: null }),
      }),
    );
  });

  it("sparas som det angivna beloppet for en bostadsratt", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "bostadsratt" });

    const resultat = await sparaKopet(
      {},
      formulardata({ kapitaltillskott: "60 000" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kapitaltillskott: 6_000_000n }),
      }),
    );
  });

  it("ett otolkbart kapitaltillskott avvisas for en bostadsratt", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "bostadsratt" });

    const resultat = await sparaKopet(
      {},
      formulardata({ kapitaltillskott: "hej" }),
    );

    expect(resultat.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });
});

describe("kopeskilling, kopkostnader och storlek", () => {
  it("sparar giltiga belopp och en giltig storlek", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "fastighet" });

    const resultat = await sparaKopet(
      {},
      formulardata({ kopeskilling: "3 250 000", kopkostnader: "45 000", storlek: "72" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kopeskilling: 325_000_000n,
          kopkostnader: 4_500_000n,
          storlek: 72,
        }),
      }),
    );
  });

  it("tomma falt sparas som null", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ upplatelseform: "fastighet" });

    const resultat = await sparaKopet({}, formulardata());

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kopeskilling: null,
          kopkostnader: null,
          storlek: null,
        }),
      }),
    );
  });

  it("avvisar en otolkbar kopeskilling", async () => {
    const resultat = await sparaKopet({}, formulardata({ kopeskilling: "typ tre miljoner" }));

    expect(resultat.fel).toBeTruthy();
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });
});
