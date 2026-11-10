// @vitest-environment jsdom
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

// docs/design.md, "Anteckningen får två rader där den är radens huvudtext":
// kvittolistan i fas 2, Senaste kvitton pa oversikten, kvittolistan pa
// /kostnad och fas 1:s fyra listor. Fore 2026-11-04 var raden `truncate` – en
// rad oavsett bredd, och pa en telefon syntes en tredjedel av anteckningen.
//
// Det gar inte i jsdom, som inte raknar ut layout: ett test dar skulle bara
// kunna lasa klassnamnen, alltsa prova att koden ar lika med sig sjalv. Har
// renderas de tre riktiga sidorna mot en falsk databas, appens CSS byggs med
// Tailwind, och raderna mats i Chrome med appens typsnitt vid telefonbredd.
// Saknas Chrome eller laddas inte typsnitten FALLER testet, som i
// tester/adressforslag-layout.test.ts.
//
// Tva anteckningar per sida. Den korta ar for lang for en rad men ryms pa
// tva, den langa ryms inte pa tva. Att de faktiskt ar det mats ocksa – med
// klippningen avslagen pa en kopia – annars kunde testet passera for att
// texten rakade rymmas pa en rad.
//
// Fas 1:s "Hör inte till bostaden" ar hopfalld tills man trycker, sa den
// syns inte i en statisk rendering. Fas 1 renderas darfor i en DOM (darav
// jsdom-miljon), knappen trycks som hon trycker den, och det som da star
// skickas till Chrome. jsdom raknar fortfarande ingenting – den bar bara
// tillstandet fram till webblasaren som mater.

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
  usePathname: () => "/",
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
vi.mock("@/app/genomgang/fragor/actions", () => ({ klassificeraHog: vi.fn(async () => ({})) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { renderToStaticMarkup } = await import("react-dom/server");
const { default: Oversikt } = await import("@/app/page");
const { default: KvittolistaSida } = await import("@/app/kostnad/page");
const { default: FragorSida } = await import("@/app/genomgang/fragor/page");
const { default: GenomgangSida } = await import("@/app/genomgang/page");

const CHROME =
  process.env.CHROME_SOKVAG ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROT = process.cwd();
const TYPSNITT = readFileSync(join(ROT, "src/app/layout.tsx"), "utf-8").match(
  /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/,
)![1];

// Riktiga anteckningar ur testkontot (2026-11-04).
const KORT = "Nytt ekgolv i vardagsrum och hall, det gamla var uppsvallat";
const LANG =
  "Bytte tre fönster mot gatan till treglas, de gamla var tvåglas från 70-talet och drog kallt hela vintern";
// Fas 1: kvitton som inte lagts ihop an (forslagen och kryssrutorna – samma
// kvitton star i bada) och kvitton som inte hor till bostaden. Egna texter, sa
// att varje matning hittar sin rad pa texten. Hogarna och "Hör inte till
// bostaden" har en smalare kolumn – knappar bredvid beloppet – sa dar behovs
// en kortare text for att den ska rymmas pa tva rader och inte pa en.
const HOG_KORT = "Nytt ekgolv i hallen, det gamla var uppsvallat";
const OK_KORT = "Nytt ekgolv i sovrummet och hall, det gamla var uppsvallat";
const OK_LANG =
  "Bytte tre fönster mot gården till treglas, de gamla var tvåglas från 70-talet och drog kallt hela vintern";
const AV_KORT = "Ny kaffebryggare, den gamla läckte vatten";
const AV_LANG =
  "Bytte två fönster mot gatan till treglas, de gamla var tvåglas från 70-talet och drog kallt hela vintern";

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const HOG = "c0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

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
  // En hog fran fas 1, sa att fas 2 visar kvittona.
  db.lagg("projekt", { id: HOG, bostad_id: X, namn: "", ar: 2025, atgardstyp: null });
  for (const [anteckning, dag] of [
    [KORT, "2025-03-14"],
    [LANG, "2025-04-02"],
    [HOG_KORT, "2025-04-10"],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: "Byggmax",
      anteckning,
      totalbelopp: 2_400_000,
      dokumentdatum: datum(dag),
      betaldatum: datum(dag),
      skapad_av: ANNA,
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 2_400_000 });
    db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: HOG, andel: 1 });
  }
  // Ej ihoplagda: samma leverantor tio dagar isar, sa att de foreslas ihop.
  // Utan fordelning ar de okopplade.
  for (const [anteckning, dag, arkiverad] of [
    [OK_KORT, "2025-05-02", false],
    [OK_LANG, "2025-05-12", false],
    [AV_KORT, "2025-06-02", true],
    [AV_LANG, "2025-06-20", true],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: X,
      leverantor: arkiverad ? "ICA Maxi" : "Beijer Bygg",
      anteckning,
      totalbelopp: 1_250_000,
      dokumentdatum: datum(dag),
      betaldatum: datum(dag),
      arkiverad,
      skapad_av: ANNA,
    });
    db.lagg("bilaga", { kostnad_id: k.id, sokvag: `x/${k.id}.jpg`, filtyp: "image/jpeg" });
    db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Material", belopp: 1_250_000 });
  }
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

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att mäta layouten – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);

  seeda();
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const sidor = {
    oversikt: await Oversikt({ searchParams: Promise.resolve({}) } as Parameters<typeof Oversikt>[0]),
    kostnad: await KvittolistaSida(),
    fragor: await FragorSida(),
  };
  const kroppar: Record<string, string> = Object.fromEntries(
    Object.entries(sidor).map(([namn, vy]) => [namn, renderToStaticMarkup(vy)]),
  );
  kroppar.genomgang = await genomgangMedRaknasInteOppen();
  for (const [namn, kropp] of Object.entries(kroppar)) {
    // Bada anteckningarna maste finnas pa sidan – annars mats ingenting.
    const vantade = namn === "genomgang" ? [HOG_KORT, LANG, OK_KORT, OK_LANG, AV_KORT, AV_LANG] : [KORT, LANG];
    for (const t of vantade) expect(kropp, `${namn}: "${t}" renderades inte`).toContain(t);
    SIDOR[namn] = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${TYPSNITT}"><style>${css}</style></head>
<body class="font-granssnitt">${kropp}</body></html>`;
  }

  server = createServer((req, res) => {
    const namn = new URL(req.url ?? "/", "http://x").pathname.slice(1);
    const html = SIDOR[namn];
    if (!html) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  adress = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  profil = mkdtempSync(join(tmpdir(), "kvittobo-anteckning-"));
  chrome = spawn(
    CHROME,
    // jsdom:s WebSocket skickar en Origin, som Chrome annars avvisar.
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
  // Chromes hjalpprocesser skriver i profilen en kort stund efter att
  // huvudprocessen avslutats, och en enda rmSync kan da kasta ENOTEMPTY – en
  // rod korning dar varje matning gick igenom. Uppmatt 2026-11-10. Forsok
  // igen i stallet for att lata stadningen falla sviten.
  if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

/** Fas 1 renderad i en DOM, med "Hör inte till bostaden" uppfalld av ett tryck. */
async function genomgangMedRaknasInteOppen(): Promise<string> {
  const vy = await GenomgangSida();
  const behallare = document.createElement("div");
  document.body.appendChild(behallare);
  const rot = createRoot(behallare);
  await act(async () => rot.render(vy));
  const knapp = [...behallare.querySelectorAll("button")].find((b) =>
    b.textContent!.startsWith("Hör inte till bostaden"),
  );
  expect(knapp, "fas 1 visar inte Hör inte till bostaden").toBeTruthy();
  await act(async () => knapp!.click());
  const html = behallare.innerHTML;
  act(() => rot.unmount());
  behallare.remove();
  return html;
}

interface Rad {
  /** Rader som visas. */
  visade: number;
  /** Rader texten skulle ta utan klippning. */
  naturliga: number;
  /** Texten ryms helt i det som visas. */
  hel: boolean;
}

/**
 * Mater raden vars text ar exakt `text`: det yttersta elementet med den
 * texten, inte en klass – testet vet inte vilka klasser koden anvander.
 */
async function mat(sida: string, text: string, plats = 0, antal = 1): Promise<Rad> {
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await cdp("Page.navigate", { url: `${adress}${sida}` });
  await vanta(500);
  const svar = await cdp<{ result: { value: Rad & { typsnittLaddade: boolean; antal: number } } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
      await document.fonts.ready;
      const text = ${JSON.stringify(text)};
      const traffar = [...document.body.querySelectorAll('*')].filter(
        el => el.textContent === text && el.parentElement.textContent !== text);
      const el = traffar[${plats}];
      const radhojd = parseFloat(getComputedStyle(el).lineHeight);
      const visade = Math.round(el.getBoundingClientRect().height / radhojd);
      // Samma element utan klippning, i samma forfader och samma bredd – utanfor
      // flodet, sa att det inte delar en flexrad med beloppet och krymper.
      const kopia = el.cloneNode(true);
      Object.assign(kopia.style, { display: 'block', webkitLineClamp: 'unset', overflow: 'visible',
        whiteSpace: 'normal', textOverflow: 'clip', width: el.getBoundingClientRect().width + 'px',
        position: 'absolute', visibility: 'hidden', left: '0', top: '0' });
      el.parentElement.appendChild(kopia);
      const naturliga = Math.round(kopia.getBoundingClientRect().height / radhojd);
      kopia.remove();
      return {
        typsnittLaddade: ['Fraunces', 'Instrument Sans'].every(namn =>
          [...document.fonts].some(f => f.family.replace(/["']/g, '') === namn && f.status === 'loaded')),
        antal: traffar.length,
        visade,
        naturliga,
        hel: el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
      };
    })()`,
  });
  const m = svar.result.value;
  expect(m.typsnittLaddade, "Fraunces och Instrument Sans måste laddas – med reservtypsnitt mäts fel").toBe(true);
  expect(m.antal, `${sida}: "${text}" ska stå på ${antal} rad(er)`).toBe(antal);
  return m;
}

function provaParet(etikett: string, kort: Rad, lang: Rad) {
  console.log(
    `${etikett}: kort ${kort.visade} av ${kort.naturliga} rader${kort.hel ? ", hel" : ""}; ` +
      `lång ${lang.visade} av ${lang.naturliga} rader${lang.hel ? ", hel" : ""}`,
  );
  // Forutsattningarna: den korta ryms inte pa en rad men pa tva, den langa
  // inte ens pa tva. Annars provar testet inte det det sager.
  expect(kort.naturliga, "den korta anteckningen ska vara för lång för en rad").toBe(2);
  expect(lang.naturliga, "den långa anteckningen ska vara för lång för två rader").toBeGreaterThan(2);
  // Den korta syns hel, pa tva rader.
  expect(kort.visade).toBe(2);
  expect(kort.hel).toBe(true);
  // Den langa klipps – efter tva rader, inte efter en, och inte obegransat.
  expect(lang.visade).toBe(2);
  expect(lang.hel).toBe(false);
}

describe("anteckningen får två rader där den är radens huvudtext, vid 390 px", () => {
  it.each([
    ["oversikt", "Senaste kvitton"],
    ["kostnad", "kvittolistan"],
    ["fragor", "fas 2, Kvittona"],
  ])("%s (%s)", async (sida) => {
    provaParet(sida, await mat(sida, KORT), await mat(sida, LANG));
  }, 60_000);

  // Fas 1. De ej ihoplagda kvittona star tva ganger, i forslaget och vid
  // kryssrutorna, och forslagen kommer forst pa sidan – det ar dokumentets
  // ordning, inte en klass, som skiljer dem at.
  it.each([
    ["förslagen att lägga ihop", OK_KORT, OK_LANG, 0, 2],
    ["de ihoplagda högarna", HOG_KORT, LANG, 0, 1],
    ["kvittona med kryssrutor", OK_KORT, OK_LANG, 1, 2],
    ["Hör inte till bostaden", AV_KORT, AV_LANG, 0, 1],
  ] as const)("genomgang, fas 1 (%s)", async (stalle, kort, lang, plats, antal) => {
    provaParet(`fas 1, ${stalle}`, await mat("genomgang", kort, plats, antal), await mat("genomgang", lang, plats, antal));
  }, 60_000);
});
