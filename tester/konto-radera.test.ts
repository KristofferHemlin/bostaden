import { beforeEach, describe, expect, it, vi } from "vitest";

// Kontoraderingen (produktspec avsnitt 14, "Kontoradering"; CLAUDE.md;
// docs/design.md, "Samagande – medlemskapet"). Ordningen ar bindande:
// databasposterna forst, i en transaktion som ocksa avgor vad som ar
// anvandarens ensamt; filerna forst nar den lyckats; sist kontot i Supabase
// Auth. Misslyckas ett steg ska det synas, inte fortsatta tyst. Delade
// bostader ror funktionen aldrig – och gar nagon med under tiden faller
// transaktionen innan en enda fil tagits bort.

const h = vi.hoisted(() => ({
  medlemskapFindMany: vi.fn(),
  medlemskapCount: vi.fn(),
  bilagaFindMany: vi.fn(),
  bostadDeleteMany: vi.fn(),
  anvandareDelete: vi.fn(),
  transaktion: vi.fn(),
  remove: vi.fn(),
  deleteUser: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    medlemskap: { findMany: h.medlemskapFindMany, count: h.medlemskapCount },
    bilaga: { findMany: h.bilagaFindMany },
    bostad: { deleteMany: h.bostadDeleteMany },
    anvandare: { delete: h.anvandareDelete },
  };
  return {
    prisma: {
      $transaction: (fn: (t: typeof tx) => unknown, opts: unknown) => {
        h.transaktion(opts);
        return fn(tx);
      },
    },
  };
});
vi.mock("@/lib/lagring/klient", () => ({
  bilagelager: () => ({ remove: h.remove }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: h.deleteUser } } }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: h.captureException }));

import { raderaKonto } from "@/lib/konto/radera";

const ANVANDARE = "33333333-3333-3333-3333-333333333333";
const BOSTAD_EGEN = "11111111-1111-1111-1111-111111111111";
const BOSTAD_DELAD = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  h.remove.mockResolvedValue({ error: null });
  h.deleteUser.mockResolvedValue({ error: null });
  h.bostadDeleteMany.mockResolvedValue({ count: 1 });
  h.anvandareDelete.mockResolvedValue({ id: ANVANDARE });
});

describe("raderaKonto – ensam agare av bostaden", () => {
  beforeEach(() => {
    h.medlemskapFindMany.mockResolvedValue([{ bostad_id: BOSTAD_EGEN }]);
    h.medlemskapCount.mockResolvedValue(1);
    h.bilagaFindMany.mockResolvedValue([
      { lagringsnyckel: "a", miniatyrnyckel: "a-mini", visningsnyckel: null },
      { lagringsnyckel: "b", miniatyrnyckel: null, visningsnyckel: "b-vis" },
    ]);
  });

  it("tar bort databasposterna, sedan filerna, sedan kontot – i den ordningen", async () => {
    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat).toEqual({ ok: true });
    expect(h.transaktion).toHaveBeenCalledWith({ isolationLevel: "Serializable" });
    expect(h.bostadDeleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: [BOSTAD_EGEN] },
        medlemskap: { every: { anvandare_id: ANVANDARE } },
      },
    });
    expect(h.anvandareDelete).toHaveBeenCalledWith({ where: { id: ANVANDARE } });
    expect(h.remove).toHaveBeenCalledWith(["a", "a-mini", "b", "b-vis"]);
    expect(h.deleteUser).toHaveBeenCalledWith(ANVANDARE);

    const bostadOrdning = h.bostadDeleteMany.mock.invocationCallOrder[0];
    const anvandareOrdning = h.anvandareDelete.mock.invocationCallOrder[0];
    const removeOrdning = h.remove.mock.invocationCallOrder[0];
    const kontoOrdning = h.deleteUser.mock.invocationCallOrder[0];
    expect(bostadOrdning).toBeLessThan(removeOrdning);
    expect(anvandareOrdning).toBeLessThan(removeOrdning);
    expect(removeOrdning).toBeLessThan(kontoOrdning);
  });

  it("gar nagon med under tiden: transaktionen faller och ingen fil rors", async () => {
    // Raderingens eget villkor traffar inte bostaden – den har fatt en medlem till.
    h.bostadDeleteMany.mockResolvedValue({ count: 0 });

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("databas");
    expect(h.anvandareDelete).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("stannar och sager ifran nar databasen inte svarar – ingen fil och inget konto rors", async () => {
    h.anvandareDelete.mockRejectedValue(new Error("databasen svarar inte"));

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("databas");
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("stannar och sager ifran nar filerna inte gar att ta bort – Auth-kontot rors inte", async () => {
    h.remove.mockResolvedValue({ error: { message: "nere" } });

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("lagring");
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("sager ifran nar Auth-kontot inte gar att stanga", async () => {
    h.deleteUser.mockResolvedValue({ error: { message: "kunde inte" } });

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("konto");
    expect(h.bostadDeleteMany).toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalled();
  });
});

describe("raderaKonto – delad bostad", () => {
  it("raderar bara den egna medlemskapsraden; bostaden, kostnaderna och bilagorna ror den aldrig", async () => {
    h.medlemskapFindMany.mockResolvedValue([{ bostad_id: BOSTAD_DELAD }]);
    h.medlemskapCount.mockResolvedValue(2);

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat).toEqual({ ok: true });
    expect(h.bilagaFindMany).not.toHaveBeenCalled();
    expect(h.bostadDeleteMany).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.anvandareDelete).toHaveBeenCalledWith({ where: { id: ANVANDARE } });
    expect(h.deleteUser).toHaveBeenCalledWith(ANVANDARE);
  });
});
