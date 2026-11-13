import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Att lamna installningarna leder tillbaka dit man kom ifran (docs/design.md,
// "Installningssidan"). Kugghjulet skickar med vilken flik hon stod i, och
// bakatlanken namnger fliken: "← Kvitton", "← Projekt", "← Deklaration".
// Fran oversikten visas ingen lank alls – Oversikt ar en flik
// (docs/design.md, Navigation). Fran en sida langre in leder lanken till
// fliken, inte till sidan.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
    sokvag: "/",
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
  usePathname: () => h.sokvag,
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({}),
  lagringsklient: () => ({}),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InstallningarSida from "@/app/installningar/page";
import { Installningslank, Toppnavigering } from "@/components/toppnavigering";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeEach(() => {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
  h.sokvag = "/";
});

/** Kugghjulets adress, renderad pa sokvagen. */
function kugghjuletsHref(sokvag: string): string {
  h.sokvag = sokvag;
  const html = renderToStaticMarkup(createElement(Installningslank));
  const href = html.match(/href="([^"]*)"/)?.[1];
  if (href === undefined) throw new Error("kugghjulet renderade ingen lank");
  return href.replace(/&amp;/g, "&");
}

/** Flikens namn och adress, som flikraden renderar dem – samma namn ska lanken bara. */
function flik(href: string): { href: string; text: string } {
  const html = renderToStaticMarkup(createElement(Toppnavigering));
  const lank = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].find((m) => m[1] === href);
  if (!lank) throw new Error(`flikraden har ingen flik till ${href}`);
  return { href, text: lank[2]!.replace(/<svg.*?<\/svg>/g, "") };
}

/** Installningssidans bakatlankar ("← …"), som de renderas. */
async function bakatlankar(fran: string | undefined): Promise<{ href: string; text: string }[]> {
  h.sokvag = "/installningar";
  const sida = await InstallningarSida({ searchParams: Promise.resolve(fran === undefined ? {} : { fran }) });
  const html = renderToStaticMarkup(sida);
  return [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>← (.*?)<\/a>/g)].map((m) => ({
    href: m[1]!,
    text: m[2]!.replace(/<!-- -->/g, ""),
  }));
}

describe("kugghjulet skickar med fliken hon stod i", () => {
  it.each([
    ["/kostnad", "/installningar?fran=kvitton"],
    ["/kostnad/d0000000-0000-4000-8000-000000000001", "/installningar?fran=kvitton"],
    ["/kostnad/nytt", "/installningar?fran=kvitton"],
    ["/projekt", "/installningar?fran=projekt"],
    ["/projekt/c0000000-0000-4000-8000-000000000001/redigera", "/installningar?fran=projekt"],
    ["/export", "/installningar?fran=deklaration"],
    ["/forsaljning/skick", "/installningar?fran=deklaration"],
  ])("fran %s leder kugghjulet till %s", (sokvag, href) => {
    expect(kugghjuletsHref(sokvag)).toBe(href);
  });

  it.each(["/", "/bostaden/andel", "/bostaden/fragor", "/kostnadsfri"])(
    "fran %s skickas ingen flik med",
    (sokvag) => {
      expect(kugghjuletsHref(sokvag)).toBe("/installningar");
    },
  );
});

describe("bakatlanken pa installningssidan namnger fliken", () => {
  it.each([
    ["kvitton", "/kostnad"],
    ["projekt", "/projekt"],
    ["deklaration", "/export"],
  ])("fran=%s ger en lank till %s med flikens namn", async (fran, href) => {
    expect(await bakatlankar(fran)).toEqual([flik(href)]);
  });

  it("utan fran visas ingen lank – oversikten ar en flik", async () => {
    expect(await bakatlankar(undefined)).toEqual([]);
  });

  it.each(["oversikt", "constructor", "../export", ""])("ett okant fran (%s) ger ingen lank", async (fran) => {
    expect(await bakatlankar(fran)).toEqual([]);
  });
});

// Storleken visas med decimalkomma, som hon skriver den (docs/design.md,
// "Inställningssidan"). Kolumnen ar numeric(6,1); Prisma ger en Decimal.
describe("storleken pa installningssidan", () => {
  it.each([
    ["72.5", "72,5"],
    ["36", "36"],
  ])("ett lagrat %s visas som %s m² i kortet Bostaden", async (lagrat, visat) => {
    const { Prisma } = await import("@prisma/client");
    // Raden byts direkt i tabellen: den falska databasen laser ett objekt i
    // en skrivning som en nastlad skrivning.
    const rad = h.db.tabell("bostad").find((b) => b.id === X);
    if (!rad) throw new Error("bostaden finns inte i den falska databasen");
    rad.storlek = new Prisma.Decimal(lagrat);
    h.sokvag = "/installningar";
    const html = renderToStaticMarkup(await InstallningarSida({ searchParams: Promise.resolve({}) }));
    const visad = html.match(/>Storlek<\/span><span[^>]*>([^<]*)<\/span>/);
    if (!visad) throw new Error("hittade inte raden Storlek pa sidan");
    expect(visad[1]).toBe(`${visat} m²`);
  });
});
