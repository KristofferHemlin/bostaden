import { beforeEach, describe, expect, it, vi } from "vitest";

// Serverns skyddsnat (src/lib/bostadsfragor-sparr.ts): klassificeraHog och
// redigeraProjekt vagrar sa lange bostadsfragorna ar obesvarade. Sidspärren
// hindrar redan vagen dit, men ett granssnitt gar att ga forbi. Spärren ger
// samma vag vidare som sidspärren – fragorna pa /genomgang/fragor – och
// ingen egen felskarm.

const BOSTAD = "11111111-1111-1111-1111-111111111111";
const ANVANDARE = "22222222-2222-2222-2222-222222222222";
const PROJEKT = "33333333-3333-3333-3333-333333333333";

const h = vi.hoisted(() => ({
  bostadFindUniqueOrThrow: vi.fn(),
  projektFindFirst: vi.fn(),
  projektUpdate: vi.fn(),
  kostnadFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bostad: { findUniqueOrThrow: h.bostadFindUniqueOrThrow },
    projekt: { findFirst: h.projektFindFirst, update: h.projektUpdate },
    kostnad: { findMany: h.kostnadFindMany },
  },
}));

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({ anvandareId: ANVANDARE, bostadId: BOSTAD })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Den riktiga redirect() kastar – det ar det som stoppar actionen.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

import { klassificeraHog } from "@/app/genomgang/fragor/actions";
import { redigeraProjekt } from "@/app/projekt/actions";

const OBESVARAD = {
  upplatelseform: "bostadsratt",
  nybyggd_vid_forvarv: false,
  ombildning_fran_hyresratt: false,
  bostadsfragor_besvarade: false,
};
const BESVARAD = { ...OBESVARAD, bostadsfragor_besvarade: true };

function klassificering(): FormData {
  const data = new FormData();
  data.set("projekt_id", PROJEKT);
  data.set("namn", "Altan");
  data.set("byggde_nytt", "ja");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.projektFindFirst.mockResolvedValue({ id: PROJEKT, atgardstyp: null, ar: 2026 });
  h.projektUpdate.mockResolvedValue({});
  h.kostnadFindMany.mockResolvedValue([]);
});

describe("klassificeraHog", () => {
  it("vagrar mot en bostad med obesvarade fragor och skickar till fragorna", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue(OBESVARAD);
    await expect(klassificeraHog({}, klassificering())).rejects.toThrow(
      "NEXT_REDIRECT /genomgang/fragor",
    );
    expect(h.projektUpdate).not.toHaveBeenCalled();
  });

  it("klassificerar nar fragorna ar besvarade", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue(BESVARAD);
    await expect(klassificeraHog({}, klassificering())).rejects.toThrow("NEXT_REDIRECT");
    expect(h.projektUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("redigeraProjekt", () => {
  it("vagrar mot en bostad med obesvarade fragor och skickar till fragorna", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue(OBESVARAD);
    await expect(redigeraProjekt({}, klassificering())).rejects.toThrow(
      "NEXT_REDIRECT /genomgang/fragor",
    );
    expect(h.projektUpdate).not.toHaveBeenCalled();
  });

  it("sparar nar fragorna ar besvarade", async () => {
    h.bostadFindUniqueOrThrow.mockResolvedValue(BESVARAD);
    await expect(redigeraProjekt({}, klassificering())).rejects.toThrow(
      `NEXT_REDIRECT /projekt/${PROJEKT}`,
    );
    expect(h.projektUpdate).toHaveBeenCalledTimes(1);
  });
});
