// Integritetspolicyn ar en juridisk text och star som den star – den laser
// inga konstanter (src/app/integritetspolicy/page.tsx). Mejladressen och
// tjanstens namn ar darfor skrivna for hand i markdownen, och de har testerna
// ser till att de inte glider isar fran src/lib/kontakt.ts.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KONTAKTADRESS, TJANSTENS_NAMN } from "@/lib/kontakt";

const POLICY = path.join(__dirname, "../src/innehall/integritetspolicy.md");

/** Tjanstens tidigare namn – far aldrig synas i policyn igen. */
const TIDIGARE_NAMN = ["Bostadsunderlag", "Kajin"];

async function lasPolicy(): Promise<string> {
  return readFile(POLICY, "utf8");
}

describe("integritetspolicyn", () => {
  it("anger KONTAKTADRESS och ingen annan mejladress", async () => {
    const text = await lasPolicy();
    const adresser = new Set(
      (text.match(/[^\s<>()*]+@[^\s<>()*]+\.[a-z]{2,}/gi) ?? []).map((a) => a.toLowerCase()),
    );
    expect([...adresser]).toEqual([KONTAKTADRESS.toLowerCase()]);
  });

  it("namnger tjansten med TJANSTENS_NAMN och aldrig med ett tidigare namn", async () => {
    const text = await lasPolicy();
    expect(text).toContain(TJANSTENS_NAMN);
    for (const namn of TIDIGARE_NAMN) {
      expect(text.toLowerCase(), namn).not.toContain(namn.toLowerCase());
    }
  });
});

describe("registreringens hanvisning", () => {
  // Det finns inga villkor i appen, bara integritetspolicyn. En mening som
  // hanvisar till ett dokument som inte finns far inte sta pa skarmen alla passerar.
  it("hanvisar till integritetspolicyn och inte till villkor", async () => {
    const flode = await readFile(path.join(__dirname, "../src/app/registrera/flode.tsx"), "utf8");
    expect(flode).not.toMatch(/villkoren/);
    expect(flode).toMatch(/href="\/integritetspolicy"/);
  });
});

describe("sakerhetskopiorna", () => {
  // Policyn binds till LOFTET, inte till genomforandet: rensningens grans ar
  // kortare och raknas fram ur loftet (src/lib/sakerhetskopior/rensning.ts,
  // sambandet provas i tester/sakerhetskopior-rensning.test.ts).
  it("lovar det loftet rensningen ar byggd for att halla", async () => {
    const { LOFTE_DAGAR } = await import("@/lib/sakerhetskopior/rensning");
    const text = await lasPolicy();
    expect(text).toContain(`senast ${LOFTE_DAGAR} dagar efter raderingen`);
  });
});
