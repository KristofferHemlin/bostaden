import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

// Glomt losenord (docs/design.md, Inloggningssidan). Fyra saker ar bindande:
// svaret pa en begaran ar detsamma oavsett om adressen finns, det nya
// losenordet provas mot samma krav som vid registreringen, en anvand eller
// gammal lank ger ett begripligt besked med en vag att begara en ny, och efter
// satt losenord ar personen inloggad och pa sin startskarm.

const h = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  rapporteraFel: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  skapaServerklient: async () => ({
    auth: {
      resetPasswordForEmail: h.resetPasswordForEmail,
      getUser: h.getUser,
      updateUser: h.updateUser,
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
vi.mock("@/lib/feltrapportering", () => ({ rapporteraFel: h.rapporteraFel }));

import { begarAterstallning, sattNyttLosenord } from "@/app/losenord/actions";
import { GET as callback } from "@/app/auth/callback/route";
import { OgiltigLank } from "@/app/losenord/nytt/ogiltig-lank";
import { losenordsfel } from "@/lib/losenord";

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("begaran om aterstallning", () => {
  async function svarFor(
    epost: string,
    supabaseSvar: { data: object; error: unknown },
  ) {
    h.resetPasswordForEmail.mockResolvedValueOnce(supabaseSvar);
    return begarAterstallning({}, formular({ epost }));
  }

  it("ger samma svar for en adress som finns som for en som inte finns", async () => {
    // Supabase svarar likadant (inget fel) i bada fallen – men den
    // per-anvandare-sparr och utskicksgrans som bara kan sla till for en
    // adress som har ett konto far inte heller lacka igenom.
    const finns = await svarFor("a@exempel.se", { data: {}, error: null });
    const finnsInte = await svarFor("a@exempel.se", { data: {}, error: null });
    const finnsSparrad = await svarFor("a@exempel.se", {
      data: {},
      error: { name: "AuthApiError", status: 429, code: "over_request_rate_limit", message: "For security purposes, you can only request this after 42 seconds." },
    });
    const finnsUtskicksgrans = await svarFor("a@exempel.se", {
      data: {},
      error: { name: "AuthApiError", status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });

    expect(finns).toEqual(finnsInte);
    expect(finnsSparrad).toEqual(finns);
    expect(finnsUtskicksgrans).toEqual(finns);
    expect(finns.fel).toBeUndefined();
    expect(finns.skickatTill).toBe("a@exempel.se");
  });

  it("rapporterar ett fel fran Supabase utan adressen", async () => {
    await svarFor("hemlig@exempel.se", {
      data: {},
      error: { name: "AuthApiError", status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });
    expect(h.rapporteraFel).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.rapporteraFel.mock.calls)).not.toContain("hemlig");
  });

  it("lanken i mejlet gar via callbacken till sidan for nytt losenord", async () => {
    await svarFor("a@exempel.se", { data: {}, error: null });
    expect(h.resetPasswordForEmail).toHaveBeenCalledWith("a@exempel.se", {
      redirectTo: "https://exempel.se/auth/callback?next=/losenord/nytt",
    });
  });

  it("en tom adress fragar efter adressen och skickar inget", async () => {
    const svar = await begarAterstallning({}, formular({ epost: " " }));
    expect(svar.fel).toBe("Fyll i din e-postadress.");
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("nytt losenord", () => {
  beforeEach(() => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    h.updateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  });

  it("avvisar ett for svagt losenord med samma besked som registreringen", async () => {
    const svar = await sattNyttLosenord({}, formular({ losenord: "kort" }));
    expect(svar.fel).toBe(losenordsfel("kort"));
    expect(svar.fel).toBe("Lösenordet måste vara minst 8 tecken.");
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("registreringen anvander samma krav", () => {
    expect(losenordsfel("1234567")).not.toBeNull();
    expect(losenordsfel("12345678")).toBeNull();
  });

  it("efter satt losenord ar personen inloggad och hamnar pa startskarmen", async () => {
    await expect(
      sattNyttLosenord({}, formular({ losenord: "ett-langt-losenord" })),
    ).rejects.toThrow("REDIRECT:/");
    expect(h.updateUser).toHaveBeenCalledWith({ password: "ett-langt-losenord" });
  });

  it("utan session (lanken forbrukad) visas beskedet om lanken, inte ett fel", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const svar = await sattNyttLosenord({}, formular({ losenord: "ett-langt-losenord" }));
    expect(svar.lankOgiltig).toBe(true);
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it("samma losenord som forut ger ett begripligt besked", async () => {
    h.updateUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 422, code: "same_password", message: "New password should be different from the old password." },
    });
    const svar = await sattNyttLosenord({}, formular({ losenord: "ett-langt-losenord" }));
    expect(svar.fel).toBe("Det nya lösenordet måste vara ett annat än det gamla.");
  });
});

describe("anvand eller utgangen lank", () => {
  function begaran(sok: string) {
    return new NextRequest(`https://exempel.se/auth/callback${sok}`);
  }

  it("en lank som inte gar att losa in leder till beskedet, inte till inloggningen", async () => {
    h.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { name: "AuthApiError", status: 403, code: "otp_expired", message: "Email link is invalid or has expired" },
    });
    const svar = await callback(begaran("?code=abc&next=/losenord/nytt"));
    expect(svar.headers.get("location")).toBe(
      "https://exempel.se/losenord/nytt?lank=ogiltig",
    );
  });

  it("Supabase felomdirigering utan kod leder till samma besked", async () => {
    const svar = await callback(
      begaran("?next=/losenord/nytt&error=access_denied&error_code=otp_expired"),
    );
    expect(svar.headers.get("location")).toBe(
      "https://exempel.se/losenord/nytt?lank=ogiltig",
    );
  });

  it("en giltig lank loggar in och leder till sidan for nytt losenord", async () => {
    h.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    const svar = await callback(begaran("?code=abc&next=/losenord/nytt"));
    expect(svar.headers.get("location")).toBe("https://exempel.se/losenord/nytt");
  });

  it("en lank med token_hash (fungerar pa annan enhet) loses in med verifyOtp", async () => {
    h.verifyOtp.mockResolvedValue({ data: {}, error: null });
    const svar = await callback(
      begaran("?token_hash=xyz&type=recovery&next=/losenord/nytt"),
    );
    expect(h.verifyOtp).toHaveBeenCalledWith({ token_hash: "xyz", type: "recovery" });
    expect(svar.headers.get("location")).toBe("https://exempel.se/losenord/nytt");
  });

  it("beskedet sager vad som hant och erbjuder en ny lank – inget formular", () => {
    const html = renderToStaticMarkup(OgiltigLank());
    expect(html).toMatch(/använd eller för gammal/);
    expect(html).toMatch(/<a[^>]*href="\/losenord\/glomt"[^>]*>Skicka en ny länk<\/a>/);
    expect(html).not.toMatch(/<form|<input/);
  });
});
