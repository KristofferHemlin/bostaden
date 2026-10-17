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
