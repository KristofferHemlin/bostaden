import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";
import { paketera } from "./_paketera";

// Tillträdesfrågans knapp, i en riktig Chrome med riktiga klick
// (docs/design.md, "Ändra datumet måste leda till det datum som prövas").
//
// Gränsen prövar KVITTOTS datum, inte betaldagen. Sedan formuläret bara
// visar betaldagen låg det prövade datumet dolt när avläsningen läst ett
// annat, och "Ändra datumet" flyttade markören till Betaldatum – där ingen
// ändring släcker frågan. Provet går hela varvet: frågan ställs, knappen
// trycks, året rättas där markören landar, frågan släcks och kvittot sparas
// med rätt tal i båda kolumnerna.
//
// Kvittot är ett återupptaget utkast, eftersom det är så ett dokumentdatum
// som skiljer sig från betaldagen når formuläret utan en fil: avläsningen
// läste fakturadatumet, sparandet av utkastet bar det med sig. Fakturan är
// daterad 2024-12-28 – ett feltypat år för 2025-12-28 – och betald
// 2026-01-08. Tillträdet var 2025-06-01.
//
// Sparandet byts mot ett som noterar formuläret (window.__inskickat).

const TILLTRADE = "2025-06-01";

function ingang(falt: { datum: string; dokumentdatum: string }) {
  return `
import { createRoot } from "react-dom/client";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";
window.__inskickat = [];
createRoot(document.getElementById("rot")).render(
  <NyKostnadForm
    bostad={{ id: "b0000000-0000-4000-8000-000000000095", namn: null }}
    innehav={{ tilltradesdatum: "${TILLTRADE}", forsaljningsdatum: null }}
    utkast={{
      id: "k0000000-0000-4000-8000-000000000095",
      anteckning: "Trappan",
      falt: { belopp: "8 500,00", datum: "${falt.datum}", dokumentdatum: "${falt.dokumentdatum}", leverantor: "Snickeri Nord AB", rot: "1 800,00" },
      bilagor: [],
    }}
  />,
);
`;
}

const ACTIONS = `
export async function skapaUtkast() { return { kostnadId: "k0000000-0000-4000-8000-000000000095" }; }
export async function sparaUtkastfalten() { return { ok: true }; }
export async function sparaKostnad(formData) {
  const falt = {};
  for (const [k, v] of formData.entries()) falt[k] = String(v);
  window.__inskickat.push(falt);
  return { kostnadId: "k0000000-0000-4000-8000-000000000095" };
}
`;

let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att klicka som en användare – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const sida = async (falt: { datum: string; dokumentdatum: string }) => {
    const skript = await paketera(ingang(falt), { "app/kostnad/nytt/actions.ts": ACTIONS });
    return `<!doctype html><html lang="sv"><head><meta charset="utf-8"></head>
<body><div id="rot"></div><script>${skript.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
  };
  webblasare = await startaWebblasare(
    {
      olika: await sida({ datum: "2026-01-08", dokumentdatum: "2024-12-28" }),
      lika: await sida({ datum: "2026-01-08", dokumentdatum: "" }),
    },
    "kvittobo-tilltrade-",
  );
}, 90_000);

afterAll(async () => {
  await webblasare?.stang();
});

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function oppna(namn: string) {
  await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}${namn}` });
  await vanta(800);
}

/** Ett klick som användarens: musknappen ner och upp mitt på knappen. */
async function tryck(text: string) {
  const punkt = await webblasare.utvardera<{ x: number; y: number } | null>(`(() => {
    const el = [...document.querySelectorAll("button")].find(
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
  await vanta(250);
}

interface Lage {
  /** Datumfältens etiketter och värden, som de syns: "Betaldatum 2026-01-08". */
  datumfalt: string[];
  fragan: string | null;
  /** Etiketten på fältet markören står i. */
  markoren: string | null;
  inskickat: Record<string, string>[];
}

async function lage(): Promise<Lage> {
  return webblasare.utvardera<Lage>(`(() => {
    const syns = (e) => e.closest("[hidden]") === null && e.getClientRects().length > 0;
    const datumfalt = [...document.querySelectorAll("label")].filter((l) => syns(l) && l.querySelector('input[aria-label="År"]'))
      .map((l) => {
        const v = [...l.querySelectorAll('input[aria-label="År"], input[aria-label="Månad"], input[aria-label="Dag"]')].map((i) => i.value).join("-");
        return l.querySelector("span").textContent.replace(/\\*$/, "").trim() + " " + v;
      });
    const rubrik = [...document.querySelectorAll("h2, h3, p")].find((e) => syns(e) && e.textContent.trim() === "Datumet ligger före tillträdet");
    const fragan = rubrik ? rubrik.parentElement.closest("div").textContent.replace(/\\s+/g, " ").trim() : null;
    const aktiv = document.activeElement;
    const etikett = aktiv && aktiv.closest("label") ? aktiv.closest("label").querySelector("span").textContent.replace(/\\*$/, "").trim() : null;
    return { datumfalt, fragan, markoren: etikett, inskickat: window.__inskickat };
  })()`);
}

/** Skriver över året i fältet markören står i, som hon gör: markera, skriv. */
async function skrivAret(ar: string) {
  await webblasare.utvardera(`document.activeElement.select()`);
  await webblasare.cdp("Input.insertText", { text: ar });
  await vanta(150);
}

describe("tillträdesfrågans knapp, med riktiga klick i Chrome", () => {
  it("fakturadatum före tillträdet, betaldag efter: frågan, knappen, rättelsen, sparat", async () => {
    await oppna("olika");
    const start = await lage();
    console.log("start:", JSON.stringify(start));

    await tryck("Spara kvittot");
    const fragad = await lage();
    console.log("frågan:", JSON.stringify(fragad));
    expect(fragad.fragan, "förutsättningen: tillträdesfrågan ställdes").toContain("kvittot är daterat 2024-12-28");
    expect(fragad.inskickat).toHaveLength(0);

    await tryck("Ändra datumet");
    const andra = await lage();
    console.log("ändra:", JSON.stringify(andra));
    expect(andra.fragan, "frågan stängdes inte").toBeNull();
    expect(andra.markoren, "markören landade inte i det prövade datumet").toBe("Kvittots datum");

    await skrivAret("2025");
    await tryck("Spara kvittot");
    const igen = await lage();
    console.log("efter rättelsen:", JSON.stringify(igen));
    expect(igen.fragan, "frågan ställdes igen efter rättelsen").toBeNull();
    // Inget kvitto bifogat – utkastet har ingen fil. Den frågan är en annan.
    await tryck("Spara ändå");
    const sparat = await lage();
    console.log("sparat:", JSON.stringify(sparat.inskickat));
    expect(sparat.inskickat).toHaveLength(1);
    expect({ dokumentdatum: sparat.inskickat[0].dokumentdatum, betaldatum: sparat.inskickat[0].betaldatum }).toEqual({
      dokumentdatum: "2025-12-28",
      betaldatum: "2026-01-08",
    });
  }, 60_000);

  it("fältet syns när datumen skiljer sig – och inte när de är lika", async () => {
    await oppna("olika");
    expect((await lage()).datumfalt).toEqual(["Betaldatum 2026-01-08", "Kvittots datum 2024-12-28"]);
    await oppna("lika");
    expect((await lage()).datumfalt).toEqual(["Betaldatum 2026-01-08"]);
  }, 60_000);
});
