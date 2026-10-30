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

// docs/design.md, Adressfaltet: "Ett flytande lager får täcka fälten i samma
// steg. Det får aldrig täcka kontrollen som avslutar eller lämnar steget."
// Uppmatt 2026-10-20 i produktionen: listan slutade vid 723 px och "Spara
// bostad" borjade vid 797 px – 74 px fritt. Adressen flyttade ut ur
// registreringen 2026-10-28 och tillbaka 2026-10-30, och marginalen ska
// matas om, inte raknas fram ur klasserna.
//
// Det gar inte i jsdom, som inte raknar ut layout. Testet renderar
// bostadssteget som det ar, lagger in den riktiga forslagslistan
// (Forslagslista) med fem forslag pa tva rader – den hogsta listan kan bli,
// eftersom raderna ar `truncate` – under adressfaltet, bygger appens CSS med
// Tailwind och mater i Chrome med appens typsnitt. Saknas Chrome eller laddas
// inte typsnitten FALLER testet, som i tester/landningssida-layout.test.ts.

vi.mock("@/lib/supabase/server", () => ({ skapaServerklient: async () => ({}) }));
vi.mock("@/lib/session", () => ({ hamtaAnvandare: async () => null, sakerstallAnvandarrad: async () => {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({
  redirect: () => {},
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { RegistreraFlode } = await import("@/app/registrera/flode");
const { Forslagslista } = await import("@/app/registrera/adress-falt");

const CHROME =
  process.env.CHROME_SOKVAG ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROT = process.cwd();
const TYPSNITT = readFileSync(join(ROT, "src/app/layout.tsx"), "utf-8").match(
  /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/,
)![1];

const FORSLAG = [
  ["Kvarnvägen 12 B", "Enköping, Sverige"],
  ["Kvarnvägen 12", "Söderhamn, Sverige"],
  ["Kvarnvägen 1", "Älta, Sverige"],
  ["Kvarngatan 12", "Uppsala, Sverige"],
  ["Kvarnbacken 12", "Västerås, Sverige"],
].map(([primar, sekundar], i) => ({ placeId: `p${i}`, primar, sekundar }));

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
  const steg = renderToStaticMarkup(createElement(RegistreraFlode, { endastBostad: true }));
  const lista = renderToStaticMarkup(
    createElement(Forslagslista, { forslag: FORSLAG, aktiv: -1, onValj: () => {}, onPeka: () => {} }),
  );
  // Listan pa sin plats: direkt efter adressfaltet, i samma relativa ruta.
  const falt = steg.match(/<input[^>]*id="adress-falt"[^>]*>/)![0];
  const medLista = steg.replace(falt, falt + lista);
  expect(medLista).not.toBe(steg);
  const html = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${TYPSNITT}"><style>${css}</style></head>
<body class="font-granssnitt">${medLista}</body></html>`;

  server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  adress = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  profil = mkdtempSync(join(tmpdir(), "kvittobo-adresslista-"));
  chrome = spawn(
    CHROME,
    ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profil}`, "--no-first-run", "about:blank"],
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
  if (profil) rmSync(profil, { recursive: true, force: true });
});

interface Matning {
  typsnittLaddade: boolean;
  listaUnderkant: number;
  listaHojd: number;
  listaSkrollar: boolean;
  knappOverkant: number;
  ortOverkant: number;
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
  const svar = await cdp<{ result: { value: Matning } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 100));
      await document.fonts.ready;
      const lista = document.getElementById('adress-forslag');
      const l = lista.getBoundingClientRect();
      const knapp = [...document.querySelectorAll('button[type="submit"]')].find(b => b.textContent.trim() === 'Spara bostad');
      const ort = document.querySelector('input[name="ort"]');
      return {
        typsnittLaddade: ['Fraunces', 'Instrument Sans'].every(namn =>
          [...document.fonts].some(f => f.family.replace(/["']/g, '') === namn && f.status === 'loaded')),
        listaUnderkant: l.bottom + window.scrollY,
        listaHojd: l.height,
        listaSkrollar: lista.scrollHeight > lista.clientHeight,
        knappOverkant: knapp.getBoundingClientRect().top + window.scrollY,
        ortOverkant: ort.getBoundingClientRect().top + window.scrollY,
      };
    })()`,
  });
  const m = svar.result.value;
  expect(m.typsnittLaddade, "Fraunces och Instrument Sans måste laddas – med reservtypsnitt mäts fel").toBe(true);
  return m;
}

describe("adressförslagen täcker aldrig Spara bostad i registreringen", () => {
  it.each([
    [390, 844],
    [1280, 800],
  ])("vid %i × %i", async (bredd, hojd) => {
    const m = await mat(bredd, hojd);
    console.log(
      `${bredd} × ${hojd}: listan ${m.listaHojd.toFixed(1)} px hög, slutar vid ${m.listaUnderkant.toFixed(1)} px; ` +
        `Spara bostad börjar vid ${m.knappOverkant.toFixed(1)} px – ${(m.knappOverkant - m.listaUnderkant).toFixed(1)} px fritt`,
    );
    // Fem forslag ryms inte – listan har natt sin hojdgrans och skrollar.
    expect(m.listaSkrollar).toBe(true);
    // Den far tacka Ort, och gor det – annars mater testet inte en oppen lista.
    expect(m.listaUnderkant).toBeGreaterThan(m.ortOverkant);
    // Men aldrig knappen.
    expect(m.listaUnderkant).toBeLessThan(m.knappOverkant);
  }, 60_000);
});
