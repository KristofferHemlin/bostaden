import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// docs/design.md, "Projektlistan": raden "Räknas som" utelamnas helt tills
// fragorna ar besvarade. Faltet rymmer en kategori; att fylla det med ett
// tillstand ("Väntar på frågor") ar samma sammanblandning som forbjuds pa
// kvittoraderna. Att svaren saknas sags redan av meddelandet pa sidan.

const BOSTAD = "11111111-1111-4111-8111-111111111111";
const ANVANDARE = "22222222-2222-4222-8222-222222222222";
const PROJEKT = "33333333-3333-4333-8333-333333333333";

const h = vi.hoisted(() => ({
  projektFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projekt: { findFirst: h.projektFindFirst },
    bostad: {
      findUniqueOrThrow: vi.fn(async () => ({
        adress: "Storgatan 1",
        upplatelseform: "bostadsratt",
      })),
    },
    kostnad: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("@/lib/session", () => ({
  kravBostad: vi.fn(async () => ({ anvandareId: ANVANDARE, bostadId: BOSTAD, agarandel: 100 })),
  antalMedlemmar: vi.fn(async () => 1),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
  usePathname: () => `/projekt/${PROJEKT}`,
}));

import ProjektSida from "@/app/projekt/[id]/page";

function projektRad(over: Record<string, unknown>) {
  return {
    id: PROJEKT,
    bostad_id: BOSTAD,
    namn: "Måla sovrum",
    ar: 2026,
    atgardstyp: null,
    battre_kvalitet: null,
    merkostnad: null,
    skick_forvarv: null,
    skick_forsaljning: null,
    motivering: null,
    klassificerare: null,
    ...over,
  };
}

async function rendera(): Promise<string> {
  const element = await ProjektSida({ params: Promise.resolve({ id: PROJEKT }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  h.projektFindFirst.mockReset();
});

describe("Räknas som pa projektets sida", () => {
  it("utelamnas for ett projekt vars fragor inte ar besvarade", async () => {
    h.projektFindFirst.mockResolvedValue(projektRad({}));
    const html = await rendera();
    expect(html).not.toContain("Räknas som");
    expect(html).not.toContain("Väntar på frågor");
    // Att svaren saknas sags av meddelandet, och vagen dit finns.
    expect(html).toContain("Frågorna om det här är inte besvarade än.");
    expect(html).toContain("Svara på frågorna");
  });

  it("visas med kategorin nar fragorna ar besvarade", async () => {
    h.projektFindFirst.mockResolvedValue(projektRad({ atgardstyp: "nybyggnad" }));
    const html = await rendera();
    expect(html).toMatch(/Räknas som<\/span>.*Grundförbättring/);
    expect(html).not.toContain("Frågorna om det här är inte besvarade än.");
  });
});
