// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Fragetradet, TOMMA_SVAR } from "@/app/projekt/fragetradet";

// docs/design.md, "Projektfrågorna": hjalprutan till fraga 5 har tre delar,
// ordagrant, och den tredje bar regeln om teknisk utveckling (CLAUDE.md,
// fragetradet; kontrollerad mot Skatteverkets sida 2026-10-25). Den regeln
// stod i CLAUDE.md fran 2026-10-18 men nadde aldrig rutan – det enda stalle
// dar nagon moter fragan.
//
// Det vantade lases ur design.md, inte ur komponenten: ett test som lases ur
// samma strang som det provar kan inte falla.

const DESIGN = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8").split("\n");
const normalisera = (t: string) => t.replace(/\s+/g, " ").trim();

/** Citatblocket efter stycket "Hjälprutan till fråga 5 …", ett element per del. */
function rutansDelarEnligtDesign(): string[] {
  let i = DESIGN.findIndex((r) => r.startsWith("**Hjälprutan till fråga 5"));
  expect(i, "stycket om fråga 5:s hjälpruta i design.md").toBeGreaterThanOrEqual(0);
  while (!DESIGN[i].startsWith(">")) i++;
  const rader: string[] = [];
  for (; i < DESIGN.length && DESIGN[i].startsWith(">"); i++) rader.push(DESIGN[i].replace(/^>\s?/, ""));
  return rader
    .join("\n")
    .split(/\n\s*\n/)
    .map((d) => normalisera(d.replace(/\*\*/g, "").replace(/\*/g, "")))
    .filter(Boolean);
}

function fraga5(): Element {
  const html = renderToStaticMarkup(
    createElement(Fragetradet, {
      varden: { ...TOMMA_SVAR, byggdeNytt: "nej", andradePlanlosning: "nej", nyttEllerBytt: "bytt" },
      onChange: () => {},
      helaBeloppet: 1_000_000,
    }),
  );
  const dok = new DOMParser().parseFromString(html, "text/html");
  const fieldset = [...dok.querySelectorAll("fieldset")].find((f) =>
    (f.querySelector("legend")?.textContent ?? "").startsWith("Är det nya av bättre kvalitet"),
  );
  expect(fieldset, "fråga 5 renderas när fråga 4 är 'bytt'").toBeTruthy();
  return fieldset!;
}

const rutan = () => fraga5().querySelector("[data-hjalpruta]")!;

describe("hjälprutan till fråga 5", () => {
  it("design.md gick att läsa: tre delar, den sista om teknisk utveckling", () => {
    const delar = rutansDelarEnligtDesign();
    expect(delar).toHaveLength(3);
    expect(delar[2]).toMatch(/^Och nytt är inte samma sak som bättre\./);
  });

  it("säger de tre delarna ordagrant som design.md, i ordning", () => {
    const pasidan = [...rutan().querySelectorAll("p")].map((p) => normalisera(p.textContent ?? ""));
    expect(pasidan).toEqual(rutansDelarEnligtDesign());
  });

  it("bär regeln om teknisk utveckling – den tredje delen, hel", () => {
    const regeln = rutansDelarEnligtDesign()[2];
    const pasidan = [...rutan().querySelectorAll("p")].map((p) => normalisera(p.textContent ?? ""));
    expect(pasidan).toContain(regeln);
  });

  it("ger aldrig en vitvara eller värmekälla som exempel på bättre kvalitet", () => {
    const battre = normalisera(rutan().querySelector("p")!.textContent ?? "");
    expect(battre.startsWith("Bättre:")).toBe(true);
    expect(battre).not.toMatch(/köksfläkt|kyl|frys|spis|ugn|diskmaskin|tvättmaskin|värmepump|panna/i);
  });
});
