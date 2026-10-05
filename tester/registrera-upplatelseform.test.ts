import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Upplatelseformen har inget forval (docs/design.md, Registreringsflodet:
// "ett förval är ett svar användaren inte gav"). Den var forvald som
// bostadsratt: den som agde ett hus och inte tryckte pa kortet registrerade en
// bostadsratt – bakre tidsgrans 1974 i stallet for 1952, fel blankett – och
// det syntes aldrig mer. Klienten och servern provar samma regel
// (upplatelseformfel).

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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
import { RegistreraFlode } from "@/app/registrera/flode";
import { upplatelseformfel } from "@/app/registrera/validering";

const ANVANDARE = "11111111-1111-4111-8111-111111111111";

function bostadssteg(falt: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  const alla: Record<string, string | undefined> = {
    fas: "bostad",
    tilltradesdatum: "2022-04-01",
    adress: "Storgatan 1",
    ...falt,
  };
  for (const [k, v] of Object.entries(alla)) if (v !== undefined) fd.set(k, v);
  return fd;
}

async function skicka(falt: Record<string, string | undefined>) {
  try {
    return await slutforRegistrering({}, bostadssteg(falt));
  } catch (fel) {
    if (fel instanceof h.Omdirigering) return { omdirigerad: fel.url };
    throw fel;
  }
}

describe("upplatelseformfel", () => {
  it("tomt eller okant ar ett fel – samma sorts formulering som adressen", () => {
    expect(upplatelseformfel("")).toBe("Välj vad du äger.");
    expect(upplatelseformfel("villa")).toBe("Välj vad du äger.");
  });

  it("de tva valen godtas", () => {
    expect(upplatelseformfel("bostadsratt")).toBeNull();
    expect(upplatelseformfel("fastighet")).toBeNull();
  });
});

describe("formularet", () => {
  const html = () => renderToStaticMarkup(createElement(RegistreraFlode, { endastBostad: true }));

  it("inget kort ar valt fran borjan, och det dolda faltet ar tomt", () => {
    const markup = html();
    expect(markup).not.toContain('aria-pressed="true"');
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(markup).toMatch(/<input type="hidden" name="upplatelseform" value=""\/>/);
  });

  it("fragan bar samma markering for obligatoriskt som de andra", () => {
    expect(html()).toMatch(/Vad äger du\?<span aria-hidden="true" class="ml-0.5 text-text-sekundar">\*<\/span>/);
  });
});

describe("bostadssteget pa servern", () => {
  beforeEach(() => {
    h.db.nollstall();
    h.inloggad = { id: ANVANDARE, email: "a@exempel.se" };
    h.db.lagg("anvandare", { id: ANVANDARE, epost: "a@exempel.se" });
  });

  it.each([
    ["utan falt", undefined],
    ["tomt", ""],
    ["okant varde", "villa"],
  ])("ingen bostad skapas %s", async (_namn, varde) => {
    const svar = await skicka({ upplatelseform: varde });
    expect(svar).toEqual({ fel: "Välj vad du äger." });
    expect(await h.db.klient.bostad.count()).toBe(0);
  });

  it.each([
    ["bostadsratt"],
    ["fastighet"],
  ])("%s sparas som det valdes", async (varde) => {
    const svar = await skicka({ upplatelseform: varde });
    expect(svar).toEqual({ omdirigerad: "/" });
    const [bostad] = h.db.tabell("bostad");
    expect(bostad.upplatelseform).toBe(varde);
  });
});
