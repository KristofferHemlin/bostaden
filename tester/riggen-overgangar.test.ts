import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHROME, startaWebblasare, type Webblasare } from "./_webblasare";

// Riggen stanger av CSS-overgangar i varje sida den oppnar (CLAUDE.md, "Mät
// aldrig mitt i en övergång"). En animerad egenskap har inget varde medan den
// andras: 2026-11-13 lastes en kvittorads yta mitt i sin transition-colors
// och kom ut som oklab(… / 0.457) – varken fore- eller eftervardet.
//
// Det har testet provar riggen, inte appen. Sidan har en overgang pa tva
// sekunder, sa att en lasning direkt efter andringen ALLTID hamnar mitt i den
// om overgangen finns kvar – felet ar framkallat med flit, inte vantat pa.
// Fyra fall: en overgang i en klassregel som Tailwinds, en i style-attributet,
// en efter en aterkomst med webblasarens bakatknapp (sidan aterstalls da ur
// minnet i stallet for att laddas om, och skyddet maste folja med), och en
// kontroll av att overgangen faktiskt finns i sidans egen CSS – annars
// passerade testet pa en sida som aldrig hade nagon.

const SIDA = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<style>.klass { background-color: rgb(255, 0, 0); transition: background-color 2s linear; }</style></head>
<body><div id="klass" class="klass">a</div>
<div id="attribut" style="background-color: rgb(255, 0, 0); transition: background-color 2s linear">b</div>
<a id="vidare" href="/nasta">vidare</a></body></html>`;

let w: Webblasare;

beforeAll(async () => {
  expect(existsSync(CHROME), `Chrome behövs – sätt CHROME_SOKVAG (${CHROME})`).toBe(true);
  w = await startaWebblasare({ sida: SIDA, nasta: "<!doctype html><p>nästa</p>" }, "kvittobo-overgangar-");
}, 60_000);

afterAll(async () => {
  await w?.stang();
});

/** Byter elementets farg och laser den direkt, i samma uppgift. */
async function bytOchLas(id: string): Promise<{ fore: string; efter: string; animationer: number }> {
  return w.utvardera(`(async () => {
    for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
    const e = document.getElementById(${JSON.stringify(id)});
    if (!e) throw new Error('hittade inte #${id}');
    const fore = getComputedStyle(e).backgroundColor;
    e.style.backgroundColor = 'rgb(0, 0, 255)';
    // En bildruta, sa att en overgang hinner borja om den finns.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { fore, efter: getComputedStyle(e).backgroundColor, animationer: e.getAnimations().length };
  })()`);
}

describe("riggen stänger av övergångar", () => {
  it("sidans egen CSS har en övergång på två sekunder – förutsättningen för fallen nedan", async () => {
    await w.cdp("Page.navigate", { url: `${w.adress}sida` });
    const regel = await w.utvardera<string>(`(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
      const r = [...document.styleSheets[0].cssRules].find(r => r.selectorText === '.klass');
      return r ? r.style.transitionDuration : 'ingen regel';
    })()`);
    expect(regel).toBe("2s");
  }, 30_000);

  for (const id of ["klass", "attribut"]) {
    it(`en färg som byts läses som sitt nya värde, inte mitt i övergången (${id})`, async () => {
      await w.cdp("Page.navigate", { url: `${w.adress}sida` });
      const m = await bytOchLas(id);
      expect(m.fore).toBe("rgb(255, 0, 0)");
      expect(m.efter).toBe("rgb(0, 0, 255)");
      expect(m.animationer).toBe(0);
    }, 30_000);
  }

  it("skyddet följer med när sidan återställs med bakåtknappen", async () => {
    await w.cdp("Page.navigate", { url: `${w.adress}sida` });
    await w.utvardera(`(async () => {
      for (let i = 0; i < 100 && document.readyState !== 'complete'; i++) await new Promise(r => setTimeout(r, 50));
      document.getElementById('vidare').click();
    })()`);
    let sida = "";
    for (let i = 0; i < 40 && sida !== "/nasta"; i++) {
      await new Promise((r) => setTimeout(r, 50));
      sida = await w.utvardera<string>("location.pathname").catch(() => "");
    }
    expect(sida, "länken ska leda vidare").toBe("/nasta");
    await w.utvardera("history.back()");
    for (let i = 0; i < 40 && sida !== "/sida"; i++) {
      await new Promise((r) => setTimeout(r, 50));
      sida = await w.utvardera<string>("location.pathname").catch(() => "");
    }
    expect(sida, "tillbaka på sidan").toBe("/sida");
    const m = await bytOchLas("klass");
    expect(m.efter).toBe("rgb(0, 0, 255)");
    expect(m.animationer).toBe(0);
  }, 30_000);
});
