import { beforeEach, describe, expect, it, vi } from "vitest";

// Nollan i filnamnet uppstod har, inte i namngivningen: hamtaArkivlista gav
// ett utkast beloppet 0 innan namnet byggdes, och utkastets bilaga hette
// "0 kr.jpg" i arkivet (docs/design.md, Skarmuppbyggnad: "Filnamnen i
// zip-arkivet hittar inte pa det som saknas").

const h = vi.hoisted(() => ({
  bilagaFindMany: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { bilaga: { findMany: h.bilagaFindMany } } }));
vi.mock("@/lib/lagring/klient", () => ({
  bilagelager: () => ({ createSignedUrls: h.createSignedUrls }),
}));

import { hamtaArkivlista } from "@/lib/arkivexport/hamta";

function bilaga(id: string, kostnad: { totalbelopp: number | null; leverantor?: string | null; betaldatum?: Date | null }) {
  return {
    id,
    lagringsnyckel: `b/k/${id}.jpg`,
    filnamn: `${id}.jpg`,
    mimetyp: "image/jpeg",
    kostnad: {
      betaldatum: kostnad.betaldatum ?? null,
      leverantor: kostnad.leverantor ?? null,
      anteckning: null,
      totalbelopp: kostnad.totalbelopp,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.createSignedUrls.mockImplementation(async (nycklar: string[]) => ({
    data: nycklar.map((n) => ({ signedUrl: `https://lager/${n}` })),
    error: null,
  }));
});

describe("hamtaArkivlista med utkast", () => {
  it("ger ett utkast utan belopp ett filnamn utan belopp – aldrig '0 kr'", async () => {
    h.bilagaFindMany.mockResolvedValue([
      bilaga("a", { totalbelopp: null }),
      bilaga("b", { totalbelopp: null }),
      bilaga("c", { totalbelopp: 24890, leverantor: "BAUHAUS", betaldatum: new Date("2026-04-18") }),
    ]);
    const lista = await hamtaArkivlista("bostad");
    if (!lista.ok) throw new Error(lista.fel);
    const sokvagar = lista.filer.map((f) => f.sokvag);
    expect(sokvagar.slice(0, 2)).toEqual(["utan-datum/Utkast.jpg", "utan-datum/Utkast-2.jpg"]);
    for (const s of sokvagar.slice(0, 2)) expect(s).not.toMatch(/0\skr/);
    expect(sokvagar[2]).toMatch(/^2026\/2026-04-18 BAUHAUS 248,90\skr\.jpg$/);
  });
});
