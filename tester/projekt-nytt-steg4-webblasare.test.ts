import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";
import { paketera } from "./_paketera";

// Projektflödets sista steg, i en riktig webbläsare med riktiga klick. Flödet
// hade fyra steg när felet hittades och har tre sedan 2026-11-19
// (docs/design.md, "Namnet och delen av bostaden står på samma skärm");
// villkoret är detsamma – Nästa på steget före kvittona.
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

let webblasare: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs för att klicka som en användare – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  const skript = await paketera(INGANG);
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

/** Flödet från början till kvittosteget, med riktiga klick. Varje prov går
 *  vägen själv – inget prov fortsätter där ett annat slutade. Stegen
 *  returneras så att provet kan pröva att vägen gick som den skulle. */
async function tillKvittosteget(): Promise<Lage[]> {
  await webblasare.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  // Flodet sparar ett utkast i webblasaren, och ett utkast oppnar pa sitt
  // sparade steg. Lagringen hor till sidans ursprung, sa sidan oppnas, toms
  // och oppnas igen.
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}flode` });
  await vanta(500);
  await webblasare.utvardera("localStorage.clear()");
  await webblasare.cdp("Page.navigate", { url: `${webblasare.adress}flode` });
  await vanta(500);

  const steg: Lage[] = [];
  steg.push(await lage());
  // Namnet, som hon skriver det.
  await webblasare.utvardera(`document.querySelector('input[type="text"]').focus()`);
  await webblasare.cdp("Input.insertText", { text: "Nytt avlopp i köket" });
  await tryck("Nästa");
  steg.push(await lage());
  await tryck("Ja, det är helt nytt");
  await tryck("Nästa");
  steg.push(await lage());
  return steg;
}

describe("projektflödets sista steg, med riktiga klick i Chrome", () => {
  it("Nästa på frågeträdet leder till kvittona – och skickar ingenting", async () => {
    const steg = await tillKvittosteget();

    for (const [i, s] of steg.entries()) console.log(`steg ${i + 1}: ${s.framsteg} · skickat ${s.inskickat}\n  ${s.synligt}`);

    // Förutsättningen: flödet gick verkligen genom stegen 1–2 med klicken.
    expect(steg.slice(0, 2).map((s) => s.framsteg)).toEqual(["1 av 3", "2 av 3"]);
    // Och Nästa på steg 2 leder till steg 3, utan att något skickats.
    expect(steg[2].inskickat, "formuläret skickades från steg 2").toBe(0);
    expect(steg[2].framsteg).toBe("3 av 3");
    expect(steg[2].synligt).toContain(KVITTO.rubrik);
  }, 60_000);

  it("på sista steget väljs kvittot, och Spara skickar en gång – med kvittot", async () => {
    // Utgangslaget byggs har, inte arvt fran provet ovan.
    const steg = await tillKvittosteget();
    expect(steg[2].framsteg, "förutsättningen föll: flödet nådde inte kvittosteget").toBe("3 av 3");
    expect(steg[2].inskickat, "förutsättningen föll: formuläret skickades på vägen till kvittosteget").toBe(0);

    // Raden är en etikett som växlar rutan; den hittas på anteckningen.
    const punkt = await webblasare.utvardera<{ x: number; y: number } | null>(`(() => {
      const l = [...document.querySelectorAll("label")].find(
        (e) => e.closest("[hidden]") === null && e.textContent.includes(${JSON.stringify(KVITTO.rubrik)}));
      if (!l) return null;
      const r = l.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    expect(punkt, "kvittoraden på sista steget").not.toBeNull();
    for (const type of ["mousePressed", "mouseReleased"]) {
      await webblasare.cdp("Input.dispatchMouseEvent", { type, x: punkt!.x, y: punkt!.y, button: "left", clickCount: 1 });
    }
    await vanta(150);
    expect((await lage()).inskickat, "att välja ett kvitto skickar ingenting").toBe(0);

    await tryck("Spara projektet");
    const skickat = await webblasare.utvardera<Record<string, string[]>[]>("window.__inskickat");
    expect(skickat).toHaveLength(1);
    expect(skickat[0].kostnad_ider).toEqual([KVITTO.id]);
    expect(skickat[0].namn).toEqual(["Nytt avlopp i köket"]);
  }, 60_000);
});
