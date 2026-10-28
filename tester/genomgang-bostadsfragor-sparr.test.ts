import { describe, expect, it, vi } from "vitest";

// Genomgangens spärr, provad pa sidan som renderas (CLAUDE.md, testlistan):
//
// - "Obesvarad nybyggd_vid_forvarv blockerar genomgangen; ett besvarat nej
//   gor det inte. Testet ska skilja de tva, inte bara prova att nagot
//   blockerar."
// - "Obesvarad ombildning_fran_hyresratt blockerar nar bostaden ar en
//   bostadsratt och forsta agaren ar ja, men inte annars."
//
// Spärren hanger pa faltvardena sedan flaggan bostadsfragor_besvarade togs
// bort 2026-10-28: null ar obesvarat, false ar ett svar.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/genomgang",
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GenomgangSida from "@/app/genomgang/page";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";

/** Fragan som bara star pa sidan nar spärren slar till. */
const FORSTA_AGAREN = "Var du första ägaren av bostaden?";

async function genomgang(bostad: {
  upplatelseform: "bostadsratt" | "fastighet";
  nybyggd_vid_forvarv: boolean | null;
  ombildning_fran_hyresratt: boolean | null;
}): Promise<string> {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", { id: X, adress: "Storgatan 1", tilltradesdatum: new Date("2019-06-01T00:00:00.000Z"), ...bostad });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  return renderToStaticMarkup((await GenomgangSida()) as ReactElement);
}

describe("forsta agaren: obesvarat blockerar, ett besvarat nej gor det inte", () => {
  it("null: genomgangen visar bostadsfragorna", async () => {
    const html = await genomgang({ upplatelseform: "fastighet", nybyggd_vid_forvarv: null, ombildning_fran_hyresratt: null });
    expect(html).toContain(FORSTA_AGAREN);
  });

  it("nej: genomgangen gar vidare", async () => {
    const html = await genomgang({ upplatelseform: "fastighet", nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: null });
    expect(html).not.toContain(FORSTA_AGAREN);
  });
});

describe("ombildningen: blockerar bara for en bostadsratt dar forsta agaren ar ja", () => {
  it("bostadsratt, ja, ombildningen null: blockerar", async () => {
    const html = await genomgang({ upplatelseform: "bostadsratt", nybyggd_vid_forvarv: true, ombildning_fran_hyresratt: null });
    expect(html).toContain(FORSTA_AGAREN);
  });

  it("bostadsratt, ja, ombildningen nej: gar vidare", async () => {
    const html = await genomgang({ upplatelseform: "bostadsratt", nybyggd_vid_forvarv: true, ombildning_fran_hyresratt: false });
    expect(html).not.toContain(FORSTA_AGAREN);
  });

  it("bostadsratt, nej, ombildningen null: gar vidare – fragan stalls inte", async () => {
    const html = await genomgang({ upplatelseform: "bostadsratt", nybyggd_vid_forvarv: false, ombildning_fran_hyresratt: null });
    expect(html).not.toContain(FORSTA_AGAREN);
  });

  it("fastighet, ja, ombildningen null: gar vidare – fragan stalls inte", async () => {
    const html = await genomgang({ upplatelseform: "fastighet", nybyggd_vid_forvarv: true, ombildning_fran_hyresratt: null });
    expect(html).not.toContain(FORSTA_AGAREN);
  });
});
