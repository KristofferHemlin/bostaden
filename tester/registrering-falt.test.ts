import { describe, expect, it, vi } from "vitest";

// Registreringen ar det forsta en ny anvandare moter, och att fastna dar ar
// samma sak som att inte komma in (docs/design.md, "När ett formulär
// vägrar", beslutet 2026-10-19). Serverns svar namnger nu sitt falt, sa att
// meningen kan sta vid faltet med aria-invalid och bindning.
//
// Sidan nas fran "Skapa konto" pa inloggningssidan och fran landningssidan.

const h = vi.hoisted(() => ({
  resultat: {} as Record<string, unknown>,
  signUp: vi.fn(),
}));

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useActionState: () => [h.resultat, () => {}, false] };
});
vi.mock("@/lib/supabase/server", () => ({
  skapaServerklient: async () => ({ auth: { signUp: h.signUp } }),
}));
vi.mock("@/lib/session", () => ({ hamtaAnvandare: async () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { slutforRegistrering } from "@/app/registrera/actions";
import { RegistreraFlode } from "@/app/registrera/flode";
import { bostadsstegetsFel, kontostegetsFel } from "@/app/registrera/validering";

function fd(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
}

function arBundet(html: string, tagg: string, mening: string) {
  expect(tagg).toContain('aria-invalid="true"');
  const id = tagg.match(/aria-describedby="([^"]+)"/)?.[1];
  expect(id, "saknar aria-describedby").toBeTruthy();
  const esc = mening.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(html).toMatch(new RegExp(`id="${id}" role="alert"[^>]*>${esc}<`));
}

const input = (html: string, name: string) =>
  html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))![0];

describe("reglerna pekar ut sitt fält", () => {
  it("kontosteget: e-post, sedan lösenord", () => {
    expect(kontostegetsFel(fd({ epost: "anna", losenord: "" }))?.falt).toBe("epost");
    expect(kontostegetsFel(fd({ epost: "a@exempel.se", losenord: "kort" }))?.falt).toBe(
      "losenord",
    );
  });

  it("bostadssteget: upplåtelseform, sedan tillträdesdatum – inga andra fält", () => {
    const idag = "2026-10-19";
    const bas = { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01" };
    expect(bostadsstegetsFel(fd({ ...bas, upplatelseform: "" }), idag)?.falt).toBe("upplatelseform");
    expect(bostadsstegetsFel(fd({ ...bas, tilltradesdatum: "" }), idag)?.falt).toBe("tilltradesdatum");
    expect(bostadsstegetsFel(fd({ ...bas, tilltradesdatum: "2027-01-01" }), idag)?.falt).toBe(
      "tilltradesdatum",
    );
    // Adress och kopeskilling hor inte hit langre – de provas inte.
    expect(bostadsstegetsFel(fd({ ...bas, adress: " ", kopeskilling: "abc" }), idag)).toBeNull();
    expect(bostadsstegetsFel(fd(bas), idag)).toBeNull();
  });
});

describe("serverns svar namnger fältet", () => {
  it("en ogiltig e-postadress i kontosteget", async () => {
    const svar = await slutforRegistrering(
      {},
      fd({ fas: "konto", epost: "anna", losenord: "hemligt12345" }),
    );
    expect(svar).toEqual({
      fel: "Fyll i en giltig e-postadress, t.ex. du@exempel.se.",
      falt: "epost",
    });
  });

  it("en upptagen adress gäller e-postfältet", async () => {
    h.signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
    const svar = await slutforRegistrering(
      {},
      fd({ fas: "konto", epost: "a@exempel.se", losenord: "hemligt12345" }),
    );
    expect(svar).toMatchObject({ falt: "epost", epostUpptagen: true });
  });
});

describe("formuläret visar meningen vid fältet", () => {
  const rendera = (resultat: Record<string, unknown>, endastBostad = false) => {
    h.resultat = resultat;
    return renderToStaticMarkup(createElement(RegistreraFlode, { endastBostad }));
  };

  it("väljer bort webbläsarens tysta kontroll", () => {
    expect(rendera({})).toMatch(/<form[^>]*novalidate=""/i);
  });

  it("e-post: bunden, med vägen till inloggningen intill", () => {
    const mening = "E-postadressen har redan ett konto. Logga in i stället.";
    const html = rendera({ fel: mening, falt: "epost", epostUpptagen: true, epost: "a@exempel.se" });
    arBundet(html, input(html, "epost"), mening);
    // Adressen foljer med i flikens tillstand, aldrig i lankens URL
    // (tester/epost-mellan-vagarna-in.test.ts provar att den foljer med).
    const lank = html.indexOf('href="/login"');
    expect(html).not.toMatch(/href="[^"]*(epost|@|%40)/);
    expect(lank).toBeGreaterThan(html.indexOf(mening));
    expect(lank).toBeLessThan(html.indexOf('name="losenord"'));
  });

  it("lösenord: bundet", () => {
    const mening = "Lösenordet måste vara minst 8 tecken.";
    const html = rendera({ fel: mening, falt: "losenord" });
    arBundet(html, input(html, "losenord"), mening);
  });

  it("tillträdesdatum: bundet i datumfältet", () => {
    const html = rendera({ fel: "Fyll i tillträdesdatum.", falt: "tilltradesdatum" }, true);
    const ar = html.match(/<input[^>]*aria-label="År"[^>]*>/)![0];
    arBundet(html, ar, "Fyll i tillträdesdatum.");
  });

  it("upplåtelseformen: två knappar – meningen meddelas, utan aria-invalid", () => {
    const html = rendera({ fel: "Välj vad du äger.", falt: "upplatelseform" }, true);
    expect(html).toMatch(/<p role="alert"[^>]*>Välj vad du äger\.<\/p>/);
  });

  it("ett fel utan fält står ovanför knappen och meddelas", () => {
    const html = rendera({ fel: "Kontot kunde inte kopplas. Börja om från steg 1." });
    expect(html).toMatch(/<p role="alert" tabindex="-1"[^>]*>Kontot kunde inte kopplas/);
  });
});
