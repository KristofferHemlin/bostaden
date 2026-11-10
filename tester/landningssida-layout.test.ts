import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Landningssida } from "@/app/landningssida";
import tailwindKonfig from "../tailwind.config";

// docs/design.md, "Landningssidans luft" och "Sidans sektioner ska synas som
// sektioner": hela Skapa konto ska synas utan att rulla – inom 700 px vid
// 390 px bredd, och inom fonstret vid 1280 × 800. Rubriken ar den variabel som
// far ge vika, och den far bara vaxa pa bred skarm.
//
// Det gar inte att prova i jsdom, som inte raknar ut layout. Testet bygger
// darfor appens riktiga CSS med Tailwind, renderar landningssidan med samma
// typsnitt som rotlayouten laddar, och mater i Chrome. Saknas Chrome, eller
// laddas inte typsnitten, FALLER testet: en matning med reservtypsnitt ger
// andra radbrytningar, och ett test som tyst hoppar over sig sjalvt kan inte
// falla.
//
// Uppmatt 2026-10-24 i den korande appen: 628–678 px vid 390 px, och 719–775
// px vid 1280 × 800 med rubriken i 40,5 px och spalten 560 px bred. Marginalen
// dar ar 25 px – en rad brodtext (27 px) till i hjaltedelen, och knappen
// hamnar under. "800" ar den synliga ytan, inte skarmen (docs/design.md).

const CHROME =
  process.env.CHROME_SOKVAG ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROT = process.cwd();

// Typsnittslanken lases ur rotlayouten, sa att testet laddar exakt det appen laddar.
const TYPSNITT = readFileSync(join(ROT, "src/app/layout.tsx"), "utf-8").match(
  /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/,
)![1];

let server: Server;
let chrome: ChildProcess;
let profil: string;
let ws: WebSocket;
let adress: string;
let nasta = 0;
const vantande = new Map<number, (m: { result?: unknown; error?: unknown }) => void>();

function cdp<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return new Promise((losa, avvisa) => {
    const id = ++nasta;
    vantande.set(id, (m) => (m.error ? avvisa(new Error(JSON.stringify(m.error))) : losa(m.result as T)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);

  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${TYPSNITT}"><style>${css}</style></head>
<body class="font-granssnitt">${renderToStaticMarkup(Landningssida())}</body></html>`;

  // Sidan och public/, sa att bilden laddas som i appen.
  const typer: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png" };
  server = createServer((req, res) => {
    const sokvag = (req.url ?? "/").split("?")[0];
    if (sokvag === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
      return;
    }
    const fil = join(ROT, "public", sokvag);
    if (!fil.startsWith(join(ROT, "public")) || !existsSync(fil)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": typer[extname(fil)] ?? "application/octet-stream" }).end(readFileSync(fil));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  adress = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  profil = mkdtempSync(join(tmpdir(), "kvittobo-layout-"));
  chrome = spawn(
    CHROME,
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profil}`, "--no-first-run", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  // Chrome skriver sin debug-adress pa stderr nar porten ar vald.
  const wsAdress = await new Promise<string>((losa, avvisa) => {
    let logg = "";
    const tid = setTimeout(() => avvisa(new Error(`Chrome startade inte:\n${logg}`)), 15_000);
    chrome.stderr!.on("data", (d: Buffer) => {
      logg += d.toString();
      const t = logg.match(/DevTools listening on (ws:\/\/\S+)/);
      if (t) {
        clearTimeout(tid);
        losa(t[1]);
      }
    });
  });
  const port = new URL(wsAdress).port;
  const sidor = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
  ws = new WebSocket(sidor.find((s) => s.type === "page")!.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && vantande.has(m.id)) {
      vantande.get(m.id)!(m);
      vantande.delete(m.id);
    }
  };
}, 60_000);

afterAll(async () => {
  ws?.close();
  if (chrome && chrome.exitCode === null) {
    const avslutad = new Promise((r) => chrome.once("exit", r));
    chrome.kill();
    await avslutad;
  }
  server?.close();
  // Chromes hjalpprocesser skriver i profilen en kort stund efter att
  // huvudprocessen avslutats, och en enda rmSync kan da kasta ENOTEMPTY – en
  // rod korning dar varje matning gick igenom. Uppmatt 2026-11-10. Forsok
  // igen i stallet for att lata stadningen falla sviten.
  if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

interface Matning {
  typsnittLaddade: boolean;
  fonsterBredd: number;
  /** Varje avsnitts textspalt, i sidans ordning. */
  spalter: { vanster: number; hoger: number; bredd: number }[];
  /** Menyns lankar: text och om de syns (har en yta och ar inte dolda). */
  meny: { text: string; syns: boolean }[];
  /** Varje band: dess bakgrund, om det har en linje overst, och korten i det. */
  band: { bakgrund: string; linje: boolean; kort: string[] }[];
  hjaltensBakgrund: string;
  fonsterHojd: number;
  knappOverkant: number;
  knappUnderkant: number;
  rubrikStorlek: string;
}

async function mat(bredd: number, hojd: number): Promise<Matning> {
  const telefon = bredd < 500;
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: bredd,
    height: hojd,
    deviceScaleFactor: telefon ? 3 : 1,
    mobile: telefon,
  });
  await cdp("Page.navigate", { url: `${adress}?${bredd}x${hojd}` });
  await vanta(500);
  const svar = await cdp<{ result: { value: Matning }; exceptionDetails?: { exception?: { description?: string } } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
      await document.fonts.ready;
      const knapp = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Skapa konto');
      const k = knapp.getBoundingClientRect();
      return {
        // Inte document.fonts.check(): den svarar sant aven nar typsnittet
        // inte finns deklarerat alls, till exempel utan natverk.
        typsnittLaddade: ['Fraunces', 'Instrument Sans'].every(namn =>
          [...document.fonts].some(f => f.family.replace(/["']/g, '') === namn && f.status === 'loaded')),
        fonsterHojd: window.innerHeight,
        fonsterBredd: document.documentElement.clientWidth,
        spalter: [...document.querySelectorAll('[data-spalt]')].map(e => {
          const r = e.firstElementChild.getBoundingClientRect();
          return { vanster: r.left, hoger: r.right, bredd: r.width };
        }),
        meny: [...document.querySelectorAll('[data-meny] a')].map(a => {
          const r = a.getBoundingClientRect();
          return { text: a.textContent.trim(), syns: r.width > 0 && r.height > 0 && getComputedStyle(a).visibility !== 'hidden' };
        }),
        band: [...document.querySelectorAll('section')].map(s => ({
          bakgrund: getComputedStyle(s).backgroundColor,
          linje: parseFloat(getComputedStyle(s).borderTopWidth) > 0,
          // Korten hittas pa rubriken, inte pa en klass: varje stycke i
          // regelavsnittet ligger i sitt kort.
          kort: s.querySelector('h2').textContent.trim() === 'Vad räknas som förbättringsutgift?'
            ? [...s.querySelectorAll('p')].map(p => getComputedStyle(p.parentElement).backgroundColor)
            : [],
        })),
        hjaltensBakgrund: getComputedStyle(document.querySelector('main').parentElement).backgroundColor,
        knappOverkant: k.top + window.scrollY,
        knappUnderkant: k.bottom + window.scrollY,
        rubrikStorlek: getComputedStyle(document.querySelector('h1')).fontSize,
      };
    })()`,
  });
  // Kastar uttrycket i webblasaren ar vardet tomt, och da skulle forsta
  // kontrollen nedan – typsnitten – fa skulden for nagot helt annat. Uppmatt
  // 2026-11-10: en borttagen valjare rapporterades som "typsnitten laddades
  // inte". Felet ska fallas med sin egen text.
  if (svar.exceptionDetails) {
    throw new Error(`mätningen kastade i webbläsaren: ${svar.exceptionDetails.exception?.description ?? JSON.stringify(svar.exceptionDetails)}`);
  }
  const m = svar.result.value;
  expect(m.typsnittLaddade, "Fraunces och Instrument Sans måste laddas – med reservtypsnitt mäts fel radbrytningar").toBe(true);
  return m;
}

// "680 px är textens mått" – talet lases ur docs/design.md, inte ur koden, och
// inne i testet: ett uppslag som kastar nar filen laddas tar hela filen med sig
// (CLAUDE.md, Tester).
function textensMatt(): number {
  const m = readFileSync(join(ROT, "docs/design.md"), "utf-8").match(/(\d+) px är textens mått/);
  if (!m) throw new Error('design.md saknar "… px är textens mått"');
  return Number(m[1]);
}

describe("sektionerna under knappen ligger centrerade i sidan, i textens mått", () => {
  // docs/design.md, "Sidans sektioner ska synas som sektioner". Uppmatt
  // 2026-10-24 vid 1440 px: sektionerna lag kvar 162 px in med 598 px tomt
  // till hoger. Pa smal skarm fyller de bredden och felet syns inte – darfor
  // mats det pa bred skarm.
  it.each([
    [1440, 900],
    [1280, 800],
  ])("vid %i × %i", async (bredd, hojd) => {
    const { spalter, fonsterBredd } = await mat(bredd, hojd);
    const TEXTENS_MATT = textensMatt();
    expect(TEXTENS_MATT).toBe(680);
    expect(spalter, "sidan ska ha sex avsnitt, vart och ett med sin spalt").toHaveLength(6);
    for (const s of spalter) {
      expect(s.bredd).toBeLessThanOrEqual(TEXTENS_MATT);
      // Lika mycket luft pa bada sidor, inom en pixels avrundning.
      expect(Math.abs(s.vanster - (fonsterBredd - s.hoger))).toBeLessThanOrEqual(1);
    }
  }, 60_000);
});

describe("Skapa konto syns utan att rulla", () => {
  it("vid 390 × 844: rubriken är 24 px, som när knappen mättes, och knappen ligger inom 700 px", async () => {
    const m = await mat(390, 844);
    expect(m.rubrikStorlek).toBe("24px");
    expect(m.knappUnderkant).toBeLessThanOrEqual(700);
  }, 60_000);

  it("vid 1280 × 800: hela knappen ligger inom fönstret", async () => {
    const m = await mat(1280, 800);
    expect(m.fonsterHojd).toBe(800);
    expect(m.knappUnderkant).toBeLessThanOrEqual(m.fonsterHojd);
  }, 60_000);
});

// Menyn i toppraden (docs/design.md, Landningssidan): tre ankarlankar fran
// surfplattans brytpunkt, och inga pa telefon – dar rymmer raden tva saker.
// Mats i webblasaren: att en klass dolj er nagot sager ingenting om vad som syns.
describe("menyn i toppraden", () => {
  it("syns inte vid 375 × 812", async () => {
    const { meny } = await mat(375, 812);
    expect(meny).toHaveLength(3);
    expect(meny.filter((l) => l.syns)).toEqual([]);
  }, 60_000);

  it.each([
    [768, 1024],
    [1440, 900],
  ])("syns vid %i × %i, alla tre", async (bredd, hojd) => {
    const { meny } = await mat(bredd, hojd);
    expect(meny.map((l) => l.syns)).toEqual([true, true, true]);
  }, 60_000);
});

// Banden (docs/design.md, "Sidans sektioner ska synas som sektioner"): tva
// band som moter varandra har olika yta, och da behovs ingen linje; linjen
// star kvar bara mellan tva med samma yta. Ett kort tar alltid motsatt yta mot
// sitt band. Hjaltedelen raknas som det forsta bandets granne.
describe("avsnitten ar band", () => {
  it.each([
    [375, 812],
    [1440, 900],
  ])("vid %i × %i: varje grans ar ett ytbyte eller en linje, aldrig bada", async (bredd, hojd) => {
    const { band, hjaltensBakgrund } = await mat(bredd, hojd);
    expect(band).toHaveLength(6);
    band.forEach((b, i) => {
      const fore = i === 0 ? hjaltensBakgrund : band[i - 1].bakgrund;
      expect({ avsnitt: i + 1, linje: b.linje }).toEqual({ avsnitt: i + 1, linje: b.bakgrund === fore });
    });
    // Banden vaxlar faktiskt – annars vore varje grans en linje och sidan
    // densamma som fore banden.
    expect(new Set(band.map((b) => b.bakgrund)).size).toBe(2);
  }, 60_000);

  it("vid 1440 × 900: varje kort har en annan yta an sitt band", async () => {
    const { band } = await mat(1440, 900);
    const medKort = band.filter((b) => b.kort.length > 0);
    expect(medKort.length, "minst ett band ska ha kort").toBeGreaterThan(0);
    for (const b of medKort) for (const k of b.kort) expect(k).not.toBe(b.bakgrund);
  }, 60_000);
});
