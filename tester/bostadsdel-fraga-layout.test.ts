import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";
import { knapptabellen } from "./_bostadsdelar-design";

// docs/design.md, "Vad projektet rörde": grupprubrikerna ar etiketter, inte
// rubriker – samma storlek som brodtexten och aldrig under golvet pa 14 px –
// och ordningen bars av avstandet: tatt ned till knapparna, luft ovanfor.
// "Ingen etikett byter storlek, vikt eller färg."
//
// Det gar inte i jsdom, som varken tillampar CSS:en eller raknar layout
// (CLAUDE.md, "En klass är inte en layout"). Fragan renderas som den ar for
// en fastighet, appens CSS byggs med Tailwind, och storlekar och avstand
// mats i Chrome med appens typsnitt vid telefonbredd. Saknas Chrome eller
// laddas inte typsnitten FALLER testet, som i
// tester/adressforslag-layout.test.ts.
//
// Hur talen tas fram: storlek, vikt och farg ur getComputedStyle. Avstandet
// under en grupprubrik ar fran rubrikens underkant till overkanten pa
// forsta knappen i gruppen; avstandet ovanfor ar fran underkanten pa det
// som star narmast ovanfor – fragans rubrik for den forsta gruppen, gruppen
// fore (som slutar med sin sista knapprad) for den andra – till rubrikens overkant. Alla
// matt med getBoundingClientRect, i CSS-pixlar.

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { BostadsdelFraga } = await import("@/app/projekt/bostadsdel-fraga");

const ROT = process.cwd();
const TYPSNITT = readFileSync(join(ROT, "src/app/layout.tsx"), "utf-8").match(
  /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/,
)![1];

let webblasare: Webblasare;
const cdp: Webblasare["cdp"] = (method, params) => webblasare.cdp(method, params);
const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const fraga = renderToStaticMarkup(createElement(BostadsdelFraga, { upplatelseform: "fastighet" }));
  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${TYPSNITT}"><style>${css}</style></head>
<body class="font-granssnitt"><main class="mx-auto max-w-md px-4 py-6">${fraga}</main></body></html>`;
  webblasare = await startaWebblasare({ "": html }, "kvittobo-bostadsdel-");
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});

interface Stil {
  text: string;
  storlek: number;
  vikt: string;
  farg: string;
}
interface Grupp extends Stil {
  ovanfor: number;
  under: number;
}
interface Matning {
  typsnittLaddade: boolean;
  fraga: Stil | null;
  grupper: (Grupp | null)[];
}

async function mat(rubriker: string[]): Promise<Matning> {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp("Page.navigate", { url: `${webblasare.adress}?393` });
  await vanta(500);
  const svar = await cdp<{ result: { value: Matning } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
      await document.fonts.ready;
      const stil = (e) => {
        const s = getComputedStyle(e);
        return { text: e.textContent, storlek: parseFloat(s.fontSize), vikt: s.fontWeight, farg: s.color };
      };
      const legend = document.querySelector('fieldset[data-bostadsdel] > legend');
      const grupper = ${JSON.stringify(rubriker)}.map((rubrik) => {
        const g = [...document.querySelectorAll('[role="group"]')].find(
          (e) => document.getElementById(e.getAttribute('aria-labelledby'))?.textContent === rubrik);
        if (!g) return null;
        const r = document.getElementById(g.getAttribute('aria-labelledby'));
        const knapp = g.querySelector('button');
        const fore = g.previousElementSibling;
        const rr = r.getBoundingClientRect();
        return {
          ...stil(r),
          ovanfor: rr.top - fore.getBoundingClientRect().bottom,
          under: knapp.getBoundingClientRect().top - rr.bottom,
        };
      });
      return {
        typsnittLaddade: [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'Instrument Sans' && f.status === 'loaded'),
        fraga: legend ? stil(legend) : null,
        grupper,
      };
    })()`,
  });
  const m = svar.result.value;
  expect(m.typsnittLaddade, "Instrument Sans måste laddas – med reservtypsnitt mäts fel. Fraunces används inte här och laddas därför inte").toBe(true);
  return m;
}

describe("grupprubrikerna i Vad rörde projektet?", () => {
  it("är etiketter i frågans storlek, vikt och färg – aldrig under 14 px – med mer luft ovanför än under", async () => {
    const { rubriker } = knapptabellen();
    const m = await mat(rubriker);
    // Ett uteblivet fynd ar ett fel, inte ett varde att rakna vidare pa.
    expect(m.fraga, "frågans rubrik renderas inte").not.toBeNull();
    for (const [i, g] of m.grupper.entries()) {
      expect(g, `ingen grupp under rubriken ${rubriker[i]}`).not.toBeNull();
      console.log(
        `${g!.text}: ${g!.storlek} px, vikt ${g!.vikt}; ${g!.ovanfor.toFixed(1)} px ovanför, ${g!.under.toFixed(1)} px under`,
      );
      expect(g!.storlek, `${g!.text} under golvet`).toBeGreaterThanOrEqual(14);
      expect({ storlek: g!.storlek, vikt: g!.vikt, farg: g!.farg }).toEqual({
        storlek: m.fraga!.storlek,
        vikt: m.fraga!.vikt,
        farg: m.fraga!.farg,
      });
      // Mekanismen: rubriken hör till knapparna under, inte till det ovanför.
      expect(g!.under, `${g!.text}: inget mellanrum under – mätningen träffade fel element`).toBeGreaterThan(0);
      expect(g!.ovanfor, `${g!.text}: luften ovanför ska vara större än under`).toBeGreaterThan(g!.under);
    }
  }, 60_000);
});
