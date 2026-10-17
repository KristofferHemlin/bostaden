import { beforeEach, describe, expect, it, vi } from "vitest";

// Nar Supabase inte gar att na ska beskedet vara nagot anvandaren kan gora
// nagot med – inte en uppmaning om miljovariabler. Det tekniska hamnar i
// loggen, aldrig pa skarmen.

const h = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  skapaServerklient: async () => ({
    auth: { signInWithPassword: h.signInWithPassword, signUp: h.signUp },
  }),
}));
vi.mock("@/lib/session", () => ({
  hamtaAnvandare: async () => null,
  sakerstallAnvandarrad: async () => undefined,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({
  redirect: (mal: string) => {
    throw new Error(`REDIRECT:${mal}`);
  },
}));

import { hanteraAuth } from "@/app/login/actions";
import { slutforRegistrering } from "@/app/registrera/actions";
import { INGEN_KONTAKT_MED_INLOGGNINGEN } from "@/lib/inloggning";

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) fd.set(k, v);
  return fd;
}

const NATVERKSFEL = { message: "TypeError: fetch failed" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("inloggningstjansten svarar inte", () => {
  it("inloggningen sager att det gar att forsoka igen, inget om miljovariabler", async () => {
    h.signInWithPassword.mockResolvedValue({ error: NATVERKSFEL });
    const svar = await hanteraAuth({}, formular({ epost: "a@exempel.se", losenord: "hemligt123" }));
    expect(svar.fel).toBe(INGEN_KONTAKT_MED_INLOGGNINGEN);
    expect(svar.fel).not.toMatch(/NEXT_PUBLIC|SUPABASE/);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("fetch failed"));
  });

  it("registreringen sager samma sak", async () => {
    h.signUp.mockResolvedValue({ data: { user: null }, error: NATVERKSFEL });
    const svar = await slutforRegistrering(
      {},
      formular({ fas: "konto", epost: "a@exempel.se", losenord: "hemligt12345" }),
    );
    expect(svar.fel).toBe(INGEN_KONTAKT_MED_INLOGGNINGEN);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("fetch failed"));
  });

  it("beskedet ar detsamma som pa sidan for glomt losenord", () => {
    expect(INGEN_KONTAKT_MED_INLOGGNINGEN).toBe(
      "Ingen kontakt med inloggningstjänsten. Försök igen om en stund.",
    );
  });
});
