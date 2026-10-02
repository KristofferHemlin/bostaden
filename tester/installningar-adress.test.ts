import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Adressen ar obligatorisk overallt dar den satts (docs/design.md,
// Registreringsflodet och Skrivbordsvyn) – aven i installningarnas kort
// Bostaden, med samma regel och meddelande som i registreringen (adressfel).
// En bostad som saknar adress sedan tidigare moter kravet forst nar kortet
// sparas. Ingenting annat blockeras: den kan lasas och visas som forut, och
// andra kort sparas som vanligt.
//
// Samma databas i minnet som inbjudningstesterna (tester/_falsk-databas.ts).

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

import { sparaBostaden, sparaForvarvet } from "@/app/installningar/actions";
import InstallningarSida from "@/app/installningar/page";
import OversiktSida from "@/app/page";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) fd.append(k, v);
  return fd;
}

// Props for alla element i tradet vars komponent heter `namn`.
function propsFor(nod: unknown, namn: string): Record<string, unknown>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => propsFor(n, namn));
  const el = nod as { type?: unknown; props?: Record<string, unknown> };
  const egen =
    typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el.props!] : [];
  return [...egen, ...propsFor(el.props?.children, namn)];
}

async function bostaden() {
  return h.db.klient.bostad.findUniqueOrThrow({ where: { id: X } });
}

beforeEach(() => {
  h.db.nollstall();
  for (const r of REGELPARAMETRAR) {
    h.db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  h.db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  // En bostad skapad innan adressen blev obligatorisk: adress saknas.
  h.db.lagg("bostad", {
    id: X,
    adress: null,
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    bostadsfragor_besvarade: true,
  });
  h.db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
});

describe("kortet Bostaden i installningarna", () => {
  it("att spara med tom adress avvisas, och ingenting skrivs", async () => {
    const svar = await sparaBostaden({}, formular({ upplatelseform: "fastighet", adress: "  ", ort: "Umeå" }));
    expect(svar.fel).toBe("Fyll i adressen.");
    const b = await bostaden();
    expect(b.adress).toBeNull();
    expect(b.ort ?? null).toBeNull();
  });

  it("att spara med adress fungerar – fritext duger", async () => {
    const svar = await sparaBostaden({}, formular({ upplatelseform: "fastighet", adress: "Skogsstigen, torpet" }));
    expect(svar.fel).toBeUndefined();
    expect((await bostaden()).adress).toBe("Skogsstigen, torpet");
  });

  it("en befintlig adress gar inte att tomma", async () => {
    await sparaBostaden({}, formular({ upplatelseform: "fastighet", adress: "Storgatan 1" }));
    const svar = await sparaBostaden({}, formular({ upplatelseform: "fastighet", adress: "" }));
    expect(svar.fel).toBe("Fyll i adressen.");
    expect((await bostaden()).adress).toBe("Storgatan 1");
  });
});

describe("en bostad utan adress fungerar som forut", () => {
  it("installningssidan visas, med upplatelseformen i toppraden", async () => {
    const sida = await InstallningarSida();
    expect(propsFor(sida, "Skarm")[0].bostadsnamn).toBe("Huset");
    const kort = propsFor(sida, "InstallningarKort")[0] as { bostaden: { adress: string } };
    expect(kort.bostaden.adress).toBe("");
  });

  it("oversikten visas, med upplatelseformen i toppraden", async () => {
    const sida = await OversiktSida({ searchParams: Promise.resolve({}) });
    expect(propsFor(sida, "Skarm")[0].bostadsnamn).toBe("Huset");
  });

  it("andra kort sparas utan att adressen kravs", async () => {
    const svar = await sparaForvarvet(
      {},
      formular({ tilltradesdatum: "2019-06-01", agarandel: "100", forsta_agare: "nej" }),
    );
    expect(svar.fel).toBeUndefined();
    expect((await bostaden()).adress).toBeNull();
  });
});
