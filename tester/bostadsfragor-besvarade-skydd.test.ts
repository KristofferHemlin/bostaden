import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/produktspec.md 4.1: bostadsfragorna ("Var du första ägaren?",
// "Ombildning från hyresrätt?") ska blockera genomgången tills de är
// BESVARADE – inte bara ha ett värde. Kortet Agandet (docs/design.md,
// "Installningssidan") visar alltid ett konkret forval for dessa tva falt
// (aldrig ett obesvarat forval), sa en sparning dar handlar oftast om nagot
// helt annat (t.ex. agarandelen). Sparar nagon dit fore genomgangen nagonsin
// korts far forvalet ("nej") darfor ALDRIG tystas ned som ett bekraftat svar
// – annars later en obesvarad bostad genomgangens blockerande steg passera i
// onodan, och en felaktig nybyggd_vid_forvarv paverkar reparationsdelen
// direkt. Samma mockningsmonster som installningar-agarandel.test.ts.

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
  h.bostadUpdate.mockResolvedValue({});
  h.medlemskapUpdateMany.mockResolvedValue({ count: 1 });
});

describe("bostadsfragor_besvarade satts aldrig av en vanlig Agandet-sparning", () => {
  it("forblir false nar bostaden aldrig gatt igenom bostadsfragorna, aven om formuläret skickar konkreta svar", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ bostadsfragor_besvarade: false });

    const resultat = await sparaAgandet({}, formulardata({ forsta_agare: "nej" }));

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bostadsfragor_besvarade: false }),
      }),
    );
  });

  it("forblir true nar bostaden redan svarat, och andra falt gar fortfarande att spara", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue({ bostadsfragor_besvarade: true });

    const resultat = await sparaAgandet(
      {},
      formulardata({ forsta_agare: "ja", ombildning: "nej" }),
    );

    expect(resultat.fel).toBeUndefined();
    expect(h.bostadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bostadsfragor_besvarade: true,
          nybyggd_vid_forvarv: true,
          ombildning_fran_hyresratt: false,
        }),
      }),
    );
  });
});
