import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Friskrivning } from "@/components/skarm";
import { byggK6aExport } from "@/doman/export-k6a";
import { byggBilagepaketPdf } from "@/lib/bilagepaket/pdf";
import { FRISKRIVNINGEN } from "@/lib/friskrivning";
import { REGELPARAMETRAR } from "./_hjalp";
import { pdfText } from "./_pdf-text";

// Friskrivningen står på exportvyn och på bilagepaketets försättssida, och
// ingen annanstans (docs/design.md, "Friskrivningen står på tre ställen").
// Lydelsen står en gång i koden, i src/lib/friskrivning.ts, och båda
// återgivningarna läser den därifrån ("Texten får inte vara avskriven"). Det
// som renderas jämförs med lydelsen i designfilen, inte med konstanten: annars
// vaktar proven bara att skärmen och PDF:en säger samma sak.
//
// Ställena räknas upp ur koden. Landningssidans mening ("Appen ger ingen
// skatterådgivning och ersätter inte …") är en annan text med ett annat
// ärende och träffas inte av mönstren nedan (docs/design.md, "Landningssidans
// mening hör inte hit").

const KALLAN = "src/lib/friskrivning.ts";

/** Friskrivningens egna ord, också i en avgrenad avskrift av dem. */
const BAR_TEXTEN = /upplysningstjänst|Vid gränsfall|ingen skatterådgivning\./;

function filer(villkor: (text: string) => boolean): string[] {
  const traffar: string[] = [];
  const ga = (katalog: string) => {
    for (const d of readdirSync(join(process.cwd(), katalog), { withFileTypes: true })) {
      const fil = join(katalog, d.name);
      if (d.isDirectory()) ga(fil);
      else if (/\.(tsx?|md)$/.test(d.name) && villkor(readFileSync(join(process.cwd(), fil), "utf8"))) traffar.push(fil);
    }
  };
  ga("src");
  return traffar.sort();
}

const normalisera = (t: string) => t.replace(/\s+/g, " ").trim();

/** Lydelsen ur docs/design.md – läst i provet, inte på modulnivå. */
function lydelsen(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Lydelsen står här, och det är först nu den går att vakta:\*\*\s*\n\s*\n> (.+)\n/);
  if (!m) throw new Error("design.md saknar friskrivningens lydelse");
  return m[1].trim();
}

describe("friskrivningen: en text, två återgivningar", () => {
  it("texten står bara i källan – ingen fil i src/ bär en avskrift", () => {
    expect(BAR_TEXTEN.test(FRISKRIVNINGEN), "förutsättningen: mönstret träffar lydelsen").toBe(true);
    expect(filer((t) => BAR_TEXTEN.test(t))).toEqual([KALLAN]);
  });

  it("konstanten läses av komponenten och av PDF:en, och av inget annat", () => {
    expect(filer((t) => /\bFRISKRIVNINGEN\b/.test(t))).toEqual(
      [KALLAN, "src/components/skarm.tsx", "src/lib/bilagepaket/pdf.ts"].sort(),
    );
  });

  it("komponenten står på exportvyn och ingen annanstans", () => {
    expect(filer((t) => /<Friskrivning\b/.test(t))).toEqual(["src/app/export/page.tsx"]);
  });

  it("konstanten är designfilens lydelse", () => {
    expect(FRISKRIVNINGEN).toBe(lydelsen());
  });

  it("komponenten renderar designfilens lydelse som hela elementets text", () => {
    const html = renderToStaticMarkup(createElement(Friskrivning));
    expect(normalisera(html.replace(/<[^>]+>/g, ""))).toBe(lydelsen());
  });

  it("försättssidan i PDF:en bär designfilens lydelse", async () => {
    const ex = byggK6aExport({
      bostad: { upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15", nybyggd_vid_forvarv: false },
      medlemskap: { agarandel: 100 },
      projekt: [],
      kostnader: [],
      utkast_som_inte_ar_tomma: [],
      regelparametrar: REGELPARAMETRAR,
    });
    const pdf = await byggBilagepaketPdf(
      {
        forsattsdata: {
          bostadsnamn: "Villan", adress: "Ulriksborgsgatan 7", ort: "Stockholm", identifiering: null,
          upplatelseform: "fastighet", tilltradesdatum: "2016-06-01", forsaljningsdatum: "2026-09-15",
          agarandelProcent: 100, skapadDatum: "2026-10-19",
        },
        ex,
        aterstar: [],
        radavdrag: {},
        bilagesidor: [],
        filnamn: "Deklarationsunderlag.pdf",
      },
      () => {},
    );
    const text = normalisera(await pdfText(pdf));
    expect(text.length, "förutsättningen: PDF:ens text gick att läsa").toBeGreaterThan(0);
    expect(text).toContain(lydelsen());
  });
});
