import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AVLASNINGEN_KORDES_INTE } from "@/lib/avlasningsbesked";

// Nar avlasningen inte kordes ar BARA bilagan sparad. Kostnaden ar ett utkast
// utan belopp och raknas inte nagonstans. Ett besked som sager att kvittot ar
// sparat far henne att lagga undan telefonen – och fem ar senare saknas
// kvittot i underlaget fast hon gjorde precis det appen bad om.

const FORMULAR = path.join(__dirname, "../src/app/kostnad/nytt/form.tsx");

describe("beskedet nar avlasningen inte kordes", () => {
  it("sager att bilagan ar sparad och att kvittot raknas forst nar det sparats", () => {
    expect(AVLASNINGEN_KORDES_INTE).toBe(
      "Bilagan är sparad, men den gick inte att läsa av. Fyll i uppgifterna nedan och spara – först då räknas kvittot med.",
    );
  });

  it("pastar aldrig att kvittot ar sparat", () => {
    expect(AVLASNINGEN_KORDES_INTE).not.toMatch(/kvittot (är|har) sparats?|kvittot är sparat/i);
  });

  it("formularet visar konstanten och ingen egen lydelse", async () => {
    const kalla = await readFile(FORMULAR, "utf8");
    expect(kalla).toMatch(/\{AVLASNINGEN_KORDES_INTE\}/);
    expect(kalla).not.toMatch(/Kvittot är sparat/i);
  });
});
