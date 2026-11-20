import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CHROME,
  kastaOmSidanKastade,
  startaWebblasare,
  TYPSNITT_ADRESS,
  TYPSNITT_LANK,
  TYPSNITTSKATALOG,
  VANTA_PA_TYPSNITT,
  VANTA_PA_TYPSNITT_MS,
  type Webblasare,
} from "./_webblasare";
import { KALLA } from "../scripts/typsnittskalla.mjs";
import { config as middlewareKonfig } from "@/middleware";

// Webblasarproven hamtar inga typsnitt over natet (CLAUDE.md, "En svit som
// hämtar något över nätet mäter inte bara koden"). Till 2026-11-20 lankade
// fyra provfiler till Googles typsnitt, och nar typsnittet tystnade – som nar
// datorn somnar och natet forsvinner – foll provet med "Väntade mer än 15 s
// på Chromes svar på Runtime.evaluate", ett besked som inte sager vad som
// hande. Nu serveras tester/typsnitt/ av riggen, och vantan i sidan har en
// egen grans med ett eget besked.
//
// Det sista provet ar samma uppstallning som fellet framkallades med: en
// server som tar emot anslutningen och aldrig svarar.

const ROT = process.cwd();
const GOOGLE = ["fonts", "googleapis", "com"].join(".");
const GSTATIC = ["fonts", "gstatic", "com"].join(".");

/** Varje fil under `katalog`, rekursivt – uppräknat ur koden, inte en lista. */
function filerUnder(katalog: string): string[] {
  return readdirSync(join(ROT, katalog), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? filerUnder(join(katalog, d.name)) : [join(katalog, d.name)],
  );
}

describe("appens typsnitt serveras av appen själv", () => {
  it("kopian är hämtad ur den källa skriptet anger", () => {
    const kalla = readFileSync(join(TYPSNITTSKATALOG, "typsnitt.css"), "utf-8").match(/^\/\* Kalla: (\S+) \*\//)?.[1];
    expect(kalla, "typsnitten byttes i scripts/typsnittskalla.mjs – kör node scripts/hamta-typsnitt.mjs").toBe(KALLA);
  });

  it("pekar bara på filer som finns bredvid den, inget över nätet", () => {
    const css = readFileSync(join(TYPSNITTSKATALOG, "typsnitt.css"), "utf-8");
    const adresser = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(adresser.length, "förutsättningen: stilarket har typsnittsfiler").toBeGreaterThan(0);
    for (const a of adresser) {
      expect(a, "en adress utanför katalogen").not.toMatch(/^[a-z]+:|^\//);
      expect(existsSync(join(TYPSNITTSKATALOG, a)), `${a} saknas i public/typsnitt/`).toBe(true);
    }
  });

  it("layouten länkar till appens egen kopia", () => {
    const layout = readFileSync(join(ROT, "src/app/layout.tsx"), "utf-8");
    expect(layout).toContain(`href="${TYPSNITT_ADRESS}"`);
  });

  it("ingen fil i appen eller sviten länkar till Googles typsnitt", () => {
    // src/ är appen, tester/ är sviten. Skriptet som hämtar kopian får nämna källan.
    const lankarUt = [...filerUnder("src"), ...filerUnder("tester")]
      .filter((f) => /\.(tsx?|mjs|css|md|html)$/.test(f))
      .filter((f) => {
        const text = readFileSync(join(ROT, f), "utf-8");
        return text.includes(GOOGLE) || text.includes(GSTATIC);
      });
    expect(lankarUt).toEqual([]);
  });

  it("middlewaren släpper typsnitten utan session – och kör fortfarande på sidorna", () => {
    const monster = new RegExp(`^${middlewareKonfig.matcher[0]}$`);
    // Förutsättningen: mönstret träffar en vanlig sida, så att det inte bara släpper allt.
    expect(monster.test("/kostnad")).toBe(true);
    for (const fil of readdirSync(TYPSNITTSKATALOG)) {
      expect(monster.test(`/typsnitt/${fil}`), `/typsnitt/${fil} skulle omdirigeras till /login`).toBe(false);
    }
  });
});

let webblasare: Webblasare;
let svarthal: Server;
let svarthalPort: number;
const halla: Socket[] = [];

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  // Tar emot anslutningen och svarar aldrig – som en server bakom ett nät
  // som försvunnit.
  svarthal = createServer((s) => void halla.push(s));
  await new Promise<void>((r) => svarthal.listen(0, "127.0.0.1", () => r()));
  svarthalPort = (svarthal.address() as { port: number }).port;
  const sida = (huvud: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8">${huvud}
<style>body { font-family: 'Instrument Sans'; } h1 { font-family: 'Fraunces'; }</style></head>
<body><h1>Kvittobo</h1><p>Instrument Sans och Fraunces</p></body></html>`;
  webblasare = await startaWebblasare(
    {
      lokala: sida(TYPSNITT_LANK),
      tysta: sida(`<link rel="stylesheet" href="http://127.0.0.1:${svarthalPort}/typsnitt.css">`),
    },
    "kvittobo-typsnitt-",
  );
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
  for (const s of halla) s.destroy();
  await new Promise<void>((r) => svarthal?.close(() => r()));
});

/** Öppnar sidan och väntar på typsnitten; sidans undantag kastas med sin text. */
async function vantaPaTypsnitten(sida: string): Promise<{ laddade: string[]; adresser: string[] }> {
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}${sida}` });
  const svar = await webblasare.cdp<{ result: { value: { laddade: string[]; adresser: string[] } } }>("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      ${VANTA_PA_TYPSNITT}
      return {
        laddade: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')))].sort(),
        adresser: performance.getEntriesByType('resource').map((r) => r.name),
      };
    })()`,
  });
  kastaOmSidanKastade(svar);
  return svar.result.value;
}

describe("typsnitten i Chrome", () => {
  it("laddas ur riggens lokala kopia, och sidan hämtar inget utanför den egna servern", async () => {
    const { laddade, adresser } = await vantaPaTypsnitten("lokala");
    expect(laddade).toEqual(["Fraunces", "Instrument Sans"]);
    expect(adresser.length, "förutsättningen: sidan hämtade sina typsnitt").toBeGreaterThan(0);
    expect(adresser.filter((a) => !a.startsWith(webblasare.adress))).toEqual([]);
  }, 30_000);

  it("ett stilark som aldrig svarar ger beskedet typsnitten laddades inte – före CDP-anropets 15 s", async () => {
    const start = Date.now();
    const fel = await vantaPaTypsnitten("tysta").then(
      () => null,
      (e: Error) => e.message,
    );
    const tid = Date.now() - start;
    // Förutsättningen: servern fick anslutningen, så det är tystnaden som prövas.
    expect(halla.length, "förutsättningen: sidan anslöt till servern som inte svarar").toBeGreaterThan(0);
    expect(fel, "inget besked alls – sidan väntade klart").not.toBeNull();
    // Hela första raden; resten är sidans stackspår.
    expect(fel!.split("\n")[0]).toBe(
      `fel i sidan: Error: typsnitten laddades inte inom ${VANTA_PA_TYPSNITT_MS / 1000} s: ` +
        `stilarket svarade inte (http://127.0.0.1:${svarthalPort}/typsnitt.css)`,
    );
    expect(tid, "beskedet ska komma före CDP-anropets egen gräns").toBeLessThan(15_000);
  }, 30_000);
});
