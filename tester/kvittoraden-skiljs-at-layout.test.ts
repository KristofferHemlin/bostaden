import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";

// docs/design.md, Kvittolistan, "Kvittoraden ska gå att skilja från nästa":
// pa kvittolistan star forsta raden under rubriken – leverantor och datum – i
// kursiv, allt darunder rakt, och ett kvitto utan bilaga far ett dampat marke
// sist pa den kursiva raden med "Inget kvitto bifogat" som etikett.
//
// Pa en riktig lista, inte pa en rad: tretton kvitton i ett ar, nagra med ROT,
// nagra med privat del, nagra med bilaga och nagra utan, och ett utkast med
// atgardspricken. Sidan renderas mot en falsk databas, appens CSS byggs med
// Tailwind, och allt mats i Chrome vid 390 px. Saknas Chrome FALLER testet.
//
// Market mats som synlighet, inte som hojd (CLAUDE.md, "Mät rätt
// egenskap"): det syns nar checkVisibility() OCH en ruta storre an noll pa
// skarmen sager samma sak, och testet faller om de ar oense. Testet faller at
// bada hallen – market finns dar bilagan saknas och INTE dar den finns.
//
// Kursiven mats som Chromes beraknade font-style pa varje rad i kvittoraden,
// inte som ett klassnamn: forsta raden under rubriken ska vara italic och
// varje annan rad normal. Startskarmens sex senaste rors inte i den har
// omgangen, sa samma matning gors dar och kraver rak stil och inget marke.
// (Startskarmen har aldrig visat "Inget kvitto bifogat".)

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/kostnad",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "bostad.test" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
}));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({
    createSignedUrl: vi.fn(),
    createSignedUrls: vi.fn(async () => ({ data: [], error: null })),
    remove: vi.fn(),
    list: vi.fn(),
  }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));
vi.mock("@/lib/dokumentavlasning/analysera", () => ({ analyseraDokumentbuffert: vi.fn() }));

const { renderToStaticMarkup } = await import("react-dom/server");
const { default: KvittolistaSida } = await import("@/app/kostnad/page");
const { default: Oversikt } = await import("@/app/page");

const CHROME =
  process.env.CHROME_SOKVAG ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROT = process.cwd();

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Markets etikett, ordagrant ur docs/design.md – lases inne i testet. */
function marketsEtikett(): string {
  const design = readFileSync(join(ROT, "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Lydelsen försvinner inte, den flyttar\.\*\* \*"([^"]+)"\* är märkets tillgänglighetsetikett/);
  if (!m) throw new Error('hittade inte meningen om märkets etikett i docs/design.md');
  return m[1];
}

interface Kvitto {
  anteckning: string;
  leverantor: string;
  dag: string;
  /** Totalbelopp i oren. */
  belopp: number;
  rot?: number;
  privat?: number;
  bilaga: boolean;
}

// Tretton kvitton i 2025, med anteckningar och belopp av det slag som ligger i
// testkontot. Blandningen ar det som gor att en rad blir tre till fem
// textrader.
const KVITTON: Kvitto[] = [
  { anteckning: "Målade om sovrummet, väggarna var slitna", leverantor: "Bauhaus Bromma", dag: "2025-03-14", belopp: 102_095, bilaga: true },
  { anteckning: "Nytt ekgolv i hallen", leverantor: "Byggmax", dag: "2025-04-02", belopp: 1_850_000, bilaga: false },
  { anteckning: "Badrumsrenovering, arbete", leverantor: "Rörmokarn i Väst AB", dag: "2025-04-20", belopp: 6_181_250, rot: 1_158_750, bilaga: true },
  { anteckning: "Färg till fasaden och en trädgårdsslang", leverantor: "Bauhaus Bromma", dag: "2025-05-02", belopp: 465_800, privat: 39_900, bilaga: true },
  { anteckning: "Fönsterbyte mot gatan", leverantor: "Fönsterfabriken", dag: "2025-05-18", belopp: 4_200_000, rot: 900_000, bilaga: false },
  { anteckning: "Kakel och fog till duschen", leverantor: "Beijer Bygg", dag: "2025-06-03", belopp: 742_500, bilaga: false },
  { anteckning: "Elarbete i köket", leverantor: "Elfirman Sverige", dag: "2025-06-21", belopp: 1_800_000, rot: 360_000, privat: 120_000, bilaga: true },
  { anteckning: "Lister och spik till vardagsrummet", leverantor: "Byggmax", dag: "2025-07-07", belopp: 98_900, bilaga: true },
  { anteckning: "Ny diskbänk och blandare, plus kökshanddukar", leverantor: "IKEA Barkarby", dag: "2025-08-15", belopp: 1_249_000, privat: 19_900, bilaga: false },
  { anteckning: "Tak över altanen", leverantor: "Snickeri Nord", dag: "2025-09-01", belopp: 3_400_000, rot: 600_000, bilaga: true },
  { anteckning: "Isolering till vinden", leverantor: "Beijer Bygg", dag: "2025-09-30", belopp: 512_000, bilaga: true },
  { anteckning: "Avfuktare till källaren", leverantor: "Clas Ohlson", dag: "2025-10-12", belopp: 299_000, bilaga: false },
  { anteckning: "Spackel och slippapper", leverantor: "Bauhaus Bromma", dag: "2025-11-05", belopp: 34_900, bilaga: true },
];
const UTKAST = "Kvitto från järnhandeln, fyller i senare";

function seeda() {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  for (const k of KVITTON) {
    const kostnad = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: k.leverantor,
      anteckning: k.anteckning,
      totalbelopp: k.belopp,
      rot_utnyttjat: k.rot ?? null,
      dokumentdatum: datum(k.dag),
      betaldatum: datum(k.dag),
      skapad_av: ANNA,
    });
    if (k.bilaga) db.lagg("bilaga", { kostnad_id: kostnad.id, sokvag: `x/${kostnad.id}.jpg`, filtyp: "image/jpeg" });
    db.lagg("kostnadsrad", { kostnad_id: kostnad.id, artikel: k.leverantor, belopp: k.belopp - (k.privat ?? 0) });
    if (k.privat) {
      const rad = db.lagg("kostnadsrad", { kostnad_id: kostnad.id, artikel: "Privat", belopp: k.privat });
      db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: null, privat: true, andel: 1 });
    }
  }
  // Ett utkast med en anteckning: det bar atgardspricken.
  db.lagg("kostnad", { bostad_id: X, anteckning: UTKAST, totalbelopp: null, skapad_av: ANNA });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

const SIDOR: Record<string, string> = {};

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

async function utvardera<T>(uttryck: string): Promise<T> {
  const svar = await cdp<{ result: { value: T }; exceptionDetails?: unknown }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: uttryck,
  });
  if (svar.exceptionDetails) throw new Error(`fel i sidan: ${JSON.stringify(svar.exceptionDetails)}`);
  return svar.result.value;
}

const sida = (css: string, kropp: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head><body class="font-granssnitt">${kropp}</body></html>`;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta vad som syns – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  seeda();
  SIDOR.kostnad = sida(css, renderToStaticMarkup(await KvittolistaSida()));
  SIDOR.oversikt = sida(
    css,
    renderToStaticMarkup(await Oversikt({ searchParams: Promise.resolve({}) } as Parameters<typeof Oversikt>[0])),
  );

  server = createServer((req, res) => {
    const namn = new URL(req.url ?? "/", "http://x").pathname.slice(1);
    const html = SIDOR[namn];
    if (!html) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  adress = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  profil = mkdtempSync(join(tmpdir(), "kvittobo-kvittoraden-"));
  chrome = spawn(
    CHROME,
    ["--headless=new", "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${profil}`, "--no-first-run", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
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
  const flikar = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
  ws = new WebSocket(flikar.find((s) => s.type === "page")!.webSocketDebuggerUrl);
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
  if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

async function oppna(namn: string) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp("Page.navigate", { url: `${adress}${namn}` });
  await utvardera(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
  })()`);
}

interface Kvittorad {
  anteckning: string;
  /** Kvittoradens textrader under rubriken, uppifran. */
  rader: { text: string; stil: string }[];
  rubrikStil: string;
  /** Market: hittat, synligt enligt bada matten, och oense matt. */
  marke: { antal: number; synligt: boolean; oense: boolean; sistPaForstaRaden: boolean; farg: string } | null;
  /** Atgardsprickens placering och farg, om raden har en. */
  prick: { forstPaForstaRaden: boolean; farg: string } | null;
}

/** Mater varje kvittorad, hittad pa sin anteckning – raden vars text ar
 *  exakt anteckningen. Saknas en rad fäller testet. */
async function matRader(anteckningar: string[], etikett: string): Promise<Kvittorad[]> {
  const svar = await utvardera<{ saknas: string[]; rader: Kvittorad[] }>(`(() => {
    const etikett = ${JSON.stringify(etikett)};
    const saknas = [], rader = [];
    for (const anteckning of ${JSON.stringify(anteckningar)}) {
      const namn = [...document.body.querySelectorAll('p')].find(p => p.textContent === anteckning);
      if (!namn) { saknas.push(anteckning); continue; }
      const kolumn = namn.parentElement;
      const under = [...kolumn.children].filter(e => e !== namn);
      const forsta = under[0];
      const marken = [...kolumn.querySelectorAll('[role="img"]')].filter(e => e.getAttribute('aria-label') === etikett);
      let marke = null;
      if (marken.length > 0) {
        const m = marken[0];
        const r = m.getBoundingClientRect();
        const enligtWebblasaren = m.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true });
        const harRuta = r.width > 0 && r.height > 0;
        // Sist pa raden, matt pa tva satt som ska vara overens: market ar
        // radens sista nod (textnoder raknas, inte bara element), och det
        // ligger till hoger om radens text pa skarmen.
        const noder = [...forsta.childNodes].filter(n => !(n.nodeType === 3 && n.textContent.trim() === ''));
        const sistNod = noder[noder.length - 1] === m;
        const text = [...forsta.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim() !== '');
        const textHoger = Math.max(...text.map(n => { const rr = document.createRange(); rr.selectNodeContents(n); return rr.getBoundingClientRect().right; }));
        const tillHoger = text.length > 0 && r.left >= textHoger - 0.5;
        marke = {
          antal: marken.length,
          synligt: enligtWebblasaren && harRuta,
          oense: enligtWebblasaren !== harRuta || sistNod !== tillHoger,
          sistPaForstaRaden: m.parentElement === forsta && sistNod && tillHoger && m.title === etikett,
          farg: getComputedStyle(m).color,
        };
      }
      const prickEl = forsta && [...forsta.children].find(e => e.getAttribute('aria-hidden') !== null && e.getBoundingClientRect().width > 0 && getComputedStyle(e).borderRadius !== '0px');
      rader.push({
        anteckning,
        rubrikStil: getComputedStyle(namn).fontStyle,
        rader: under.map(e => ({ text: e.textContent, stil: getComputedStyle(e).fontStyle })),
        marke,
        prick: prickEl ? { forstPaForstaRaden: forsta.firstElementChild === prickEl, farg: getComputedStyle(prickEl).backgroundColor } : null,
      });
    }
    return { saknas, rader };
  })()`);
  expect(svar.saknas, "kvittoraderna ska finnas i sidan").toEqual([]);
  return svar.rader;
}

describe("kvittoraden på /kostnad, mätt i Chrome vid 390 px", () => {
  it("märket syns där bilagan saknas och inte där den finns", async () => {
    const etikett = marketsEtikett();
    await oppna("kostnad");
    const rader = await matRader(KVITTON.map((k) => k.anteckning), etikett);
    for (const [i, rad] of rader.entries()) {
      const k = KVITTON[i];
      console.log(
        `${k.bilaga ? "med bilaga " : "utan bilaga"} | ${[rad.anteckning, ...rad.rader.map((r) => `${r.text} [${r.stil}]`)].join(" / ")}` +
          ` | märke: ${rad.marke ? (rad.marke.synligt ? "syns" : "finns men syns inte") : "inget"}`,
      );
      if (rad.marke) expect(rad.marke.oense, `${k.anteckning}: mätten är oense om märket`).toBe(false);
      if (k.bilaga) {
        // At andra hallet: en rad med bilaga bar ingenting dar.
        expect(rad.marke, `${k.anteckning} har bilaga och ska inte ha märket`).toBeNull();
      } else {
        expect(rad.marke, `${k.anteckning} saknar bilaga och ska ha märket`).toEqual({
          antal: 1,
          synligt: true,
          oense: false,
          sistPaForstaRaden: true,
          farg: rad.marke?.farg,
        });
      }
      // Meningen star inte langre som egen rad.
      expect(rad.rader.map((r) => r.text)).not.toContain(etikett);
    }
    // Blandningen ar verklig: bada sorterna finns.
    expect(KVITTON.filter((k) => k.bilaga).length).toBeGreaterThan(0);
    expect(KVITTON.filter((k) => !k.bilaga).length).toBeGreaterThan(0);
  }, 60_000);

  it("första raden under rubriken är kursiv, och ingen annan", async () => {
    await oppna("kostnad");
    const rader = await matRader(KVITTON.map((k) => k.anteckning), marketsEtikett());
    for (const [i, rad] of rader.entries()) {
      const k = KVITTON[i];
      expect(rad.rubrikStil, `${k.anteckning}: rubriken`).toBe("normal");
      // Forsta raden ar leverantor och datum – samma text som listan bygger.
      expect(rad.rader[0]?.text, `${k.anteckning}: första raden`).toBe(`${k.leverantor} · ${k.dag}`);
      expect(rad.rader.map((r) => r.stil), `${k.anteckning}: raderna under rubriken`).toEqual(
        rad.rader.map((_, j) => (j === 0 ? "italic" : "normal")),
      );
    }
    // Raderna har olika antal textrader – annars provades rytmen inte.
    const antal = new Set(rader.map((r) => r.rader.length));
    expect(antal.size, "kvittoraderna ska ha olika många textrader").toBeGreaterThan(1);
  }, 60_000);

  it("åtgärdspricken och märket går att skilja på färg och placering", async () => {
    const etikett = marketsEtikett();
    await oppna("kostnad");
    const [utkast] = await matRader([UTKAST], etikett);
    const utanBilaga = (await matRader(KVITTON.filter((k) => !k.bilaga).map((k) => k.anteckning), etikett))[0];
    expect(utkast.prick, "utkastet ska ha åtgärdspricken").not.toBeNull();
    expect(utkast.prick!.forstPaForstaRaden).toBe(true);
    expect(utanBilaga.marke!.sistPaForstaRaden).toBe(true);
    expect(utanBilaga.prick, "ett sparat kvitto utan bilaga har ingen åtgärdsprick").toBeNull();
    expect(utanBilaga.marke!.farg).not.toBe(utkast.prick!.farg);
  }, 60_000);
});

describe("startskärmens sex senaste rörs inte", () => {
  it("ingen kursiv och inget märke, som före den här omgången", async () => {
    const etikett = marketsEtikett();
    await oppna("oversikt");
    // Vilka sex som visas avgors av sidan, inte av testet: den falska
    // databasen ger alla samma skapad_at. Testet tar de kvitton som star dar.
    const synliga = await utvardera<string[]>(`[...document.body.querySelectorAll('p')].map(p => p.textContent)`);
    const pa = KVITTON.map((k) => k.anteckning).filter((a) => synliga.includes(a));
    expect(pa.length, "startskärmen ska visa några av kvittona").toBeGreaterThan(0);
    const rader = await matRader(pa, etikett);
    for (const rad of rader) {
      expect(rad.marke).toBeNull();
      expect(rad.rader.every((r) => r.stil === "normal"), `${rad.anteckning}: raka rader`).toBe(true);
    }
    // Provet galler bara om nagot av dem saknar bilaga – annars kunde
    // markets franvaro bero pa att bilagan fanns.
    const utan = rader.filter((r) => !KVITTON.find((k) => k.anteckning === r.anteckning)!.bilaga);
    expect(utan.length, "minst ett av dem ska sakna bilaga").toBeGreaterThan(0);
  }, 60_000);
});
