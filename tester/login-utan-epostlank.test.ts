import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Inloggning med e-postlank ar borttagen ur granssnittet (docs/design.md,
// Inloggningssidan). Inloggningsaction skickar inga lankar langre, inte ens om
// nagon postar den gamla avsikten for hand. Rutten som tar emot lankar ligger
// kvar – aterstallningsmejlet landar dar – och ?fel=lank har en synlig text.

const h = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  skapaServerklient: async () => ({
    auth: {
      signInWithOtp: h.signInWithOtp,
      signInWithPassword: h.signInWithPassword,
      exchangeCodeForSession: h.exchangeCodeForSession,
      verifyOtp: h.verifyOtp,
    },
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://exempel.se" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (mal: string) => {
    throw new Error(`REDIRECT:${mal}`);
  },
}));

import { hanteraAuth } from "@/app/login/actions";
import { GET as callback } from "@/app/auth/callback/route";
import { inloggningsfelFranLank } from "@/lib/inloggning";

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inloggningen skickar inga e-postlankar", () => {
  it("den gamla avsikten for e-postlank skickar ingenting", async () => {
    const svar = await hanteraAuth(
      {},
      formular({ avsikt: "magisk-lank", epost: "a@exempel.se" }),
    );
    expect(h.signInWithOtp).not.toHaveBeenCalled();
    expect(svar.fel).toBe("Fyll i både e-post och lösenord.");
  });

  it("inloggning med losenord fungerar som forut", async () => {
    h.signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      hanteraAuth({}, formular({ epost: "a@exempel.se", losenord: "hemligt123" })),
    ).rejects.toThrow("REDIRECT:/");
    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: "a@exempel.se",
      password: "hemligt123",
    });
  });
});

describe("rutten som tar emot lankar ligger kvar", () => {
  it("en giltig aterstallningslank leder till sidan for nytt losenord", async () => {
    h.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    const svar = await callback(
      new NextRequest("https://exempel.se/auth/callback?code=abc&next=/losenord/nytt"),
    );
    expect(svar.headers.get("location")).toBe("https://exempel.se/losenord/nytt");
  });

  it("en ogiltig lank utan aterstallningsmal leder till ?fel=lank", async () => {
    h.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: "invalid" },
    });
    const svar = await callback(
      new NextRequest("https://exempel.se/auth/callback?code=gammal"),
    );
    expect(svar.headers.get("location")).toBe("https://exempel.se/login?fel=lank");
  });
});

describe("?fel=lank pa inloggningssidan", () => {
  it("har en synlig text som pekar pa Glomt losenordet?", () => {
    const text = inloggningsfelFranLank("lank");
    expect(text).toBeTruthy();
    expect(text).toContain("Glömt lösenordet?");
    expect(text).not.toMatch(/e-postlänk|inloggningslänk/i);
  });

  it("andra eller saknade varden ger ingen text", () => {
    expect(inloggningsfelFranLank(null)).toBeNull();
    expect(inloggningsfelFranLank("annat")).toBeNull();
  });
});
