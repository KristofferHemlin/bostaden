import { describe, expect, it, vi } from "vitest";

// docs/design.md, "När ett formulär vägrar": en avvisning star vid det falt
// den galler, bar role="alert", och faltet far aria-invalid och
// aria-describedby som pekar pa meningen. Uppmatt 2026-10-19: ROT-meningen i
// kvittots andringslage stod ovanfor Spara-knappen (y≈1411) medan ROT-faltet
// lag pa y≈438, utan role="alert" och utan aria-invalid – faltet visade en
// rod ram utan ord.
//
// "Vid faltet" provas pa tva satt: aria-describedby pa faltet pekar pa
// meningens id, och meningen kommer direkt efter faltet i dokumentet – fore
// nasta falt, inte vid knappen. Var pixlarna hamnar gar inte att prova utan
// en webblasare; den delen vilar pa ogat.

const h = vi.hoisted(() => ({
  resultat: {} as { fel?: string; falt?: string },
}));

// Andringslagets tillstand efter ett svar fran servern: useActionState
// lamnar det resultat testet anger.
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useActionState: () => [h.resultat, () => {}, false],
  };
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";

const ROT_FEL =
  "Ange ett ROT-avdrag mindre än 4 000 kr – det är vad kvittot kostade utan den privata delen.";

function rendera(resultat: { fel?: string; falt?: string }): string {
  h.resultat = resultat;
  return renderToStaticMarkup(
    createElement(RedigeraVy, {
      kostnadId: "k1",
      projekt: [],
      varden: {
        leverantor: "Hantverkarn AB",
        totalbelopp: "10000,00",
        totalbeloppVisning: 1_000_000,
        dokumentdatum: "2026-05-01",
        betaldatum: "2026-05-01",
        projektId: "",
        rotUtnyttjat: "5000,00",
        anteckning: "",
      },
      innehav: { tilltradesdatum: "2016-06-01", forsaljningsdatum: null },
      privatDel: { forvalt: "6000,00" },
      onAvbryt: () => {},
      onSparat: () => {},
    }),
  );
}

/** Den input som bar ett visst name, som en tagg. */
function input(html: string, name: string): string {
  const m = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  if (!m) throw new Error(`Inget falt ${name}`);
  return m[0];
}

describe("ROT-avvisningen i kvittots ändringsläge", () => {
  const html = rendera({ fel: ROT_FEL, falt: "rot_utnyttjat" });

  it("står direkt efter ROT-fältet, före nästa fält – inte vid knappen", () => {
    const rot = html.indexOf('name="rot_utnyttjat"');
    const mening = html.indexOf(ROT_FEL);
    const nastaFalt = html.indexOf('name="dokumentdatum"');
    expect(rot).toBeGreaterThan(-1);
    expect(mening).toBeGreaterThan(rot);
    expect(mening).toBeLessThan(nastaFalt);
    // Och bara en gang – inte ocksa ovanfor knappen.
    expect(html.split(ROT_FEL)).toHaveLength(2);
  });

  it("bär role=\"alert\", och fältet pekar på den med aria-describedby", () => {
    const falt = input(html, "rot_utnyttjat");
    const id = falt.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(
      new RegExp(`<span id="${id}" role="alert"[^>]*>${ROT_FEL}</span>`),
    );
  });

  it("fältet har aria-invalid och tar fokus", () => {
    const falt = input(html, "rot_utnyttjat");
    expect(falt).toContain('aria-invalid="true"');
    expect(falt).toContain("data-faltfel");
  });

  it("ROT-sektionen är utfälld, så att meningen syns", () => {
    expect(html).toContain('aria-expanded="true"');
  });
});

describe("försäkringsersättningen har inget eget fält – meningen står där basen krympte", () => {
  it("vid den privata delen", () => {
    const fel = "Försäkringsersättningen kan vara högst 4 000 kr – det är vad kvittot kostade utan den privata delen.";
    const html = rendera({ fel, falt: "privatbelopp" });
    const falt = input(html, "privatbelopp");
    const id = falt.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`<span id="${id}" role="alert"[^>]*>${fel}</span>`));
  });
});

describe("ett fel utan fält står ovanför knappen, med role=\"alert\"", () => {
  it("och tar fokus", () => {
    const html = rendera({ fel: "Kvittot hittades inte." });
    expect(html).toMatch(/<p role="alert" tabindex="-1" data-formularfel=""[^>]*>Kvittot hittades inte\.<\/p>/);
  });
});
