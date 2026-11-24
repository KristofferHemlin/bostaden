// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hjälptexten till frågan om första ägaren (docs/design.md, "Hjälptexten till
// första ägaren gäller båda upplåtelseformerna", 2026-11-24). Till dess
// slutade den "…eller om du köpte en tomt och byggde hus på den" – en sats som
// aldrig kan gälla en bostadsrätt – och den stod avskriven på två ställen.
//
// Ställena, uppräknade ur koden 2026-11-24 (sökning på "nyproduktion" och
// "byggde hus" i src/): /bostaden/fragor (BostadsfragorFormular) och kortet
// Förvärvet i inställningarna. Båda läser nu src/lib/forsta-agaren.ts. Provet
// renderar båda, för båda upplåtelseformerna, och läser den väntade texten ur
// design.md – inte ur konstanten.

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/",
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BostadsfragorFormular } from "@/components/bostadsfragor-formular";
import { ForvarvetKort } from "@/app/installningar/kort";
import type { Bostadsfragesvar } from "@/doman/bostadsfragor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function designensLydelse(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/^\*\*Den nya lydelsen är:\*\* \*"([^"]+)"\*/m);
  if (!m) throw new Error('design.md saknar "Den nya lydelsen är:" under hjälptexten till första ägaren');
  return m[1];
}

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

const ingenting = () => {};

async function fragorna(upplatelseform: "bostadsratt" | "fastighet") {
  const givna: Bostadsfragesvar = { upplatelseform, forstaAgare: null, ombildning: null };
  await act(async () =>
    rot.render(createElement(BostadsfragorFormular, { action: async () => ({}), givna })),
  );
}

async function forvarvet(upplatelseform: "bostadsratt" | "fastighet") {
  await act(async () =>
    rot.render(
      createElement(ForvarvetKort, {
        data: {
          tilltradesdatum: "2020-03-01",
          kopeskillingOren: null,
          kopkostnaderOren: null,
          arBostadsratt: upplatelseform === "bostadsratt",
          agarandelProcent: 100,
          bostadsfragor: { upplatelseform, forstaAgare: null, ombildning: null },
        },
        oppen: true,
        formRef: { current: null },
        onAndra: ingenting,
        onAvbryt: ingenting,
        onDirty: ingenting,
        onKlar: ingenting,
      }),
    ),
  );
}

/** Varje element vars hela text är något som nämner nyproduktion – hjälptexten,
 *  vilken lydelse den än har. Hela texten, aldrig en delsträng (CLAUDE.md). */
function hjalptexter(): string[] {
  return [...behallare.querySelectorAll("p")]
    .map((p) => (p.textContent ?? "").trim())
    .filter((t) => /nyproduktion/.test(t));
}

describe("hjälptexten till första ägaren, på båda skärmarna och för båda formerna", () => {
  for (const [skarm, rendera] of [
    ["/bostaden/fragor", fragorna],
    ["Förvärvet i inställningarna", forvarvet],
  ] as const) {
    for (const form of ["bostadsratt", "fastighet"] as const) {
      it(`${skarm}, ${form}: designens lydelse, en gång`, async () => {
        const lydelse = designensLydelse();
        // Förutsättningen: lydelsen nämner inte tomt och hus.
        expect(lydelse).not.toMatch(/tomt|byggde hus/);
        await rendera(form);
        // Förutsättningen: frågan om första ägaren står på skärmen.
        expect(behallare.textContent).toMatch(/första ägaren/i);
        expect(hjalptexter()).toEqual([lydelse]);
        expect(behallare.textContent).not.toMatch(/byggde hus/);
      });
    }
  }
});
