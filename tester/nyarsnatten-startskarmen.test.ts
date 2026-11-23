import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Nyårsnatten på startskärmen (CLAUDE.md, "Ett datum utan sin tidszon är inte
// en dag"). Nyckeltalet "Inlagt {år}" är det enda av de ställen som räknade
// dagen i UTC som hon kan läsa som ett belopp: strax efter midnatt den 1
// januari i Stockholm är UTC kvar på nyårsafton, och då visade rutan förra
// årets summa under förra årets rubrik. Klockan ställs dit, och processens
// zon sätts uttryckligen – en lagning på maskinens egen zon vore grön i
// Stockholm och fel på servern.

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
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
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
import OversiktSida from "@/app/page";
import { formateraKronorMetrikruta } from "@/lib/format";

const ANNA = "a0000000-0000-4000-8000-0000000000e7";
const X = "b0000000-0000-4000-8000-0000000000e7";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ursprungligZon = process.env.TZ;

/** 00:30 den 1 januari 2027 i Stockholm; UTC är kvar på nyårsafton. */
const NYARSNATTEN = "2026-12-31T23:30:00.000Z";
const FORRA_ARETS = 300_000;
const NYARSDAGENS = 50_000;

function seeda() {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X, adress: "Kvarnvägen 3", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false, kopeskilling: 325_000_000n,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100, bekraftad_andel: 100 });
  for (const [belopp, dag, skapad] of [
    [FORRA_ARETS, "2026-06-01", "2026-06-01T10:00:00.000Z"],
    [NYARSDAGENS, "2027-01-01", "2026-12-31T23:20:00.000Z"],
  ] as const) {
    const k = h.db.lagg("kostnad", {
      bostad_id: X, leverantor: "Byggmax", anteckning: "Material", totalbelopp: belopp,
      dokumentdatum: datum(dag), betaldatum: datum(dag), skapad_at: new Date(skapad),
    });
    h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Nyckeltalet "Inlagt {år}": rubriken och värdet, var och en som hela elementets text. */
async function inlagtRutan(): Promise<{ rubrik: string; varde: string }> {
  const html = renderToStaticMarkup((await OversiktSida({ searchParams: Promise.resolve({}) })) as Parameters<typeof renderToStaticMarkup>[0]);
  const texter = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  const i = texter.findIndex((t) => /^Inlagt \d{4}$/.test(t));
  expect(i, "rutan Inlagt {år}").toBeGreaterThanOrEqual(0);
  return { rubrik: texter[i], varde: texter[i + 1] };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  seeda();
});

afterEach(() => {
  vi.useRealTimers();
  if (ursprungligZon === undefined) delete process.env.TZ;
  else process.env.TZ = ursprungligZon;
});

describe.each(["UTC", "America/New_York", "Europe/Stockholm"])("processens tidszon %s", (zon) => {
  it("strax efter midnatt på nyårsnatten visar rutan det nya årets summa", async () => {
    process.env.TZ = zon;
    vi.setSystemTime(new Date(NYARSNATTEN));
    // Förutsättningen: UTC står kvar på det gamla året.
    expect(new Date().getUTCFullYear()).toBe(2026);
    expect(await inlagtRutan()).toEqual({ rubrik: "Inlagt 2027", varde: formateraKronorMetrikruta(NYARSDAGENS) });
  });

  it("och mitt på nyårsafton det gamla årets", async () => {
    process.env.TZ = zon;
    vi.setSystemTime(new Date("2026-12-31T12:00:00.000Z"));
    expect(await inlagtRutan()).toEqual({ rubrik: "Inlagt 2026", varde: formateraKronorMetrikruta(FORRA_ARETS) });
  });
});
