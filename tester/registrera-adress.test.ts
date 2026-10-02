import { beforeEach, describe, expect, it, vi } from "vitest";

// Adressen ar obligatorisk i registreringen sedan 2026-10-01 (docs/design.md,
// Registreringsflodet). Kravet ar att nagot star dar, inte att det ar en
// riktig adress – fritext duger och inget valt forslag kravs. Klienten och
// servern provar samma regel (adressfel).

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
}));
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

import { slutforRegistrering } from "@/app/registrera/actions";
import { adressfel } from "@/app/registrera/validering";

const ANVANDARE = "11111111-1111-4111-8111-111111111111";

function bostadssteg(falt: Record<string, string>): FormData {
  const fd = new FormData();
  const alla = {
    fas: "bostad",
    upplatelseform: "fastighet",
    tilltradesdatum: "2022-04-01",
    ...falt,
  };
  for (const [k, v] of Object.entries(alla)) fd.set(k, v);
  return fd;
}

describe("adressfel", () => {
  it("tomt eller bara mellanslag ar ett fel", () => {
    expect(adressfel("")).toBe("Fyll i adressen.");
    expect(adressfel("   ")).toBe("Fyll i adressen.");
  });

  it("fritext duger – ingen kontroll av att adressen finns", () => {
    expect(adressfel("Skogsstigen, torpet")).toBeNull();
    expect(adressfel("x")).toBeNull();
  });
});

describe("bostadssteget pa servern", () => {
  beforeEach(() => {
    h.db.nollstall();
    h.inloggad = { id: ANVANDARE, email: "a@exempel.se" };
    h.db.lagg("anvandare", { id: ANVANDARE, epost: "a@exempel.se" });
  });

  it("utan adress skapas ingen bostad", async () => {
    const svar = await slutforRegistrering({}, bostadssteg({ adress: "  " }));
    expect(svar.fel).toBe("Fyll i adressen.");
    expect(await h.db.klient.bostad.count()).toBe(0);
  });

  it("med fritextadress skapas bostaden med adressen som den skrevs", async () => {
    await expect(
      slutforRegistrering({}, bostadssteg({ adress: "Skogsstigen, torpet" })),
    ).rejects.toThrow("NEXT_REDIRECT /");
    const [bostad] = await h.db.klient.bostad.findMany();
    expect(bostad.adress).toBe("Skogsstigen, torpet");
    expect(bostad.place_id).toBeNull();
  });
});
