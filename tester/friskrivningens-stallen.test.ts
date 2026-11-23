import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Friskrivningen står på exportvyn och ingen annanstans (docs/design.md,
// "Friskrivningen bor på exportvyn" och "de två skärmarna vid försäljningen
// tappar också friskrivningen"). Ställena räknas upp ur koden: varje fil i
// src/ som använder komponenten, eller som bär friskrivningens egen text, ska
// stå i listan nedan – med sitt skäl.

const TILLATNA: Record<string, string> = {
  "src/components/skarm.tsx": "komponenten själv",
  "src/app/export/page.tsx": "exportvyn – det enda stället den ska stå",
  "src/lib/bilagepaket/pdf.ts":
    "bilagepaketets försättssida, exportens utskrift (bakom BILAGEPAKET_SYNLIGT); kan inte använda komponenten och bär därför texten",
};

function filerMedFriskrivningen(): string[] {
  const traffar: string[] = [];
  const ga = (katalog: string) => {
    for (const d of readdirSync(join(process.cwd(), katalog), { withFileTypes: true })) {
      const fil = join(katalog, d.name);
      if (d.isDirectory()) ga(fil);
      else if (/\.(tsx?|md)$/.test(d.name)) {
        const text = readFileSync(join(process.cwd(), fil), "utf8");
        // Komponentens användning, eller en avskrift av dess text.
        if (/<Friskrivning\b/.test(text) || /export function Friskrivning\b/.test(text) || text.includes("upplysningstjänst")) {
          traffar.push(fil);
        }
      }
    }
  };
  ga("src");
  return traffar.sort();
}

describe("friskrivningen står på exportvyn och ingen annanstans", () => {
  it("ställena i src/ är just de tillåtna", () => {
    const filer = filerMedFriskrivningen();
    expect(filer, "förutsättningen: komponenten hittades").toContain("src/components/skarm.tsx");
    expect(filer).toEqual(Object.keys(TILLATNA).sort());
  });

  it("exportvyn använder den", () => {
    const sidan = readFileSync(join(process.cwd(), "src/app/export/page.tsx"), "utf8");
    expect(sidan).toMatch(/<Friskrivning\s*\/>/);
  });
});
