import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  avbryt,
  BEKRAFTA_BILAGEBORTTAGNING,
  BEKRAFTA_BILAGEBORTTAGNING_KVITTO,
  bekrafta,
  tryckPaKryss,
  utkastetsBekraftelse,
  type Bilageborttagning,
} from "@/lib/bilageborttagning";

// docs/design.md, "Kvittolistan": att ta bort en bilaga ar tva olika
// handlingar, och bara den ena ska bekraftas. En sparad bilaga raderas pa
// servern i samma ogonblick och ar kvittots exemplar – bekraftelse. En nyss
// vald fil ligger kvar i telefonen – ingen bekraftelse, eftersom en dialog for
// mycket i kameraflodet ar ett eget fel.

const SPARAD: Bilageborttagning = { kalla: "sparad", bilagaId: "b1", filnamn: "kvitto.jpg" };
const NYVALD: Bilageborttagning = { kalla: "nyvald", index: 0, filnamn: "IMG_0001.jpg" };

describe("en sparad bilaga kraver bekraftelse", () => {
  it("ett tryck pa krysset tar inte bort den – den vantar", () => {
    expect(tryckPaKryss(SPARAD)).toEqual({ vantar: SPARAD, utfor: null });
  });

  it("Ta bort i bekraftelsen tar bort just den", () => {
    expect(bekrafta(SPARAD)).toEqual({ vantar: null, utfor: SPARAD });
  });

  it("Avbryt tar inte bort nagonting", () => {
    expect(avbryt()).toEqual({ vantar: null, utfor: null });
  });
});

describe("en nyss vald fil tas bort direkt", () => {
  it("ett tryck pa krysset tar bort den utan bekraftelse", () => {
    expect(tryckPaKryss(NYVALD)).toEqual({ vantar: null, utfor: NYVALD });
  });
});

describe("texterna", () => {
  it("krysset i nytt kvitto sager foljden ordagrant", () => {
    expect(BEKRAFTA_BILAGEBORTTAGNING).toBe("Ta bort bilagan? Den går inte att få tillbaka.");
  });

  it("detaljvyn sager samma mening ordagrant, plus det som bara ar sant dar", () => {
    expect(BEKRAFTA_BILAGEBORTTAGNING_KVITTO).toBe(
      "Ta bort bilagan? Den går inte att få tillbaka. Kvittots uppgifter ligger kvar.",
    );
    expect(BEKRAFTA_BILAGEBORTTAGNING_KVITTO.startsWith(BEKRAFTA_BILAGEBORTTAGNING)).toBe(true);
  });

  it("detaljvyn laser texten fran modulen, inte en egen kopia", async () => {
    const vy = await readFile(
      path.resolve(import.meta.dirname, "../src/app/kostnad/[id]/bilagor.tsx"),
      "utf8",
    );
    expect(vy).toContain("{BEKRAFTA_BILAGEBORTTAGNING_KVITTO}");
    expect(vy).not.toContain("Bilden raderas");
  });
});

// "Och darfor fragar soptunnan ocksa, nar utkastet har en bilaga." Ett utkast
// med ett foto AR fotot – raderingen tar filerna i lagringen med sig. Ett
// tomt utkast har inget varde, och en fraga dar ar ett eget fel.
describe("utkastets soptunna", () => {
  it("ett tomt utkast tas bort utan fraga", () => {
    expect(utkastetsBekraftelse(0)).toBeNull();
  });

  it("ett utkast med en bilaga fragar, i singular", () => {
    expect(utkastetsBekraftelse(1)).toBe(
      "Ta bort utkastet? Bilagan försvinner med det och går inte att få tillbaka.",
    );
  });

  it("ett utkast med flera bilagor fragar, i plural", () => {
    expect(utkastetsBekraftelse(3)).toBe(
      "Ta bort utkastet? Bilagorna försvinner med det och går inte att få tillbaka.",
    );
  });

  it("soptunnan laser regeln fran modulen och har ingen egen", async () => {
    const knapp = await readFile(
      path.resolve(import.meta.dirname, "../src/app/kostnad/utkast-radera.tsx"),
      "utf8",
    );
    expect(knapp).toContain("utkastetsBekraftelse(antalBilagor)");
    expect(knapp).not.toMatch(/antalBilagor\s*[><=]/);
  });

  it("alla tre soptunnorna skickar med antalet bilagor, och inget ar ett inskrivet tal", async () => {
    const filer = ["../src/app/page.tsx", "../src/app/kostnad/page.tsx", "../src/app/kostnad/nytt/form.tsx"];
    let antal = 0;
    for (const f of filer) {
      const text = await readFile(path.resolve(import.meta.dirname, f), "utf8");
      for (const m of text.matchAll(/<UtkastRaderaKnapp[\s\S]*?\/>/g)) {
        antal += 1;
        expect(m[0]).toMatch(/antalBilagor=\{/);
        expect(m[0]).not.toMatch(/antalBilagor=\{\s*\d+\s*\}/);
      }
    }
    expect(antal).toBe(3);
  });
});

// Komponenten gar inte att klicka i utan en DOM-miljo, och projektet har
// ingen. Det som gor modulen ovan till en sparr ar att formularet ALDRIG
// verkstaller en borttagning pa egen hand: de bada borttagningsfunktionerna
// anropas bara fran hanteraBorttagning, som bara far det modulen lamnar
// tillbaka, och varje kryss gar genom tryckPaKryss.
describe("formularet gar alltid genom bilageborttagning", () => {
  async function kalla(): Promise<string> {
    return readFile(path.resolve(import.meta.dirname, "../src/app/kostnad/nytt/form.tsx"), "utf8");
  }

  function anrop(text: string, namn: string): number {
    return [...text.matchAll(new RegExp(`(?<!function )\\b${namn}\\(`, "g"))].length;
  }

  it("taBortBefintlig och taBortFil anropas bara fran hanteraBorttagning", async () => {
    const text = await kalla();
    const start = text.indexOf("function hanteraBorttagning(");
    const slut = text.indexOf("\n  }\n", start);
    const kropp = text.slice(start, slut);
    expect(start).toBeGreaterThan(-1);
    for (const namn of ["taBortBefintlig", "taBortFil"]) {
      expect(anrop(text, namn)).toBe(1);
      expect(anrop(kropp, namn)).toBe(1);
    }
  });

  it("bada kryssen gar genom tryckPaKryss, ett for sparade och ett for nyvalda", async () => {
    const text = await kalla();
    expect(text).toMatch(/tryckPaKryss\(\{ kalla: "sparad"/);
    expect(text).toMatch(/tryckPaKryss\(\{ kalla: "nyvald"/);
  });
});

// Efter "Ta bort" i bekraftelsen far ett misslyckande inte vara tyst: bilagan
// tas bort ur vyn forst nar servern svarat ja.
describe("ett misslyckat borttagande av en sparad bilaga", () => {
  it("svaret fran servern lases, och felet svaljs inte", async () => {
    const text = await readFile(path.resolve(import.meta.dirname, "../src/app/kostnad/nytt/form.tsx"), "utf8");
    const start = text.indexOf("async function taBortBefintlig(");
    const kropp = text.slice(start, text.indexOf("\n  }\n", start));
    expect(start).toBeGreaterThan(-1);
    expect(kropp).toContain("await taBortBilaga(");
    expect(kropp).not.toContain(".catch(() => {})");
    // Vyn andras forst efter att svaret provats.
    expect(kropp.indexOf("if (!svar.ok)")).toBeLessThan(kropp.indexOf("setBefintliga("));
  });
});
