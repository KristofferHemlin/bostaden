import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Storleken i kortet Bostaden (docs/design.md, "Installningssidan"). Till
// 2026-11-09 tog tolkningen bort allt som inte var en siffra, sa "72,5"
// sparades som 725 m² och "72 m2" som 722. Faltet tar nu ett positivt tal med
// hogst en decimal; komma och punkt ar decimaltecken, mellanslag
// tusentalsavgransare. Kolumnen ar numeric(6,1).

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

// Avvisningens lydelse, ur docs/design.md ("Inställningssidan"). Lases inne
// i testet, aldrig pa modulniva: en omskriven mening ska falla ett test, inte
// hela filen (CLAUDE.md, "Tester").
function avvisad(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Lydelsen när fältet avvisar:\*\*\n\n> \*"([^"]+)"\*/);
  if (!m) throw new Error("design.md saknar lydelsen nar storleksfaltet avvisar");
  return m[1]!;
}

const TAS_EMOT: [string, string][] = [
  ["36", "36"],
  ["36,5", "36.5"],
  ["36.5", "36.5"],
  ["1 200", "1200"],
];
const AVVISAS = ["-3", "0", "35,23", "kkgkg", "72 m2", "ca 72"];

describe("storleken tar ett positivt tal med hogst en decimal", () => {
  it.each(TAS_EMOT)("%s tas emot och sparas som %s", async (text, sparat) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat.fel).toBeUndefined();
    expect(String(h.bostadUpdate.mock.calls[0]?.[0].data.storlek)).toBe(sparat);
  });

  it.each(AVVISAS)("%s avvisas vid faltet och sparas inte", async (text) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat).toEqual({ fel: avvisad(), falt: "storlek" });
    expect(h.bostadUpdate).not.toHaveBeenCalled();
  });

  // Raderna ovan ar tabellen i docs/design.md ("Inställningssidan"). Lases
  // inne i testet, aldrig pa modulniva (CLAUDE.md, "Tester").
  it("raderna ar desamma som tabellen i design.md", () => {
    const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
    const rad = design.match(/\| Tas emot \| Avvisas \|\n\|---\|---\|\n\| ([^|]+) \| ([^|]+) \|/);
    if (!rad) throw new Error("design.md saknar tabellen Tas emot | Avvisas");
    const lista = (cell: string) => [...cell.matchAll(/`([^`]*)`/g)].map((m) => m[1]);
    expect(lista(rad[1]!)).toEqual(TAS_EMOT.map(([text]) => text));
    expect(lista(rad[2]!)).toEqual(AVVISAS);
  });

  it.each(["0,0", "36,", ",5", "12 00", "100000"])("%s avvisas ocksa", async (text) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat).toEqual({ fel: avvisad(), falt: "storlek" });
  });

  it.each([
    [" 72 ", "72"],
    ["1\u00a0200,5", "1200.5"],
    ["99 999,9", "99999.9"],
  ])("%j sparas som %s", async (text, sparat) => {
    const resultat = await sparaBostaden({}, formulardata(text));
    expect(resultat.fel).toBeUndefined();
    expect(String(h.bostadUpdate.mock.calls[0]?.[0].data.storlek)).toBe(sparat);
  });

  it("ett tomt falt sparas som null", async () => {
    await sparaBostaden({}, formulardata(""));
    expect(h.bostadUpdate.mock.calls[0]?.[0].data.storlek).toBeNull();
  });
});
