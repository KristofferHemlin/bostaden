import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RaderaBilagaFraga } from "@/app/kostnad/[id]/bilagor";
import { RaderaKvittoFraga } from "@/app/kostnad/[id]/kvitto-kort";
import { RaderaProjektFraga } from "@/app/projekt/[id]/redigera/form";
import {
  BytKortRuta,
  BytUpplatelseformFraga,
} from "@/app/installningar/kort";
import { BekraftaBorttagningRuta } from "@/components/bekrafta-borttagning";
import { SparfragaRuta } from "@/components/sparfraga";

// Appens bekraftelserutor har en och samma regel (docs/design.md, "Vad 44
// px-regeln galler", "Kvittolistan"): en dialog finns for att handlingen
// kostar nagot att missa, och da far dess svar inte vara de minsta
// kontrollerna pa skarmen. Testet renderar varje ruta och provar samma krav
// pa alla – en ny ruta laggs till i listan, och en som glider isar faller.
//
// Uppmatt i produktionen 2026-10-18: "Ta bort" 52 × 23 px och "Avbryt"
// 49 × 23 px, 17 px isar, i rutan som raderar en bilaga.

const ingenting = () => {};

const RADERINGSRUTOR: [string, ReactElement][] = [
  [
    "Ta bort bilagan (inmatningen, utkast med bilaga)",
    createElement(BekraftaBorttagningRuta, {
      text: "Ta bort bilagan? Den går inte att få tillbaka.",
      onTaBort: ingenting,
      onAvbryt: ingenting,
    }),
  ],
  [
    "Ta bort bilagan (kvittots skärm)",
    createElement(RaderaBilagaFraga, {
      bilagaId: "b1",
      kostnadId: "k1",
      action: ingenting,
      raderar: false,
      onAvbryt: ingenting,
    }),
  ],
  [
    "Ta bort kvittot och alla dess bilagor",
    createElement(RaderaKvittoFraga, {
      kostnadId: "k1",
      action: ingenting,
      raderar: false,
      onAvbryt: ingenting,
    }),
  ],
  [
    "Ta bort projektet",
    createElement(RaderaProjektFraga, {
      projektId: "p1",
      action: ingenting,
      raderar: false,
      onAvbryt: ingenting,
    }),
  ],
  [
    "Byte av upplåtelseform",
    createElement(BytUpplatelseformFraga, {
      text: "Byt till bostadsrätt?",
      onByt: ingenting,
      onAvbryt: ingenting,
    }),
  ],
];

const FRAGERUTOR: [string, ReactElement][] = [
  [
    "Osparade ändringar",
    createElement(BytKortRuta, {
      franKort: "Förvärvet",
      pagar: false,
      onSpara: ingenting,
      onKasta: ingenting,
      onAvbryt: ingenting,
    }),
  ],
  [
    "Inget kvitto bifogat / Datumet ligger före tillträdet (samma ram)",
    createElement(SparfragaRuta, {
      id: "fraga",
      rubrik: "Inget kvitto bifogat",
      children: null,
      primar: { text: "Bifoga något", onClick: ingenting },
      dampade: [{ text: "Spara ändå", onClick: ingenting }],
    }),
  ],
];

function knappklasser(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*\bclass="([^"]*)"/g)].map(
    (m) => m[1],
  );
}

function provaRollOchFokus(html: string) {
  // Exakt en dialog, med ett namn som pekar pa nagot som finns.
  const dialoger = [...html.matchAll(/role="dialog"/g)];
  expect(dialoger).toHaveLength(1);
  const namn = html.match(/role="dialog"[^>]*aria-labelledby="([^"]+)"/)?.[1]
    ?? html.match(/aria-labelledby="([^"]+)"[^>]*role="dialog"/)?.[1];
  expect(namn).toBeTruthy();
  expect(html).toContain(`id="${namn}"`);
  // Fokus flyttas in i rutan – till rutan sjalv, som darfor ar fokuserbar.
  expect(html).toContain('tabindex="-1"');
}

describe.each(RADERINGSRUTOR)("bekräftelserutan: %s", (_namn, ruta) => {
  const html = renderToStaticMarkup(ruta);

  it("har role=\"dialog\", ett namn och tar fokus", () => {
    provaRollOchFokus(html);
  });

  it("har två svar, båda 44 px höga", () => {
    const klasser = knappklasser(html);
    expect(klasser).toHaveLength(2);
    for (const k of klasser) expect(k).toContain("min-h-[44px]");
  });

  it("svaren delar raden lika", () => {
    for (const k of knappklasser(html)) expect(k).toContain("flex-1");
  });

  it("inget svar är orange", () => {
    for (const k of knappklasser(html)) expect(k).not.toContain("accent");
  });
});

describe.each(FRAGERUTOR)("frågerutan: %s", (_namn, ruta) => {
  const html = renderToStaticMarkup(ruta);

  it("har role=\"dialog\", ett namn och tar fokus", () => {
    provaRollOchFokus(html);
    expect(html).toContain('aria-modal="true"');
  });

  it("varje svar är 44 px högt och radens bredd", () => {
    const klasser = knappklasser(html);
    expect(klasser.length).toBeGreaterThanOrEqual(2);
    for (const k of klasser) {
      expect(k).toContain("min-h-[44px]");
      expect(k).toContain("w-full");
    }
  });
});
