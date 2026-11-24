import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// Fokus och fel delar aldrig färg (docs/design.md, "Fokus är en plats, ett fel
// är en dom"; CLAUDE.md, "Fokus och fel får aldrig dela färg"). Till
// 2026-11-24 fick fälten en ring i --accent vid fokus, feltextens ton, och
// ingen stil alls för ogiltigt: ett markerat fält såg felaktigt ut.
//
// Valet: fokus är en ring UTANFÖR fältet i --text-primar, ogiltigt en kant
// INNANFÖR i --accent som hänger på aria-invalid. Ring är box-shadow och kant
// är border, så de syns samtidigt – hon står oftast i fältet som är fel.
//
// Mätt i Chrome med appens CSS byggd av Tailwind, på de riktiga fälten
// (AgarandelFalt bär INPUT_KLASS, DatumFalt sin egen), i fyra lägen: vila,
// fokus, ogiltigt och båda. Färgerna läses ur globals.css, inte skrivs av.
// Måttet är getComputedStyle: box-shadow för ringen (Tailwinds ring är en
// skugga med 2 px spridning) och border-top-color för kanten. Saknas Chrome
// FALLER provet.
//
// Knapparnas fokusringar (focus-visible) räknas upp ur koden längst ned:
// varje fokusring i src ska ha --text-primar, aldrig felets ton.

const ROT = process.cwd();

/** "#a94e22" → "rgb(169, 78, 34)", som getComputedStyle skriver den. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
function variabel(namn: string): string {
  const css = readFileSync(join(ROT, "src/app/globals.css"), "utf-8");
  const m = css.match(new RegExp(`--${namn}:\\s*(#[0-9a-fA-F]{6});`));
  if (!m) throw new Error(`globals.css saknar --${namn} som hex`);
  return rgb(m[1]);
}

let w: Webblasare;

const sida = (css: string, kropp: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body class="font-granssnitt bg-yta-upphojd" style="padding:16px">${kropp}</body></html>`;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta vad som syns – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { AgarandelFalt } = await import("@/components/agarandel-falt");
  const { DatumFalt } = await import("@/components/datum-falt");
  const kropp = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement("div", { id: "andel-giltig" }, createElement(AgarandelFalt, { name: "a", defaultValue: "50" })),
      createElement("div", { id: "andel-ogiltig" }, createElement(AgarandelFalt, { name: "b", defaultValue: "50", fel: "Fel." })),
      createElement("div", { id: "datum-giltig" }, createElement(DatumFalt, { name: "c", defaultValue: "2020-03-01" })),
      createElement("div", { id: "datum-ogiltig" }, createElement(DatumFalt, { name: "d", defaultValue: "2020-03-01", fel: "Fel." })),
    ),
  );
  w = await startaWebblasare({ sida: sida(css, kropp) }, "kvittobo-fokus-och-fel-");
  await w.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  // Utan skärm har fönstret självt inget fokus, och då matchar :focus inte –
  // emuleringen ger sidan fokus som i en webbläsare hon tittar på.
  await w.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await w.cdp("Page.navigate", { url: `${w.adress}sida` });
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

interface Matt {
  ring: string | null;
  kant: string;
  bredd: number;
  hojd: number;
  ogiltig: string | null;
}

/** Första synliga inputen i behållaren, med eller utan fokus. */
async function mat(behallare: string, fokus: boolean): Promise<Matt> {
  return w.utvardera<Matt>(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
    const el = document.querySelector(${JSON.stringify(`#${behallare} input:not([type=hidden])`)});
    if (!el) throw new Error('ingen input i #${behallare}');
    document.activeElement?.blur();
    if (${fokus}) el.focus();
    if (${fokus} && document.activeElement !== el) throw new Error('fokus hamnade inte i fältet');
    const s = getComputedStyle(el);
    const ring = s.boxShadow.split(/,(?![^(]*\\))/).map(x => x.trim()).find(x => /0px 0px 0px 2px/.test(x));
    return {
      ring: ring ? ring.replace(/ 0px 0px 0px 2px.*/, '') : null,
      kant: s.borderTopColor,
      bredd: el.getBoundingClientRect().width,
      hojd: el.getBoundingClientRect().height,
      ogiltig: el.getAttribute('aria-invalid'),
    };
  })()`);
}

const GENOMSKINLIG = "rgba(0, 0, 0, 0)";

describe.each([
  ["ägarandelsfältet (INPUT_KLASS)", "andel"],
  ["datumfältet", "datum"],
])("%s", (_namn, id) => {
  it("förutsättningen: det ogiltiga fältet är märkt, det giltiga inte", async () => {
    expect((await mat(`${id}-ogiltig`, false)).ogiltig).toBe("true");
    expect((await mat(`${id}-giltig`, false)).ogiltig).toBeNull();
  }, 30_000);

  it("vila: ingen ring och ingen synlig kant", async () => {
    const m = await mat(`${id}-giltig`, false);
    expect(m.ring).toBeNull();
    expect(m.kant).toBe(GENOMSKINLIG);
  }, 30_000);

  it("fokus: en ring i textens ton, och ingen felkant", async () => {
    const m = await mat(`${id}-giltig`, true);
    expect(m.ring).toBe(variabel("text-primar"));
    expect(m.kant).toBe(GENOMSKINLIG);
  }, 30_000);

  it("ogiltigt: en kant i felets ton, och ingen ring", async () => {
    const m = await mat(`${id}-ogiltig`, false);
    expect(m.kant).toBe(variabel("accent"));
    expect(m.ring).toBeNull();
  }, 30_000);

  it("fokus i ett ogiltigt fält: båda syns samtidigt", async () => {
    const m = await mat(`${id}-ogiltig`, true);
    expect(m.ring).toBe(variabel("text-primar"));
    expect(m.kant).toBe(variabel("accent"));
  }, 30_000);

  it("fokus och ogiltigt renderas aldrig likadant – och ringen har aldrig felets ton", async () => {
    const fokus = await mat(`${id}-giltig`, true);
    const ogiltig = await mat(`${id}-ogiltig`, false);
    expect([fokus.ring, fokus.kant]).not.toEqual([ogiltig.ring, ogiltig.kant]);
    expect(fokus.ring).not.toBe(ogiltig.kant);
    expect(fokus.ring).not.toBe(variabel("accent"));
  }, 30_000);

  it("kanten flyttar ingenting: samma mått giltigt och ogiltigt", async () => {
    const a = await mat(`${id}-giltig`, false);
    const b = await mat(`${id}-ogiltig`, false);
    expect([b.bredd, b.hojd]).toEqual([a.bredd, a.hojd]);
  }, 30_000);
});

it("ägarandelsfältet är lika högt som före kanten: 48 px (2 + 10 + 24 + 10 + 2, förut 12 + 24 + 12)", async () => {
  expect((await mat("andel-giltig", false)).hojd).toBe(48);
}, 30_000);

// Uppräkningen ur koden: varje fokusring i src. Den 2026-11-24 fann nio
// ställen i sju filer, alla i --accent. Ett nytt ställe i felets ton fäller
// provet här, och provet faller också om uppräkningen inte hittar något.
describe("varje fokusring i koden", () => {
  function filer(katalog: string): string[] {
    return readdirSync(katalog).flatMap((n) => {
      const p = join(katalog, n);
      return statSync(p).isDirectory() ? filer(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
    });
  }
  const traffar = () =>
    filer(join(ROT, "src")).flatMap((f) =>
      [...readFileSync(f, "utf-8").matchAll(/(?:group-)?focus(?:-visible|-within)?:(?:ring|outline|border)-([a-z-]+)/g)]
        .map((m) => ({ fil: f.slice(ROT.length + 1), farg: m[1] }))
        .filter((t) => !/^(\d|inset|offset|none)/.test(t.farg)),
    );

  it("finns, och har alla textens ton – ingen har felets", () => {
    const t = traffar();
    expect(t.length, "uppräkningen hittade fokusringar").toBeGreaterThanOrEqual(9);
    expect(t.filter((x) => x.farg !== "text-primar")).toEqual([]);
  });
});
