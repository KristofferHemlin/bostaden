import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import tailwindKonfig from "../tailwind.config";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";
import { paketera } from "./_paketera";

// Flodets egen nyckel for utkastet, ur samma kalla som koden. Server-actionen
// den drar in hor inte till det som provas.
vi.mock("@/app/projekt/actions", () => ({ skapaProjekt: async () => ({}) }));
const { utkastNyckel } = await import("@/app/projekt/nytt/flode");

// docs/design.md, "Ett flöde har två sorters kontroller, inte tre": att röra
// sig i flödet är Nästa, med Tillbaka under, och att lämna det är
// tillbakalänken i huvudet. "Regeln gäller varje flöde" – försäljningens
// skickfråga har Spara och nästa med Hoppa över, som går vidare utan att
// svara och alltså hör till Nästa.
//
// Provet är positivt: varje steg har exakt de navigeringskontroller regeln
// tillåter, i ordning. Det faller när en försvinner och när en tillkommer –
// en Fortsätt senare eller en Avbryt bredvid Tillbaka fäller det utan att
// provet behöver veta vad den heter.
//
// Hur kontrollerna räknas: varje <a href> och <button> i flödet som syns
// enligt checkVisibility() med appens byggda Tailwind-CSS – i Tailwind 3
// vinner .flex över [hidden] (CLAUDE.md, "Ett dolt element är dolt först när
// appens riktiga CSS mäter det"), så attributet räcker inte. Utanför räkningen
// står det som hör till en fråga och inte flyttar henne: svarsalternativen
// (aria-pressed) och allt inne i en fieldset, som hjälprutans ✕. Och Börja om,
// som river utkastet i stället för att flytta henne (docs/design.md,
// "Och undantaget som inte är ett"). Huvudet ligger i sidan, inte i flödet,
// och prövas inte här.
//
// Stegen nås med riktiga klick via CDP, som i
// tester/projekt-nytt-steg4-webblasare.test.ts.

const ROT = process.cwd();
const BORJA_OM = "Börja om";
const BOSTAD_ID = "b0000000-0000-4000-8000-000000000001";

const KVITTO = {
  id: "d0000000-0000-4000-8000-000000000001",
  rubrik: "Bytte avloppsstammen under köksbänken",
  anteckning: true,
  underrad: "Rörfirman · 2025-05-02",
  belopp: 2_850_000,
  bidrag: 2_000_000,
  avgar: ["varav ROT 8 500 kr, avgår", "20 000 kr räknas med"],
};

const PROJEKT_INGANG = `
import { createRoot } from "react-dom/client";
import { NyttProjektFlode } from "@/app/projekt/nytt/flode";
(window as unknown as { __inskickat: unknown[] }).__inskickat = [];
createRoot(document.getElementById("rot")!).render(
  <NyttProjektFlode bostadId="${BOSTAD_ID}" upplatelseform="bostadsratt" kvitton={${JSON.stringify([KVITTO])}} />,
);
`;

const SKICK_INGANG = `
import { createRoot } from "react-dom/client";
import { SkickForsaljningFlode } from "@/app/forsaljning/skick/skick-forsaljning-flode";
(window as unknown as { __inskickat: unknown[] }).__inskickat = [];
createRoot(document.getElementById("rot")!).render(
  <SkickForsaljningFlode
    atgarder={[
      { id: "p1", namn: "Nya fönster", ar: 2023, skickForvarv: 1 },
      { id: "p2", namn: "Nytt golv i hallen", ar: 2024, skickForvarv: 2 },
    ]}
    nasta={{ href: "/export", text: "Till deklarationsunderlaget" }}
  />,
);
`;

let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att klicka som en användare – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const css = (
    await postcss([tailwindcss(tailwindKonfig)]).process(readFileSync(join(ROT, "src/app/globals.css"), "utf-8"), {
      from: join(ROT, "src/app/globals.css"),
    })
  ).css;
  const sida = (skript: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head>
<body class="font-granssnitt"><main class="mx-auto max-w-md"><div id="rot"></div></main><script>${skript.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
  webblasare = await startaWebblasare(
    { projekt: sida(await paketera(PROJEKT_INGANG)), skick: sida(await paketera(SKICK_INGANG)) },
    "kvittobo-navigering-",
  );
}, 60_000);

afterAll(async () => {
  await webblasare?.stang();
});

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function oppna(namn: string) {
  await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 393, height: 852, deviceScaleFactor: 3, mobile: true });
  await webblasare.cdp("Emulation.setTouchEmulationEnabled", { enabled: true });
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}${namn}` });
  await vanta(500);
}

/** Projektflödet utan något kvar i webbläsaren: ingen början på ett utkast
 *  från ett annat prov. Lagringen hör till sidans ursprung, så sidan öppnas
 *  först och töms sedan. */
async function oppnaProjektflodetTomt() {
  await oppna("projekt");
  await webblasare.utvardera("localStorage.clear()");
  await oppna("projekt");
}

async function harUtkast(): Promise<boolean> {
  return webblasare.utvardera<boolean>(`localStorage.getItem(${JSON.stringify(utkastNyckel(BOSTAD_ID))}) !== null`);
}

/** Ett tryck som användarens, på den synliga knappen med texten. */
async function tryck(text: string) {
  const punkt = await webblasare.utvardera<{ x: number; y: number } | null>(`(() => {
    const el = [...document.querySelectorAll("#rot button")].find(
      (e) => e.checkVisibility() && e.textContent.trim() === ${JSON.stringify(text)});
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
  /** Navigeringskontrollerna som syns, i dokumentordning. */
  navigering: string[];
  /** Synliga kontroller som räkningen lämnade utanför – förutsättningen att
   *  urvalet träffar något och inte bara råkar vara tomt. */
  utanfor: string[];
}

async function lage(): Promise<Lage> {
  return webblasare.utvardera<Lage>(`(() => {
    const rot = document.getElementById("rot");
    const synliga = [...rot.querySelectorAll("a[href], button")].filter((e) => e.checkVisibility());
    const namn = (e) => e.getAttribute("aria-label") ?? e.textContent.trim();
    const horTillFragan = (e) => e.hasAttribute("aria-pressed") || e.closest("fieldset") !== null;
    const framsteg = [...rot.querySelectorAll("*")].find(
      (e) => e.checkVisibility() && /^\\d+ av \\d+$/.test(e.textContent.trim()));
    return {
      framsteg: framsteg ? framsteg.textContent.trim() : "",
      navigering: synliga.filter((e) => !horTillFragan(e) && namn(e) !== ${JSON.stringify(BORJA_OM)}).map(namn),
      utanfor: synliga.filter((e) => horTillFragan(e) || namn(e) === ${JSON.stringify(BORJA_OM)}).map(namn),
    };
  })()`);
}

function logga(flode: string, steg: Lage[]) {
  for (const s of steg) console.log(`${flode} ${s.framsteg}: ${s.navigering.join(", ")} · utanför ${s.utanfor.length}`);
}

describe("flödenas navigeringskontroller, räknade i Chrome", () => {
  it("projektflödet: Nästa, och Tillbaka där det finns något att gå tillbaka till – inget mer", async () => {
    await oppnaProjektflodetTomt();
    expect(await harUtkast(), "ett utkast låg kvar fast lagringen tömts – flödet börjar inte från början").toBe(false);
    const steg: Lage[] = [await lage()];
    await webblasare.utvardera(`document.querySelector('input[type="text"]').focus()`);
    await webblasare.cdp("Input.insertText", { text: "Nytt avlopp i köket" });
    await tryck("Nästa");
    steg.push(await lage());
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    steg.push(await lage());
    logga("projekt", steg);

    // Forutsattningen: klicken tog flodet genom alla tre stegen.
    expect(steg.map((s) => s.framsteg)).toEqual(["1 av 3", "2 av 3", "3 av 3"]);
    // Och urvalet lamnade verkligen nagot utanfor – svarsalternativen.
    expect(steg[0].utanfor.length, "steg 1: inga svarsalternativ utanför räkningen – urvalet prövas inte").toBeGreaterThan(0);
    expect(steg.map((s) => s.navigering)).toEqual([["Nästa"], ["Nästa", "Tillbaka"], ["Spara projektet", "Tillbaka"]]);
  }, 60_000);

  it("projektflödet från ett utkast: Börja om syns och räknas inte som navigering", async () => {
    // Provet lagger dit sitt eget utkast, som hon gor: borjar fran tomt,
    // skriver ett namn och gar till sista steget. Utkastet ar forutsattningen
    // och provas for sig, sa att ett saknat utkast sager just det – inte att
    // Borja om ar borta.
    await oppnaProjektflodetTomt();
    await webblasare.utvardera(`document.querySelector('input[type="text"]').focus()`);
    await webblasare.cdp("Input.insertText", { text: "Nytt avlopp i köket" });
    await tryck("Nästa");
    await tryck("Ja, det är helt nytt");
    await tryck("Nästa");
    expect(await harUtkast(), "förutsättningen föll: inget utkast sparades i webbläsaren – Börja om kan inte prövas").toBe(true);

    // Samma adress igen laddar utkastet, med steget det stod pa. Tillbaka
    // tar det genom alla tre.
    await oppna("projekt");
    const steg: Lage[] = [await lage()];
    await tryck("Tillbaka");
    steg.push(await lage());
    await tryck("Tillbaka");
    steg.push(await lage());
    logga("projekt (utkast)", steg);

    expect(steg[0].framsteg, "utkastet fanns men laddades inte – flödet stod inte på sitt sparade steg").toBe("3 av 3");
    expect(steg.map((s) => s.framsteg)).toEqual(["3 av 3", "2 av 3", "1 av 3"]);
    // Utkastet ar laddat, sa Borja om ska synas i varje steg – annars provar
    // undantaget ingenting, och det ar da ett fel i flodet.
    for (const s of steg) expect(s.utanfor, `${s.framsteg}: utkastet är laddat men Börja om syns inte`).toContain(BORJA_OM);
    expect(steg.map((s) => s.navigering)).toEqual([["Spara projektet", "Tillbaka"], ["Nästa", "Tillbaka"], ["Nästa"]]);
  }, 60_000);

  it("skickflödet: Spara och nästa med Hoppa över, i varje steg – inget mer", async () => {
    await oppna("skick");
    const steg: Lage[] = [await lage()];
    await tryck("Hoppa över");
    steg.push(await lage());
    logga("skick", steg);

    expect(steg.map((s) => s.framsteg)).toEqual(["1 av 2", "2 av 2"]);
    expect(steg[0].utanfor.length, "inga svarsalternativ utanför räkningen – urvalet prövas inte").toBeGreaterThan(0);
    for (const s of steg) expect(s.navigering, s.framsteg).toEqual(["Spara och nästa", "Hoppa över"]);
  }, 60_000);
});
