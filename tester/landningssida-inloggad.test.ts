import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// docs/design.md, Landningssidan: den som inte ar inloggad moter
// landningssidan pa "/". Ingen inloggad ser den nagonsin, och ingen utloggad
// nar startskarmen. Provat pa sjalva sidan (src/app/page.tsx), med den
// session och databas den faktiskt laser – inte pa sokvagsreglerna, som
// bara avgor om "/" ar oskyddad.

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test", "x-forwarded-proto": "https" }),
  cookies: async () => ({ getAll: () => [], get: () => undefined, set: vi.fn() }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }), signOut: async () => ({ error: null }) },
  }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import OversiktSida, { generateMetadata } from "@/app/page";
import { Landningssida } from "@/app/landningssida";

const ANNA = "a0000000-0000-4000-8000-0000000000b1";
const BOSTAD = "b0000000-0000-4000-8000-0000000000b1";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const RUBRIK = "Det du gjort med bostaden sänker skatten när du säljer. Om kvittot finns kvar.";

beforeEach(() => {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  h.db.lagg("bostad", {
    id: BOSTAD, adress: "Storgatan 1", upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"), bostadsfragor_besvarade: true,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: BOSTAD, agarandel: 100 });
});

/** Finns en komponent nagonstans i tradet sidan returnerar? */
function innehaller(nod: unknown, typ: unknown): boolean {
  if (nod == null || typeof nod !== "object") return false;
  if (Array.isArray(nod)) return nod.some((n) => innehaller(n, typ));
  const el = nod as ReactElement<{ children?: unknown }>;
  return el.type === typ || innehaller(el.props?.children, typ);
}

const sida = () => OversiktSida({ searchParams: Promise.resolve({}) });

describe("landningssidan och den inloggade", () => {
  it("utloggad: sidan är landningssidan", async () => {
    h.inloggad = null;
    const el = await sida();
    expect(innehaller(el, Landningssida)).toBe(true);
    expect(renderToStaticMarkup(el)).toContain(`<h1`);
  });

  it("inloggad: landningssidan finns ingenstans, inte ens dess rubrik", async () => {
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    const el = await sida();
    expect(innehaller(el, Landningssida)).toBe(false);
    expect(renderToStaticMarkup(el)).not.toContain(RUBRIK);
  });

  it("och metadatan följer med: sökresultatets titel bara för den utloggade", async () => {
    h.inloggad = null;
    expect((await generateMetadata()).title).toEqual({ absolute: "Dra av renovering vid försäljning – Kvittobo" });
    h.inloggad = { id: ANNA, email: "anna@exempel.se" };
    expect(await generateMetadata()).toEqual({ title: { absolute: "Översikt – Kvittobo" } });
  });
});
