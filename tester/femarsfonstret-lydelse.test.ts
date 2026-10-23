// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Landningssida } from "@/app/landningssida";
import { KategoriInfo } from "@/app/projekt/kategori-info";
import { reparationsfonsterForklaring } from "@/doman/regeltext";

// Femarsfonstret ar forsaljningsaret plus de fem narmast foregaende
// kalenderaren (CLAUDE.md, Bortfall) – inte "inom fem ar fore forsaljningen",
// som later som en rullande period bakat fran forsaljningsdagen. Den formen
// stod 2026-10-23 pa landningssidan, i projektlistans informationsknapp och i
// exportens skal, och den som laser den planerar fel.
//
// Den ratta lydelsen lases ur docs/design.md. Den forbjudna formen letas efter
// i det som renderas OCH i kallkoden, sa att en ny skarm med samma fel fangas
// aven om ingen har skrivit ett test for just den skarmen.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DESIGN = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
const normalisera = (t: string) => t.replace(/\s+/g, " ").trim();

// Det regelparametern ger i dag. Texterna tar talet som argument.
const FONSTER_AR = 5;

/** "inom fem år före försäljningen", "mer än sex år före försäljningen" … */
const ROLLANDE = /(inom|mer än)\s+\S+\s+år\s+före\s+försäljningen/i;

function infoknappenEnligtDesign(): string[] {
  const rad = DESIGN.split("\n").find((r) =>
    r.startsWith("**En informationsknapp vid listans rubrik"),
  );
  expect(rad, "informationsknappens stycke i design.md").toBeTruthy();
  const utanRubrik = rad!.replace(/^\*\*[^*]+\*\*\s*/, "");
  return utanRubrik.split(/ (?=Reparation: )/).map(normalisera);
}

function exportskaletEnligtDesign(): string {
  const traff = DESIGN.match(/Lydelsen ska vara: \*"([^"]+)"\*/);
  expect(traff, "exportskalets lydelse i design.md").toBeTruthy();
  return traff![1];
}

/** Informationsknappen, oppnad med ett riktigt klick, som text per stycke. */
async function infoknappensText(): Promise<string[]> {
  const behallare = document.createElement("div");
  document.body.appendChild(behallare);
  const rot = createRoot(behallare);
  await act(async () => rot.render(createElement(KategoriInfo, { fonsterAr: FONSTER_AR })));
  const knapp = behallare.querySelector("button")!;
  await act(async () => knapp.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  const stycken = [...behallare.querySelectorAll("div.bg-sand p")].map((p) => normalisera(p.textContent ?? ""));
  await act(async () => rot.unmount());
  behallare.remove();
  return stycken;
}

describe("projektlistans informationsknapp", () => {
  it("säger ordagrant det design.md säger, när den öppnats", async () => {
    const forvantat = infoknappenEnligtDesign();
    expect(forvantat).toHaveLength(2);
    expect(await infoknappensText()).toEqual(forvantat);
  });
});

describe("exportens skäl när en reparation fallit ur fönstret", () => {
  it("är design.md:s lydelse, ordagrant", () => {
    expect(reparationsfonsterForklaring(FONSTER_AR)).toBe(exportskaletEnligtDesign());
  });
});

describe("ingenstans beskrivs fönstret som en period bakåt från försäljningen", () => {
  it("inte i det som renderas", async () => {
    const renderat = [
      normalisera(new DOMParser().parseFromString(renderToStaticMarkup(Landningssida()), "text/html").body.textContent ?? ""),
      ...(await infoknappensText()),
      ...[5, 6, 15].map(reparationsfonsterForklaring),
    ];
    for (const t of renderat) expect(t).not.toMatch(ROLLANDE);
  });

  it("inte i någon källfil – en ny skärm med samma fel fångas också", () => {
    const filer: string[] = [];
    const ga = (k: string) => {
      for (const n of readdirSync(k)) {
        const p = join(k, n);
        if (statSync(p).isDirectory()) ga(p);
        else if (/\.(tsx?|md)$/.test(n)) filer.push(p);
      }
    };
    ga(join(process.cwd(), "src"));
    expect(filer.length).toBeGreaterThan(50);

    const traffar = filer.filter((f) => {
      // Ett uttryck i JSX ({talSomOrd(fonsterAr)}) ar ett ord i den renderade
      // texten – raknas som ett.
      const text = normalisera(readFileSync(f, "utf-8").replace(/\{[^{}\n]*\}/g, "X"));
      return ROLLANDE.test(text);
    });
    expect(traffar).toEqual([]);
  });
});
