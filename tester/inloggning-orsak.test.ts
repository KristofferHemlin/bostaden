import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Inloggningens svar bar en orsak – uppgifter, kontakt eller annat – sa att
// formularet kan tomma losenordet bara nar det kan ha varit fel, utan att
// utlasa fallet ur meningens text (docs/design.md, Inloggningssidan). Och
// ingen engelska nar anvandaren: ett fel som inte ar oversatt far en svensk
// reservmening, och originalet loggas i stallet for att visas.
//
// Felen har samma form som de supabase-js (@supabase/auth-js) returnerar fran
// signInWithPassword: name, message, status och, for API-fel, code.

const h = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  skapaServerklient: async () => ({ auth: { signInWithPassword: h.signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({
  redirect: (mal: string) => {
    throw new Error(`REDIRECT:${mal}`);
  },
}));

import { hanteraAuth } from "@/app/login/actions";
import { INGEN_KONTAKT_MED_INLOGGNINGEN } from "@/lib/inloggning";

function formular(falt: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(falt)) fd.set(k, v);
  return fd;
}

const UPPGIFTER = { epost: "anna@exempel.se", losenord: "hemligt-och-langt" };

function avvisas(fel: { name: string; message: string; status: number; code?: string }) {
  h.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: fel });
  return hanteraAuth({}, formular(UPPGIFTER));
}

/** En lydelse ur docs/design.md (Inloggningssidan) – citatet efter
 *  meningen `fore`. Lases inne i testet, aldrig pa modulniva (CLAUDE.md,
 *  "Tester"). */
function lydelse(fore: RegExp, vad: string): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(new RegExp(`${fore.source}[^\\n]*\\n\\n> \\*"([^"]+)"\\*`));
  if (!m) throw new Error(`design.md saknar lydelsen ${vad}`);
  return m[1]!;
}
const reservmeningen = () =>
  lydelse(/och originalet loggas med namn, status och kod i stället för att visas:/, "for ett ooversatt fel");
const forMangaForsok = () => lydelse(/\*\*För många försök översätts med avsikt\*\*/, "for for manga forsok");

let logg: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  logg = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("orsaken i inloggningens svar", () => {
  it("fel uppgifter ar uppgifter", async () => {
    expect(
      await avvisas({ name: "AuthApiError", message: "Invalid login credentials", status: 400, code: "invalid_credentials" }),
    ).toEqual({ fel: "Fel e-post eller lösenord.", orsak: "uppgifter", epost: UPPGIFTER.epost });
  });

  it("ett natverksfel ar kontakt", async () => {
    expect(await avvisas({ name: "AuthRetryableFetchError", message: "fetch failed", status: 0 })).toEqual({
      fel: INGEN_KONTAKT_MED_INLOGGNINGEN,
      orsak: "kontakt",
      epost: UPPGIFTER.epost,
    });
  });

  // Ett 5xx-svar utan JSON far statusraden som meddelande – "Bad Gateway",
  // utan "fetch" i sig. Till 2026-11-09 visades det ratt pa engelska.
  it("ett 502 fran inloggningstjansten ar kontakt", async () => {
    expect(await avvisas({ name: "AuthRetryableFetchError", message: "Bad Gateway", status: 502 })).toEqual({
      fel: INGEN_KONTAKT_MED_INLOGGNINGEN,
      orsak: "kontakt",
      epost: UPPGIFTER.epost,
    });
  });

  it("en obekraftad adress ar annat – losenordet kan ha varit ratt", async () => {
    expect(
      await avvisas({ name: "AuthApiError", message: "Email not confirmed", status: 400, code: "email_not_confirmed" }),
    ).toEqual({
      fel: "E-postadressen är inte bekräftad än. Kolla mejlen.",
      orsak: "annat",
      epost: UPPGIFTER.epost,
    });
  });

  it("ett faltfel ar annat", async () => {
    expect(await hanteraAuth({}, formular({ epost: "anna@exempel.se" }))).toEqual({
      fel: "Fyll i ditt lösenord.",
      falt: "losenord",
      orsak: "annat",
      epost: "anna@exempel.se",
    });
  });
});

describe("ingen engelska nar anvandaren", () => {
  const OOVERSATT = { name: "AuthApiError", message: "User is banned", status: 403, code: "user_banned" };

  it("ett ooversatt fel visas inte – reservmeningen ur design.md, och originalet finns inte i den", async () => {
    const svar = await avvisas(OOVERSATT);
    expect(svar).toEqual({ fel: reservmeningen(), orsak: "annat", epost: UPPGIFTER.epost });
    expect(svar.fel).not.toContain(OOVERSATT.message);
  });

  // Det enda av de ovantade felen en vanlig anvandare kan rakna ut for.
  // Orsaken ar annat, sa losenordet star kvar: hon har inte skrivit fel, hon
  // har skrivit for ofta.
  it("for manga forsok oversatts med avsikt, med orsaken annat", async () => {
    const svar = await avvisas({
      name: "AuthApiError",
      message: "Request rate limit reached",
      status: 429,
      code: "over_request_rate_limit",
    });
    expect(svar).toEqual({ fel: forMangaForsok(), orsak: "annat", epost: UPPGIFTER.epost });
  });

  it("for manga forsok loggas inte – det ar oversatt", async () => {
    await avvisas({ name: "AuthApiError", message: "Request rate limit reached", status: 429, code: "over_request_rate_limit" });
    expect(logg).not.toHaveBeenCalled();
  });

  it("originalet loggas, med kod och status", async () => {
    await avvisas(OOVERSATT);
    expect(logg).toHaveBeenCalledTimes(1);
    const rad = String(logg.mock.calls[0]?.[0]);
    expect(rad).toContain(OOVERSATT.message);
    expect(rad).toContain(OOVERSATT.code);
    expect(rad).toContain(String(OOVERSATT.status));
  });

  it("ett oversatt fel loggas inte", async () => {
    await avvisas({ name: "AuthApiError", message: "Invalid login credentials", status: 400, code: "invalid_credentials" });
    expect(logg).not.toHaveBeenCalled();
  });
});
