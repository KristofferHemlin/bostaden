import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// Projektflödets fjärde steg, i en riktig webbläsare med riktiga klick.
//
// Uppmätt i produktionen 2026-11-16 på 59a1d35: räknaren sade 3 AV 4, knappen
// sade Nästa – och ett tryck sparade projektet. Steg fyra kom aldrig.
// tester/projekt-nytt-flode.test.ts gick igenom hela tiden, eftersom det klickar
// med element.click() i jsdom, och det klicket kan inte framkalla felet:
//
//   Nästa (type="button") och Spara (type="submit") stod på samma plats i
//   trädet, så React återanvände samma <button> och bytte bara dess type. Vid
//   ett klick från användaren kör webbläsaren Reacts uppdatering till steg 4
//   när händelselyssnaren är klar – före knappens standardhandling. När
//   standardhandlingen sedan körs är knappen redan en submit-knapp, och
//   formuläret skickas. Vid element.click() från ett skript ligger skriptet
//   kvar på stacken, uppdateringen väntar till efteråt, och standardhandlingen
//   hinner köras medan knappen fortfarande är type="button".
//
// Därför: flödet paketeras med esbuild och körs i Chrome, och varje tryck
// skickas som en inmatningshändelse via CDP – webbläsarens egen väg för ett
// klick, inte ett skripts. Server-actionen byts mot en som bara noterar att
// formuläret skickades.

const ROT = process.cwd();

const KVITTO = {
  id: "d0000000-0000-4000-8000-000000000001",
  rubrik: "Bytte avloppsstammen under köksbänken",
  anteckning: true,
  underrad: "Rörfirman · 2025-05-02",
  belopp: 2_850_000,
  bidrag: 2_000_000,
  avgar: ["varav ROT 8 500 kr, avgår", "20 000 kr räknas med"],
};

const INGANG = `
import { createRoot } from "react-dom/client";
import { NyttProjektFlode } from "@/app/projekt/nytt/flode";
const w = window as unknown as { __inskickat: Record<string, string[]>[] };
w.__inskickat = [];
createRoot(document.getElementById("rot")!).render(
  <NyttProjektFlode bostadId="b0000000-0000-4000-8000-000000000001" upplatelseform="bostadsratt" kvitton={${JSON.stringify([KVITTO])}} />,
);
`;

/** Flödets server-action, utbytt: den noterar formuläret och sparar ingenting. */
const ACTIONS_STUB = `
export async function skapaProjekt(_foreg, formData) {
  const falt = {};
  for (const [k, v] of formData.entries()) (falt[k] ??= []).push(String(v));
  window.__inskickat.push(falt);
  return {};
}
`;

/** En modul där varje namn är en funktion som inte gör något. CommonJS, så att
 *  esbuild inte prövar att de importerade namnen finns. */
const TOM_MODUL = `const ingenting = () => undefined; module.exports = new Proxy({}, { get: (_, k) => (k === "__esModule" ? false : ingenting) });`;

async function paketera(): Promise<string> {
  const utfall = await build({
    stdin: { contents: INGANG, loader: "tsx", resolveDir: ROT, sourcefile: "ingang.tsx" },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": join(ROT, "src") },
    logLevel: "error",
    plugins: [
      {
        name: "stubbar",
        setup(b) {
          b.onResolve({ filter: /^\.\.\/actions$/ }, (a) =>
            a.importer.includes(join("projekt", "nytt")) ? { path: "actions", namespace: "stub" } : undefined,
          );
          // Allt från next: länken och routern som stubbar, resten tomt – liksom
          // Sentry. Next:s riktiga router drar in Node-moduler och hör inte till
          // det som prövas.
          b.onResolve({ filter: /^(next(\/.*)?|@sentry\/nextjs)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
          // Serverkod som sidhuvudet drar in (bostadsväxlarens action): en
          // tom modul som tål vilka namn som helst. Flödets egen action ovan
          // är den enda som behöver göra något.
          b.onLoad({ filter: /[\\/]src[\\/].*\.(ts|tsx)$/ }, (a) => {
            const kod = readFileSync(a.path, "utf-8");
            return /^\s*"use server";/.test(kod) ? { contents: TOM_MODUL, loader: "js" } : undefined;
          });
          b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => {
            if (a.path === "actions") return { contents: ACTIONS_STUB, loader: "js" };
            if (a.path === "next/link")
              return {
                contents: `import { createElement } from "react"; export default function Link({ href, children, ...r }) { return createElement("a", { href, ...r }, children); }`,
                loader: "js",
                resolveDir: ROT,
              };
            if (a.path === "next/navigation")
              return {
                contents: `export function useRouter() { return { push() {}, replace() {}, refresh() {} }; } export function usePathname() { return "/projekt/nytt"; } export function useSearchParams() { return new URLSearchParams(); } export function redirect() {} export function notFound() {}`,
                loader: "js",
              };
            return { contents: TOM_MODUL, loader: "js" };
          });
        },
      },
    ],
  });
  return utfall.outputFiles[0].text;
}

let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att klicka som en användare – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const skript = await paketera();
  const sida = `<!doctype html><html lang="sv"><head><meta charset="utf-8"></head>
<body><div id="rot"></div><script>${skript.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
  webblasare = await startaWebblasare({ flode: sida }, "kvittobo-steg4-");
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ett klick som användarens: musknappen ner och upp mitt på elementet. */
async function tryck(text: string) {
  const punkt = await webblasare.utvardera<{ x: number; y: number } | null>(`(() => {
    const el = [...document.querySelectorAll("button, label")].find(
      (e) => e.closest("[hidden]") === null && e.textContent.trim() === ${JSON.stringify(text)});
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  expect(punkt, `ingen synlig knapp "${text}"`).not.toBeNull();
  for (const type of ["mousePressed", "mouseReleased"]) {
    await webblasare.cdp("Input.dispatchMouseEvent", { type, x: punkt!.x, y: punkt!.y, button: "left", clickCount: 1 });
  }
  await vanta(150);
}

interface Lage {
  framsteg: string;
  synligt: string;
  inskickat: number;
}

/** Var flödet står, och vad som syns – det steg hon ser, inte de dolda. */
async function lage(): Promise<Lage> {
  return webblasare.utvardera<Lage>(`(() => {
    const synliga = [...document.querySelectorAll("#rot *")].filter((e) => e.closest("[hidden]") === null);
    const framsteg = synliga.find((e) => /^\\d+ av \\d+$/.test(e.textContent.trim()));
    const delar = [];
    const gang = document.createTreeWalker(document.getElementById("rot"), NodeFilter.SHOW_TEXT);
    for (let n = gang.nextNode(); n; n = gang.nextNode()) {
      if (n.parentElement.closest("[hidden]") === null && n.textContent.trim()) delar.push(n.textContent.trim());
    }
    return { framsteg: framsteg ? framsteg.textContent.trim() : "", synligt: delar.join(" | "), inskickat: window.__inskickat.length };
  })()`);
}

describe("projektflödets fjärde steg, med riktiga klick i Chrome", () => {
  it("Nästa på frågeträdet leder till kvittona – och skickar ingenting", async () => {
    await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}flode` });
    await vanta(500);

    const steg: Lage[] = [];
    steg.push(await lage());
    // Namnet, som hon skriver det.
    await webblasare.utvardera(`document.querySelector('input[type="text"]').focus()`);
    await webblasare.cdp("Input.insertText", { text: "Nytt avlopp i köket" });
    await tryck("Nästa");
    steg.push(await lage());
    await tryck("Nästa");
    steg.push(await lage());
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    steg.push(await lage());

    for (const [i, s] of steg.entries()) console.log(`steg ${i + 1}: ${s.framsteg} · skickat ${s.inskickat}\n  ${s.synligt}`);

    // Förutsättningen: flödet gick verkligen genom stegen 1–3 med klicken.
    expect(steg.slice(0, 3).map((s) => s.framsteg)).toEqual(["1 av 4", "2 av 4", "3 av 4"]);
    // Och Nästa på steg 3 leder till steg 4, utan att något skickats.
    expect(steg[3].inskickat, "formuläret skickades från steg 3").toBe(0);
    expect(steg[3].framsteg).toBe("4 av 4");
    expect(steg[3].synligt).toContain(KVITTO.rubrik);
  }, 60_000);

  it("på steg fyra väljs kvittot, och Spara skickar en gång – med kvittot", async () => {
    // Raden är en etikett som växlar rutan; den hittas på anteckningen.
    const punkt = await webblasare.utvardera<{ x: number; y: number } | null>(`(() => {
      const l = [...document.querySelectorAll("label")].find(
        (e) => e.closest("[hidden]") === null && e.textContent.includes(${JSON.stringify(KVITTO.rubrik)}));
      if (!l) return null;
      const r = l.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    expect(punkt, "kvittoraden på steg fyra").not.toBeNull();
    for (const type of ["mousePressed", "mouseReleased"]) {
      await webblasare.cdp("Input.dispatchMouseEvent", { type, x: punkt!.x, y: punkt!.y, button: "left", clickCount: 1 });
    }
    await vanta(150);
    expect((await lage()).inskickat, "att välja ett kvitto skickar ingenting").toBe(0);

    await tryck("Spara");
    const skickat = await webblasare.utvardera<Record<string, string[]>[]>("window.__inskickat");
    expect(skickat).toHaveLength(1);
    expect(skickat[0].kostnad_ider).toEqual([KVITTO.id]);
    expect(skickat[0].namn).toEqual(["Nytt avlopp i köket"]);
  }, 60_000);
});
