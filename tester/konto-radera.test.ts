import { beforeEach, describe, expect, it, vi } from "vitest";

// Kontoraderingen (produktspec avsnitt 14, "Kontoradering"; CLAUDE.md).
// Ordningen ar bindande: filerna forst, sedan databasposterna, sedan kontot i
// Supabase Auth – och misslyckas ett steg ska det synas, inte fortsatta tyst.
// Delade bostader (fler an ett medlemskap) ska lamnas orort; bara den egna
// medlemskapsraden forsvinner, via cascaden nar anvandarraden tas bort.

const h = vi.hoisted(() => ({
  medlemskapFindMany: vi.fn(),
  medlemskapCount: vi.fn(),
  bilagaFindMany: vi.fn(),
  bostadDeleteMany: vi.fn(),
  anvandareDelete: vi.fn(),
  remove: vi.fn(),
  deleteUser: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    medlemskap: { findMany: h.medlemskapFindMany, count: h.medlemskapCount },
    bilaga: { findMany: h.bilagaFindMany },
    bostad: { deleteMany: h.bostadDeleteMany },
    anvandare: { delete: h.anvandareDelete },
  },
}));
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

  it("tar bort filerna, bostaden och kontot – i den ordningen", async () => {
    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat).toEqual({ ok: true });
    expect(h.remove).toHaveBeenCalledWith(["a", "a-mini", "b", "b-vis"]);
    expect(h.bostadDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: [BOSTAD_EGEN] } },
    });
    expect(h.anvandareDelete).toHaveBeenCalledWith({ where: { id: ANVANDARE } });
    expect(h.deleteUser).toHaveBeenCalledWith(ANVANDARE);

    // Ordningen: filerna fore databasen fore Auth-kontot.
    const removeOrdning = h.remove.mock.invocationCallOrder[0];
    const bostadOrdning = h.bostadDeleteMany.mock.invocationCallOrder[0];
    const kontoOrdning = h.deleteUser.mock.invocationCallOrder[0];
    expect(removeOrdning).toBeLessThan(bostadOrdning);
    expect(bostadOrdning).toBeLessThan(kontoOrdning);
  });

  it("stannar och sager ifran nar filerna inte gar att ta bort – databasen ror aldrig", async () => {
    h.remove.mockResolvedValue({ error: { message: "nere" } });

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("lagring");
    expect(h.bostadDeleteMany).not.toHaveBeenCalled();
    expect(h.anvandareDelete).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("stannar och sager ifran nar databasposterna inte gar att radera – Auth-kontot ror aldrig", async () => {
    h.anvandareDelete.mockRejectedValue(new Error("databasen svarar inte"));

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("databas");
    expect(h.remove).toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("sager ifran nar Auth-kontot inte gar att stanga, aven om filer och databas redan ar borta", async () => {
    h.deleteUser.mockResolvedValue({ error: { message: "kunde inte" } });

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.steg).toBe("konto");
    expect(h.bostadDeleteMany).toHaveBeenCalled();
    expect(h.anvandareDelete).toHaveBeenCalled();
  });
});

describe("raderaKonto – delad bostad", () => {
  it("raderar bara den egna medlemskapsraden; bostaden, kostnaderna och bilagorna ror den aldrig", async () => {
    h.medlemskapFindMany.mockResolvedValue([{ bostad_id: BOSTAD_DELAD }]);
    h.medlemskapCount.mockResolvedValue(2); // en till medlem pa samma bostad

    const resultat = await raderaKonto(ANVANDARE);

    expect(resultat).toEqual({ ok: true });
    // Ingen bilagelista slogs upp och Storage-remove korde aldrig, eftersom
    // bostaden inte ar helt anvandarens.
    expect(h.bilagaFindMany).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.bostadDeleteMany).not.toHaveBeenCalled();
    // Anvandarraden tas anda bort – det ar den som cascadar bort just DEN har
    // personens medlemskapsrad utan att röra bostaden.
    expect(h.anvandareDelete).toHaveBeenCalledWith({ where: { id: ANVANDARE } });
    expect(h.deleteUser).toHaveBeenCalledWith(ANVANDARE);
  });
});
