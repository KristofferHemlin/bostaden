import { describe, expect, it, vi } from "vitest";

// docs/design.md, "När ett formulär vägrar", omgang 2026-10-19:
//
//   1. Inloggning, nytt losenord och glomt losenord anvande webblasarens
//      `required`, som pa manga telefoner bara flyttar fokus utan ett ord.
//      Kommer man inte in spelar resten ingen roll.
//   2. Kvittots andringslage och installningarnas kort hade sina meningar
//      langst ned – i ett langt formular hamnar de utanfor skarmen.
//
// Varje avvisning ska ha en mening vid sitt falt, med role="alert", och
// faltet ska ha aria-invalid och aria-describedby som pekar pa meningen.
//
// Det som INTE gar att prova har ar webblasarens eget beteende: vad `required`
// gor i en viss webblasare finns inte i testmiljon. Det som provas ar att
// formularen valjer bort det (novalidate), att meningen finns, har
// role="alert" och ar bunden till faltet.

const h = vi.hoisted(() => ({
  resultat: {} as Record<string, unknown>,
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

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LoginSida from "@/app/login/page";
import GlomtLosenordSida from "@/app/losenord/glomt/page";
import { NyttLosenordFormular } from "@/app/losenord/nytt/formular";
import { ForvarvetKort } from "@/app/installningar/kort";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";
import {
  glomtLosenordFel,
  inloggningensFel,
  nyttLosenordFel,
} from "@/lib/inloggningsfalt";

function rendera(element: ReactElement, resultat: Record<string, unknown>): string {
  h.resultat = resultat;
  return renderToStaticMarkup(element);
}

/** Taggen for det falt som bar ett visst name. */
function falt(html: string, name: string): string {
  const m = html.match(new RegExp(`<(?:input|select)[^>]*name="${name}"[^>]*>`));
  if (!m) throw new Error(`Inget falt ${name}`);
  return m[0];
}

/** Faltet ar bundet till meningen: aria-invalid, aria-describedby som pekar
 *  pa ett element med role="alert" och just den texten. */
function arBundet(html: string, name: string, mening: string) {
  const tagg = falt(html, name);
  expect(tagg).toContain('aria-invalid="true"');
  const id = tagg.match(/aria-describedby="([^"]+)"/)?.[1];
  expect(id, `${name} saknar aria-describedby`).toBeTruthy();
  const esc = mening.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(html).toMatch(new RegExp(`id="${id}" role="alert"[^>]*>${esc}<`));
}

function fd(varden: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(varden)) f.set(k, v);
  return f;
}

describe("reglerna för inloggning och lösenord", () => {
  it("inloggning: e-post först, sedan lösenord", () => {
    expect(inloggningensFel(fd({ epost: "", losenord: "" }))).toEqual({
      falt: "epost",
      fel: "Fyll i din e-postadress.",
    });
    expect(inloggningensFel(fd({ epost: "anna", losenord: "x" }))).toEqual({
      falt: "epost",
      fel: "Fyll i en giltig e-postadress, t.ex. du@exempel.se.",
    });
    expect(inloggningensFel(fd({ epost: "a@exempel.se", losenord: "" }))).toEqual({
      falt: "losenord",
      fel: "Fyll i ditt lösenord.",
    });
    expect(inloggningensFel(fd({ epost: "a@exempel.se", losenord: "x" }))).toBeNull();
  });

  it("glömt lösenord: adressen", () => {
    expect(glomtLosenordFel(fd({ epost: "" }))?.falt).toBe("epost");
    expect(glomtLosenordFel(fd({ epost: "a@exempel.se" }))).toBeNull();
  });

  it("nytt lösenord: ifyllt och minst åtta tecken", () => {
    expect(nyttLosenordFel(fd({ losenord: "" }))).toEqual({
      falt: "losenord",
      fel: "Fyll i ett nytt lösenord.",
    });
    expect(nyttLosenordFel(fd({ losenord: "kort12" }))?.falt).toBe("losenord");
    expect(nyttLosenordFel(fd({ losenord: "langtlosen" }))).toBeNull();
  });

  it("ett lösenord återges aldrig i en mening", () => {
    const losenord = "hemlis7";
    const fel = nyttLosenordFel(fd({ losenord }));
    expect(fel?.fel).not.toContain(losenord);
  });
});

describe("inloggningen säger varför", () => {
  it("väljer bort webbläsarens tysta kontroll", () => {
    expect(rendera(createElement(LoginSida), {})).toMatch(/<form[^>]*novalidate=""/i);
  });

  it("ett tomt e-postfält får en mening, bunden till fältet", () => {
    const html = rendera(createElement(LoginSida), {
      fel: "Fyll i din e-postadress.",
      falt: "epost",
    });
    arBundet(html, "epost", "Fyll i din e-postadress.");
  });

  it("ett tomt lösenordsfält likaså", () => {
    const html = rendera(createElement(LoginSida), {
      fel: "Fyll i ditt lösenord.",
      falt: "losenord",
    });
    arBundet(html, "losenord", "Fyll i ditt lösenord.");
  });

  it("fel e-post eller lösenord pekar inte ut något fält, men meddelas", () => {
    const html = rendera(createElement(LoginSida), { fel: "Fel e-post eller lösenord." });
    expect(html).toMatch(/<p role="alert"[^>]*>Fel e-post eller lösenord\.<\/p>/);
    expect(falt(html, "losenord")).not.toContain("aria-invalid");
  });
});

describe("glömt och nytt lösenord säger varför", () => {
  it("glömt: väljer bort den tysta kontrollen och binder meningen", () => {
    const html = rendera(createElement(GlomtLosenordSida), {
      fel: "Fyll i din e-postadress.",
      falt: "epost",
    });
    expect(html).toMatch(/<form[^>]*novalidate=""/i);
    arBundet(html, "epost", "Fyll i din e-postadress.");
  });

  it("nytt: väljer bort den tysta kontrollen och binder meningen", () => {
    const html = rendera(createElement(NyttLosenordFormular), {
      fel: "Lösenordet måste vara minst 8 tecken.",
      falt: "losenord",
    });
    expect(html).toMatch(/<form[^>]*novalidate=""/i);
    arBundet(html, "losenord", "Lösenordet måste vara minst 8 tecken.");
  });
});

describe("inställningarna: meningen vid fältet, inte längst ned i kortet", () => {
  const forvarvet = (resultat: Record<string, unknown>) =>
    rendera(
      createElement(ForvarvetKort, {
        data: {
          tilltradesdatum: "2018-06-01",
          kopeskillingOren: null,
          kopkostnaderOren: null,
          arBostadsratt: false,
          agarandelProcent: 100,
          bostadsfragor: { upplatelseform: "fastighet", forstaAgare: false, ombildning: null },
        },
        oppen: true,
        formRef: { current: null },
        onAndra: () => {},
        onAvbryt: () => {},
        onDirty: () => {},
        onKlar: () => {},
      }),
      resultat,
    );

  it("köpeskillingen: direkt efter fältet, före nästa", () => {
    const mening = "Köpeskilling anges som ett belopp, t.ex. 3 250 000.";
    const html = forvarvet({ fel: mening, falt: "kopeskilling" });
    arBundet(html, "kopeskilling", mening);
    expect(html.indexOf(mening)).toBeLessThan(html.indexOf('name="kopkostnader"'));
    expect(html.split(mening)).toHaveLength(2);
  });

  it("ägarandelen: i ägarandelsfältet, bunden", () => {
    const mening = "Ägarandel anges som ett tal mellan 0 och 100, t.ex. 50 eller 33,33.";
    arBundet(forvarvet({ fel: mening, falt: "agarandel" }), "agarandel", mening);
  });

  it("tillträdesdatumet: i datumfältet, bundet", () => {
    const mening = "Tillträdesdatum före 1970 stöds inte.";
    const html = forvarvet({ fel: mening, falt: "tilltradesdatum" });
    const ar = html.match(/<input[^>]*aria-label="År"[^>]*>/)![0];
    expect(ar).toContain('aria-invalid="true"');
    const id = ar.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`id="${id}" role="alert"[^>]*>${mening}<`));
  });
});

describe("kvittots ändringsläge: resten av fälten", () => {
  const redigera = (resultat: Record<string, unknown>) =>
    rendera(
      createElement(RedigeraVy, {
        kostnadId: "k1",
        projekt: [{ id: "p1", namn: "Badrummet", ar: 2026 }],
        varden: {
          leverantor: "",
          totalbelopp: "10000,00",
          totalbeloppVisning: 1_000_000,
          dokumentdatum: "2026-05-01",
          betaldatum: "2026-05-01",
          projektId: "p1",
          rotUtnyttjat: "",
          anteckning: "",
        },
        innehav: { tilltradesdatum: "2016-06-01", forsaljningsdatum: null },
        privatDel: { forvalt: "" },
        onAvbryt: () => {},
        onSparat: () => {},
      }),
      resultat,
    );

  it("leverantören: vid fältet, inte ovanför knappen", () => {
    const html = redigera({ fel: "Fyll i leverantör.", falt: "leverantor" });
    arBundet(html, "leverantor", "Fyll i leverantör.");
    expect(html.split("Fyll i leverantör.")).toHaveLength(2);
  });

  it("projektkopplingen: vid listan", () => {
    const html = redigera({ fel: "Det valda projektet finns inte.", falt: "projekt_id" });
    arBundet(html, "projekt_id", "Det valda projektet finns inte.");
  });
});
