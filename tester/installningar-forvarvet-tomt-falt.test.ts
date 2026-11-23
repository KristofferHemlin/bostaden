import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";


const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/installningar",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
}));
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

import { renderToStaticMarkup } from "react-dom/server";
import { sparaForvarvet } from "@/app/installningar/actions";
import InstallningarSida from "@/app/installningar/page";
import { formateraKronor } from "@/lib/format";

// Ett tomt fält ändrar ingenting, också för köpeskillingen (docs/design.md,
// beslutat 2026-11-23). Till dess skrev inställningarna null när fältet
// tömdes: ett svar som är obligatoriskt i registreringen gick att radera, och
// startskärmens kort började fråga igen. Båda hållen prövas – ett tomt fält
// lämnar talet orört, ett nytt tal sparas – och att hon ser det sparade talet
// på sidan efteråt, eftersom ett fält som tyst struntar i vad hon gjorde inte
// är bättre än ett som tyst raderar.

const ANNA = "a0000000-0000-4000-8000-0000000000e3";
const X = "b0000000-0000-4000-8000-0000000000e3";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const SPARAD = 325_000_000n;

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  const alla = { tilltradesdatum: "2019-06-01", kopeskilling: "", kopkostnader: "", agarandel: "100", ...falt };
  for (const [k, v] of Object.entries(alla)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false, kopeskilling: SPARAD,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
});

async function sparad(): Promise<bigint | null> {
  const b = await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
  return b.kopeskilling == null ? null : BigInt(b.kopeskilling as bigint | number);
}

/** Köpeskillingsradens värde på inställningssidan, som hela elementets text. */
async function radensVarde(): Promise<string> {
  const html = renderToStaticMarkup((await InstallningarSida({ searchParams: Promise.resolve({}) })) as Parameters<typeof renderToStaticMarkup>[0]);
  const rader = [...html.matchAll(/<span class="text-text-sekundar">Köpeskilling<\/span><span[^>]*>([^<]*)<\/span>/g)];
  expect(rader, "köpeskillingens rad på sidan").toHaveLength(1);
  return rader[0][1];
}

describe("köpeskillingen i inställningarna går inte att radera", () => {
  it("förutsättningen: sidan visar det sparade talet före sparandet", async () => {
    expect(await radensVarde()).toBe(formateraKronor(Number(SPARAD)));
  });

  it("ett tömt fält lämnar det sparade talet orört, och sidan visar det", async () => {
    const svar = await sparaForvarvet({}, formular({ kopeskilling: "" }));
    expect(svar.fel).toBeUndefined();
    expect(await sparad()).toBe(SPARAD);
    expect(await radensVarde()).toBe(formateraKronor(Number(SPARAD)));
  });

  it("ett fält med bara mellanslag är också tomt", async () => {
    const svar = await sparaForvarvet({}, formular({ kopeskilling: "   " }));
    expect(svar.fel).toBeUndefined();
    expect(await sparad()).toBe(SPARAD);
  });

  it("ett nytt tal sparas som vanligt, och sidan visar det nya", async () => {
    const svar = await sparaForvarvet({}, formular({ kopeskilling: "3 400 000" }));
    expect(svar.fel).toBeUndefined();
    expect(await sparad()).toBe(340_000_000n);
    expect(await radensVarde()).toBe(formateraKronor(340_000_000));
  });

  it("och resten av kortet sparas när köpeskillingen lämnas tom", async () => {
    const svar = await sparaForvarvet({}, formular({ kopeskilling: "", tilltradesdatum: "2020-02-03" }));
    expect(svar.fel).toBeUndefined();
    const b = await h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
    expect((b.tilltradesdatum as Date).toISOString().slice(0, 10)).toBe("2020-02-03");
    expect(await sparad()).toBe(SPARAD);
  });
});
