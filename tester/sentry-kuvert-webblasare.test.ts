import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";
import { existsSync } from "node:fs";

// Vad Sentry får från webbläsaren (integritetspolicyn, avsnitt 4: "tekniska
// felrapporter" som inte innehåller belopp, leverantörer eller adresser).
//
// Samma uppställning som visade läckan 2026-11-20: appens egen
// src/instrumentation-client.ts paketeras med det riktiga @sentry/nextjs,
// DSN:en pekar på en lokal server som spelar in varje kuvert, och releasen
// sätts som byggpluginet gör i produktionen – utan release skickar Sentry inga
// sessioner, och då kunde provet inte se dem. Mätt då: två sessionskuvert per
// sidladdning för en inloggad, det andra med användarens id; ett per
// navigering; och en felhändelse med sidans adress och navigeringarnas
// sökparametrar, konsolens argument ordagrant och Prismas argumentträd.

const ROT = process.cwd();
const PRISMA = JSON.parse(readFileSync(join(ROT, "tester/fixturer/prisma-valideringsfel.json"), "utf-8")).meddelanden as Record<string, string>;
const KANSLIGT = /Hemliga Byggfirman|Storgatan 1|anna\.andersson@exempel\.se|Bauhaus|12 000 kr|hemlig-token|abc-123|export-x/;

interface Kuvert {
  typer: string[];
  delar: Record<string, unknown>[];
}

const kuvert: Kuvert[] = [];
let sentry: Server;
let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  sentry = createServer((req, res) => {
    let kropp = "";
    req.on("data", (d) => (kropp += d));
    req.on("end", () => {
      if (req.method === "POST") {
        const rader = kropp.split("\n").filter(Boolean).slice(1).map((r) => JSON.parse(r) as Record<string, unknown>);
        kuvert.push({
          typer: rader.filter((r) => typeof r.type === "string").map((r) => r.type as string),
          delar: rader.filter((r) => typeof r.type !== "string"),
        });
      }
      res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "application/json" }).end("{}");
    });
  });
  await new Promise<void>((r) => sentry.listen(0, "127.0.0.1", () => r()));
  const port = (sentry.address() as { port: number }).port;
  const utfall = await build({
    stdin: {
      contents: `import "./src/instrumentation-client"; import * as Sentry from "@sentry/nextjs"; window.__sentry = Sentry;`,
      resolveDir: ROT,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    define: {
      "process.env.NEXT_PUBLIC_SENTRY_DSN": JSON.stringify(`http://nyckel@127.0.0.1:${port}/1`),
      "process.env.NEXT_PUBLIC_VERCEL_ENV": '"production"',
      "process.env.NODE_ENV": '"production"',
      // Som byggpluginet i produktionen – utan release skickas inga sessioner.
      "process.env._sentryRelease": '"prov-1"',
    },
    alias: { "@": join(ROT, "src") },
    logLevel: "error",
    plugins: [
      {
        // Next drar in Node-moduler som aldrig körs i webbläsaren.
        name: "tomma-nodemoduler",
        setup(b) {
          b.onResolve({ filter: /^(fs|stream|zlib|path|os|crypto)$/ }, (a) => ({ path: a.path, namespace: "tom" }));
          b.onLoad({ filter: /.*/, namespace: "tom" }, () => ({ contents: "module.exports = {};" }));
        },
      },
    ],
  });
  const skript = utfall.outputFiles[0].text;
  const sida = (kropp: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8"></head><body>${kropp}
<script>window.process = { env: {} };</script><script>${skript.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
  webblasare = await startaWebblasare(
    {
      forsta: sida(`<button title="Bauhaus 12 000 kr" aria-label="Bauhaus 12 000 kr" class="knapp">Spara</button>`),
      andra: sida("<p>Andra sidan</p>"),
    },
    "kvittobo-sentrykuvert-",
  );
}, 120_000);

afterAll(async () => {
  await webblasare?.stang();
  await new Promise<void>((r) => sentry?.close(() => r()));
});

beforeEach(() => {
  kuvert.length = 0;
});

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Väntar tills inga nya kuvert kommit på en stund – Sentry skickar när sidan är ledig. */
async function tystnad(): Promise<void> {
  let antal = -1;
  while (antal !== kuvert.length) {
    antal = kuvert.length;
    await vanta(1500);
  }
}

describe("Sentry får inget när inget hänt", () => {
  it("sidladdning, inloggning, dold sida, navigering och en ny sida: noll kuvert", async () => {
    await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}forsta?utkast=abc-123` });
    await vanta(1000);
    // Som SentryAnvandare gör på varje sida för en inloggad.
    await webblasare.utvardera(`window.__sentry.setUser({ id: "a0000000-0000-4000-8000-0000000000aa" }); true`);
    await webblasare.utvardera(`document.dispatchEvent(new Event("visibilitychange")); true`);
    await webblasare.utvardera(`history.pushState({}, "", "/forsta/kostnad/k-1?fran=export-x"); true`);
    await vanta(500);
    await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}andra` });
    await tystnad();
    expect(kuvert.map((k) => k.typer.join(","))).toEqual([]);
  }, 60_000);
});

describe("en felhändelse bär ingenting hon matat in", () => {
  it("adress, brödsmulor och meddelande är sanerade – och felet går fortfarande att läsa", async () => {
    await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}forsta?utkast=abc-123` });
    await vanta(1000);
    await webblasare.utvardera(`window.__sentry.setUser({ id: "a0000000-0000-4000-8000-0000000000aa" }); true`);
    await webblasare.utvardera(`console.error("ett konsolmeddelande med Bauhaus 12 000 kr"); true`);
    // Ett riktigt tryck på knappen, så att Sentry noterar klicket med elementet.
    const punkt = await webblasare.utvardera<{ x: number; y: number }>(
      `(() => { const r = document.querySelector("button").getBoundingClientRect(); return { x: r.x + 5, y: r.y + 5 }; })()`,
    );
    for (const type of ["mousePressed", "mouseReleased"]) {
      await webblasare.cdp("Input.dispatchMouseEvent", { type, x: punkt.x, y: punkt.y, button: "left", clickCount: 1 });
    }
    await webblasare.utvardera(`history.pushState({}, "", "/forsta/kostnad/k-1?fran=export-x"); true`);
    const meddelande = `${PRISMA.kostnadMedFelTyp}\nanvändaren anna.andersson@exempel.se, länken https://lager.exempel.se/fil.jpg?token=hemlig-token`;
    await webblasare.utvardera(`setTimeout(() => { throw new Error(${JSON.stringify(meddelande)}); }, 0); true`);
    await tystnad();

    expect(kuvert.map((k) => k.typer.join(",")), "förutsättningen: felet skickades, och bara det").toEqual(["event"]);
    const h = kuvert[0].delar[0] as {
      request?: { url?: string; headers?: Record<string, string> };
      breadcrumbs?: { category?: string; message?: string; data?: Record<string, unknown> }[];
      exception?: { values?: { value?: string }[] };
      user?: Record<string, unknown>;
    };
    const kategorier = (h.breadcrumbs ?? []).map((b) => b.category);
    // Förutsättningarna: brödsmulorna finns, så att det de inte bär betyder något.
    expect(kategorier, "navigeringen och klicket ska finnas").toEqual(expect.arrayContaining(["navigation", "ui.click"]));

    expect(h.request?.url).toBe(`${webblasare.adress}forsta/kostnad/k-1`);
    expect(kategorier).not.toContain("console");
    const navigering = h.breadcrumbs!.find((b) => b.category === "navigation")!;
    expect(navigering.data).toEqual({ from: "/forsta", to: "/forsta/kostnad/k-1" });
    const klick = h.breadcrumbs!.find((b) => b.category === "ui.click")!;
    expect(klick.message).toBe("body > button.knapp");
    const varde = h.exception!.values![0].value!;
    // Felsökbart: vilket anrop, vilket fält och vilken typ.
    expect(varde).toContain("Invalid `prisma.kostnad.findMany()` invocation:");
    expect(varde).toContain(
      "Argument `totalbelopp`: Invalid value provided. Expected IntNullableFilter, Int or Null, provided String.",
    );
    expect(varde).toContain("användaren [e-post], länken https://lager.exempel.se/fil.jpg");
    expect(h.user).toEqual({ id: "a0000000-0000-4000-8000-0000000000aa" });
    // Och inget av det hon matat in, någonstans i händelsen.
    expect(JSON.stringify(h).match(KANSLIGT)).toBeNull();
  }, 60_000);
});
