import { beforeEach, describe, expect, it, vi } from "vitest";

// Ett falt som avvisas behaller sitt varde – man kan inte ratta det man inte
// ser. Losenordsfalt far garna tommas, och ett losenord aterges aldrig.
//
// Uppmatt i produktionen 2026-10-19: "abc" i e-postfaltet pa inloggningen och
// pa Glomt losenordet var borta efter avvisningen. Kvar stod platshallaren
// "du@exempel.se" – samma text som meningens exempel – sa faltet sag ut som om
// ingenting skrivits. Registreringen beholl sitt varde.
//
// Tva vagar till samma symptom, och bada provas har:
//
//   1. Klientens avvisning. Falt bytte form pa sina barn nar ett fel kom eller
//      gick – ett ensamt element utan fel, en array med nyckel med fel – och
//      React monterar om ett element vars plats i tradet bytt form. En
//      okontrollerad input (defaultValue) tappar da sitt varde; registreringens
//      kontrollerade falt klarade sig. Testmiljon har ingen DOM, sa det som
//      provas ar just det React avgor ommonteringen pa: formen och nyckeln.
//   2. Serverns avvisning ("Fel e-post eller lösenord."). Da har formularets
//      action korts, och React 19 aterstaller ett okontrollerat formular till
//      dess defaultValue efterat. Adressen maste darfor komma tillbaka i svaret
//      och bli faltets defaultValue.

const h = vi.hoisted(() => ({
  resultat: {} as Record<string, unknown>,
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useActionState: () => [h.resultat, () => {}, false] };
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://exempel.se" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  skapaServerklient: async () => ({
    auth: {
      signInWithPassword: h.signInWithPassword,
      resetPasswordForEmail: h.resetPasswordForEmail,
    },
  }),
}));
vi.mock("@/lib/feltrapportering", () => ({ rapporteraFel: vi.fn() }));

import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bindFaltet } from "@/components/skarm";
import LoginSida from "@/app/login/page";
import GlomtLosenordSida from "@/app/losenord/glomt/page";
import { hanteraAuth } from "@/app/login/actions";
import { begarAterstallning } from "@/app/losenord/actions";

const LOSENORD = "hemligt-Losen-91";

function fd(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
}

/** Det React jamfor nar det avgor om ett barn ar samma som forut: om barnen
 *  ar en lista, och varje barns typ och nyckel. */
function form(barn: ReactNode): unknown {
  const lista = Array.isArray(barn);
  const element = (lista ? barn : [barn]) as ReactNode[];
  return {
    lista,
    barn: element.map((b) => (isValidElement(b) ? [b.type, b.key] : typeof b)),
  };
}

function falt(html: string, name: string): string {
  const m = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  if (!m) throw new Error(`Inget falt ${name}`);
  return m[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  h.resultat = {};
});

describe("Falt monterar inte om faltet nar ett fel kommer eller gar", () => {
  it("ett ensamt falt har samma form med och utan fel", () => {
    const input = createElement("input", { name: "epost" });
    const utan = bindFaltet(input, undefined, "f1");
    const med = bindFaltet(input, "Fyll i en giltig e-postadress, t.ex. du@exempel.se.", "f1");
    expect(form(med)).toEqual(form(utan));
  });

  it("ett falt med en rad efter sig likasa", () => {
    const barn = [
      createElement("input", { key: "i", name: "epost" }),
      createElement("p", { key: "p" }, "Inbjudan gäller den här adressen."),
    ];
    expect(form(bindFaltet(barn, "Fel.", "f1"))).toEqual(form(bindFaltet(barn, undefined, "f1")));
  });

  it("bindningen finns kvar: med fel far forsta elementet aria-invalid och aria-describedby", () => {
    const [forsta] = bindFaltet(createElement("input"), "Fel.", "f1") as ReactElement<
      Record<string, unknown>
    >[];
    expect(forsta.props["aria-invalid"]).toBe(true);
    expect(forsta.props["aria-describedby"]).toBe("f1");
  });
});

describe("serverns avvisning ger tillbaka adressen, aldrig losenordet", () => {
  it("fel e-post eller losenord: adressen i svaret, losenordet inte", async () => {
    h.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const svar = await hanteraAuth(
      {},
      fd({ epost: " kristoffer@gmail.com ", losenord: LOSENORD }),
    );
    expect(svar.fel).toBe("Fel e-post eller lösenord.");
    expect(svar.epost).toBe("kristoffer@gmail.com");
    expect(JSON.stringify(svar)).not.toContain(LOSENORD);
  });

  it("en adress som servern sjalv avvisar kommer ocksa tillbaka", async () => {
    const svar = await hanteraAuth({}, fd({ epost: "kristoffer@gmailcom", losenord: LOSENORD }));
    expect(svar.falt).toBe("epost");
    expect(svar.epost).toBe("kristoffer@gmailcom");
    expect(JSON.stringify(svar)).not.toContain(LOSENORD);
  });

  it("glomt losenordet: en avvisad adress kommer tillbaka", async () => {
    const svar = await begarAterstallning({}, fd({ epost: "kristoffer@gmailcom" }));
    expect(svar.falt).toBe("epost");
    expect(svar.epost).toBe("kristoffer@gmailcom");
  });

  it("glomt losenordet: ingen kontakt med inloggningen – adressen kommer tillbaka", async () => {
    h.resetPasswordForEmail.mockResolvedValue({
      error: { name: "AuthRetryableFetchError", status: 0 },
    });
    const svar = await begarAterstallning({}, fd({ epost: "kristoffer@gmail.com" }));
    expect(svar.fel).toBeTruthy();
    expect(svar.epost).toBe("kristoffer@gmail.com");
  });
});

describe("sidorna visar den adress servern gav tillbaka", () => {
  it("inloggningen: adressen star kvar i faltet, losenordsfaltet ar tomt", () => {
    h.resultat = { fel: "Fel e-post eller lösenord.", epost: "kristoffer@gmail.com" };
    const html = renderToStaticMarkup(createElement(LoginSida));
    expect(falt(html, "epost")).toContain('value="kristoffer@gmail.com"');
    expect(falt(html, "losenord")).not.toContain("value=");
  });

  it("glomt losenordet: adressen star kvar i faltet", () => {
    h.resultat = { fel: "Fyll i en giltig e-postadress, t.ex. du@exempel.se.", falt: "epost", epost: "kristoffer@gmailcom" };
    const html = renderToStaticMarkup(createElement(GlomtLosenordSida));
    expect(falt(html, "epost")).toContain('value="kristoffer@gmailcom"');
  });
});
