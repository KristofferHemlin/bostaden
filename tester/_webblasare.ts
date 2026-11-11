// Riggen for tester som mater i en riktig Chrome: en lokal server med sidorna,
// en headless Chrome och en CDP-anslutning till den.
//
// VARJE STEG SOM VANTAR PA NAGOT UTANFOR PROCESSEN HAR EN EGEN TIDSGRANS
// (CLAUDE.md, "Ett test som hänger är värre än ett som faller"). Gransen far
// steget att falla med vad det vantade pa, i stallet for att korningen star
// still utan utfall. Gransen loser ingenting i sig – den gor nasta
// hangning till ett namngivet fel. Orsaken till den hangning som fick
// granserna att skrivas star langre ned.
//
// Granserna, och varfor de ar satta dar de ar:
//   * CDP-anrop 15 s. Ett anrop tar under en sekund i de har sidorna; 15 s
//     ar marginal for en belastad maskin men ligger under vitests 60 s per
//     test, sa att anropet faller med sitt eget namn forst.
//   * Chromes start 15 s, /json och websocketen 10 s var.
//   * Chromes avslut 5 s efter SIGTERM, serverns stangning 5 s. Uppfylls de
//     inte faller stadningen med det namnet; Chrome far da SIGKILL sa att
//     ingen process blir kvar.
//   * Chromes hjalpprocesser 10 s, profilkatalogens borttagning 5 s.
//
// DET SOM SAG UT SOM EN HANGNING VAR STADNINGEN. Uppmatt 2026-11-11: i varje
// korning som "hangde" hade testerna gatt igenom, och sedan foll
// borttagningen av profilkatalogen pa ENOTEMPTY – nagot skrev i den efter att
// Chromes huvudprocess avslutats. rmSync hade da 40 forsok med linjart
// vaxande fordrojning pa 250 ms, alltsa upp till omkring 205 s av synkron
// vantan dar ingen timer kan losa ut. Vitest skriver resultaten forst nar
// filen ar klar, sa loggen var tom under tiden. Stadningen vantar nu tills
// ingen process har profilen pa sin kommandorad, och tar bort katalogen
// asynkront, bada med en grans.

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

export const CHROME =
  process.env.CHROME_SOKVAG ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Later `lofte` vanta hogst `ms`, och faller annars med vad det vantade pa. */
export function medGrans<T>(lofte: Promise<T>, ms: number, vad: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>;
  return Promise.race([
    lofte,
    new Promise<never>((_, avvisa) => {
      tid = setTimeout(() => avvisa(new Error(`Väntade mer än ${ms / 1000} s på ${vad}`)), ms);
    }),
  ]).finally(() => clearTimeout(tid));
}

/** Vantar tills ingen process har `profil` pa sin kommandorad – Chromes
 *  hjalpprocesser lever en stund efter huvudprocessen och skriver i den. */
async function vantaTillsProfilenArFri(profil: string): Promise<void> {
  for (;;) {
    const lista = await new Promise<string>((losa, avvisa) =>
      execFile("ps", ["-axo", "command"], { maxBuffer: 16 * 1024 * 1024 }, (fel, ut) => (fel ? avvisa(fel) : losa(ut))),
    );
    if (!lista.includes(profil)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

export interface Webblasare {
  /** Sidornas adress, med avslutande snedstreck: `${adress}namn`. */
  adress: string;
  cdp<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Kor ett uttryck i sidan och lamnar tillbaka vardet. Kastar om sidan kastar. */
  utvardera<T>(uttryck: string): Promise<T>;
  stang(): Promise<void>;
}

const FILTYPER: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

/**
 * Startar servern och en headless Chrome. `sidor` ar namn -> html, dar namnet
 * ar sokvagen utan inledande snedstreck – `""` ar `/`, och en fraga efter
 * `?` raknas inte. Ar `filkatalog` satt serveras ovriga sokvagar ur den, sa
 * att en sida kan ladda bilder som i appen.
 */
export async function startaWebblasare(
  sidor: Record<string, string>,
  profilprefix: string,
  { filkatalog }: { filkatalog?: string } = {},
): Promise<Webblasare> {
  const server: Server = createServer((req, res) => {
    const namn = new URL(req.url ?? "/", "http://x").pathname.slice(1);
    const html = sidor[namn];
    if (html !== undefined) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
      return;
    }
    if (filkatalog) {
      const fil = join(filkatalog, namn);
      if (fil.startsWith(filkatalog) && existsSync(fil) && statSync(fil).isFile()) {
        res.writeHead(200, { "content-type": FILTYPER[extname(fil)] ?? "application/octet-stream" }).end(readFileSync(fil));
        return;
      }
    }
    res.writeHead(404).end();
  });
  await medGrans(new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r())), 5_000, "att servern ska börja lyssna");
  const adress = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const profil = mkdtempSync(join(tmpdir(), profilprefix));
  const chrome: ChildProcess = spawn(
    CHROME,
    // Origin-huvudet fran Nodes WebSocket avvisas annars av Chrome.
    ["--headless=new", "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${profil}`, "--no-first-run", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsAdress = await medGrans(
    new Promise<string>((losa) => {
      let logg = "";
      chrome.stderr!.on("data", (d: Buffer) => {
        logg += d.toString();
        const t = logg.match(/DevTools listening on (ws:\/\/\S+)/);
        if (t) losa(t[1]);
      });
    }),
    15_000,
    "att Chrome ska starta och öppna sin DevTools-port",
  );
  const port = new URL(wsAdress).port;
  const flikar = (await medGrans(
    // Ingen AbortSignal: i jsdom-miljon ar den jsdoms egen, och Nodes fetch
    // godtar den inte. medGrans gransar vantan anda.
    fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()),
    10_000,
    "Chromes lista över flikar (/json)",
  )) as { type: string; webSocketDebuggerUrl: string }[];
  const ws = new WebSocket(flikar.find((s) => s.type === "page")!.webSocketDebuggerUrl);
  await medGrans(new Promise((r) => (ws.onopen = r)), 10_000, "att websocketen mot Chrome ska öppnas");

  let nasta = 0;
  const vantande = new Map<number, (m: { result?: unknown; error?: unknown }) => void>();
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && vantande.has(m.id)) {
      vantande.get(m.id)!(m);
      vantande.delete(m.id);
    }
  };

  function cdp<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++nasta;
    const svar = new Promise<T>((losa, avvisa) => {
      vantande.set(id, (m) => (m.error ? avvisa(new Error(JSON.stringify(m.error))) : losa(m.result as T)));
      ws.send(JSON.stringify({ id, method, params }));
    });
    return medGrans(svar, 15_000, `Chromes svar på ${method}`).finally(() => vantande.delete(id));
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

  async function stang() {
    ws.close();
    const fel: string[] = [];
    if (chrome.exitCode === null && chrome.signalCode === null) {
      const avslutad = new Promise((r) => chrome.once("exit", r));
      chrome.kill();
      try {
        await medGrans(avslutad, 5_000, "att Chrome ska avslutas efter SIGTERM");
      } catch (e) {
        fel.push((e as Error).message);
        chrome.kill("SIGKILL");
        await medGrans(avslutad, 5_000, "att Chrome ska avslutas efter SIGKILL").catch((e2) => fel.push((e2 as Error).message));
      }
    }
    await medGrans(new Promise<void>((r) => server.close(() => r())), 5_000, "att servern ska stängas").catch((e) =>
      fel.push((e as Error).message),
    );
    // Chromes hjalpprocesser skriver i profilen en stund efter att
    // huvudprocessen avslutats (ENOTEMPTY, 2026-11-11). Vanta pa dem, och ta
    // sedan bort katalogen asynkront – aldrig en synkron vantan som stoppar
    // varje timer, se overst.
    await medGrans(vantaTillsProfilenArFri(profil), 10_000, "att Chromes hjälpprocesser ska lämna profilkatalogen").catch(
      (e) => fel.push((e as Error).message),
    );
    await medGrans(rm(profil, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }), 5_000, "att profilkatalogen ska gå att ta bort").catch(
      (e) => fel.push((e as Error).message),
    );
    if (fel.length > 0) throw new Error(fel.join("; "));
  }

  return { adress, cdp, utvardera, stang };
}
