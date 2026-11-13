// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Projektlistan ar vagen in (docs/design.md, "Projektlistan"): primarknappen
// heter Skapa projekt och star bade i listan och i det tomma tillstandet. Till
// 2026-11-13 hade sidan ingen knapp alls, och tomlaget en textlank till
// genomgangen.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return { db: skapaFalskDatabas(), inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/projekt",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import ProjektlistaSida from "@/app/projekt/page";

const ANNA = "a0000000-0000-4000-8000-0000000000c1";
const X = "b0000000-0000-4000-8000-0000000000c1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda(medProjekt: boolean) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "bostadsratt",
    tilltradesdatum: datum("2021-03-01"), nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  if (medProjekt) {
    db.lagg("projekt", { bostad_id: X, namn: "Ny altan", ar: 2025, atgardstyp: "nybyggnad" });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Lankarna vars hela text ar `text`, med sina mal. */
async function lankar(text: string): Promise<string[]> {
  const behallare = document.createElement("div");
  behallare.innerHTML = renderToStaticMarkup(await ProjektlistaSida());
  return [...behallare.querySelectorAll("main a")]
    .filter((a) => a.textContent === text)
    .map((a) => a.getAttribute("href")!);
}

describe("Skapa projekt på projektlistan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("står i det tomma tillståndet", async () => {
    seeda(false);
    expect(await lankar("Skapa projekt")).toEqual(["/projekt/nytt"]);
  });

  it("står i listan", async () => {
    seeda(true);
    expect(await lankar("Ny altan")).toHaveLength(1);
    expect(await lankar("Skapa projekt")).toEqual(["/projekt/nytt"]);
  });
});
