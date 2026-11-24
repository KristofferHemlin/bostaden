// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Bekräftelsen av ägarandelen vid försäljningen, när summan går över 100 %
// (docs/design.md, "Summan av andelarna får inte överstiga 100 %"; CLAUDE.md,
// "Ett besked som bara bärs av en färg finns inte"). Till 2026-11-24 bar bara
// färgen beskedet tills hon tryckte, och sedan vägrade servern.
//
// Samma tre lager som inbjudan, prövade vart för sig: meningen vid fältet,
// fältet märkt ogiltigt, och en bekräftelse som inte går att skicka. Summan
// räknas som på servern (src/lib/egen-andel.ts, bekrafta: true): de andra
// medlemmarna, de utestående inbjudningarna och hennes egen. Bara hennes
// eget fält går att ändra här.
//
// Lydelsen läses ur design.md, inne i provet.

const h = vi.hoisted(() => ({ bekrafta: vi.fn(async () => ({})) }));

vi.mock("@/app/forsaljning/andel/actions", () => ({ bekraftaAndel: h.bekrafta }));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BekraftaAndel } from "@/app/forsaljning/andel/form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Meningen för 110 %, ordagrant ur design.md. Talen i citatet är exempel. */
function designensMening(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const avsnitt = design.indexOf("#### Summan av andelarna får inte överstiga 100 %");
  if (avsnitt < 0) throw new Error('design.md saknar avsnittet "Summan av andelarna får inte överstiga 100 %"');
  const m = design.slice(avsnitt).match(/^ *> \*\*(Tillsammans blir andelarna [^*]+)\*\*$/m);
  if (!m) throw new Error("design.md saknar meningen om summan under avsnittet");
  return m[1];
}

/** Hårt och vanligt mellanslag – design.md skriver vanligt, appen hårt före %. */
const mellanslag = (t: string) => t.replace(/ /g, " ");

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.bekrafta.mockClear();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

const faltet = () => {
  const f = behallare.querySelector<HTMLInputElement>('input[name="agarandel"]');
  if (!f) throw new Error("andelsfältet finns inte");
  return f;
};
const knappen = () => {
  const k = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Bekräfta ägarandelen");
  if (!k) throw new Error("knappen Bekräfta ägarandelen finns inte");
  return k;
};
const larm = () => [...behallare.querySelectorAll('[role="alert"]')].map((e) => e.textContent ?? "");

function meningenVidFaltet(): string | null {
  const id = faltet().getAttribute("aria-describedby");
  if (!id) return null;
  const el = document.getElementById(id);
  if (!el) throw new Error(`aria-describedby pekar på ${id}, som inte finns`);
  return el.textContent ?? "";
}

async function skriv(varde: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(faltet(), varde);
    faltet().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function skarmen({ egen, annan, inbjuden }: { egen: number; annan: number; inbjuden?: number }) {
  await act(async () =>
    rot.render(
      createElement(BekraftaAndel, {
        egenAndel: egen,
        medlemmar: [
          { epost: "anna@exempel.se", andel: egen, du: true },
          { epost: "doris@exempel.se", andel: annan, du: false },
        ],
        inbjudningar: inbjuden === undefined ? [] : [{ epost: "erik@exempel.se", andel: inbjuden }],
        nasta: "flode",
      }),
    ),
  );
}

async function skicka() {
  const form = faltet().form!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("din andel 60, Doris 50: summan över 100 %", () => {
  it("1. en mening vid fältet, designens lydelse med summan", async () => {
    await skarmen({ egen: 50, annan: 50 });
    await skriv("60");
    const mening = meningenVidFaltet();
    expect(mening, "fältet pekar på en mening").not.toBeNull();
    expect(mellanslag(mening!)).toBe(designensMening());
    expect(larm()).toContain(mening);
  });

  it("och båda procenttecknen har ett hårt mellanslag före sig", async () => {
    await skarmen({ egen: 50, annan: 50 });
    await skriv("60");
    expect(meningenVidFaltet()!.match(/\d %/g)).toHaveLength(2);
  });

  it("2. fältet är märkt ogiltigt", async () => {
    await skarmen({ egen: 50, annan: 50 });
    await skriv("60");
    expect(faltet().getAttribute("aria-invalid")).toBe("true");
  });

  it("3. knappen är avstängd, och ett inskick når inte servern", async () => {
    await skarmen({ egen: 50, annan: 50 });
    await skriv("60");
    expect(knappen().disabled).toBe(true);
    await skicka();
    expect(h.bekrafta).not.toHaveBeenCalled();
  });

  it("en utestående inbjudan räknas med: 50 + 40 + 20 är också för mycket", async () => {
    await skarmen({ egen: 50, annan: 40, inbjuden: 10 });
    await skriv("60");
    expect(faltet().getAttribute("aria-invalid")).toBe("true");
    expect(mellanslag(meningenVidFaltet()!)).toContain("110 %");
    expect(knappen().disabled).toBe(true);
  });
});

// Motprovet: samma skärm med en summa som går ihop.
describe("under och på taket bekräftas som vanligt", () => {
  for (const [egen, annan] of [[50, 50], [30, 50]] as const) {
    it(`${egen} + ${annan}: ingen mening, inget ogiltigt fält, knappen skickar`, async () => {
      await skarmen({ egen, annan });
      expect(faltet().hasAttribute("aria-invalid")).toBe(false);
      expect(meningenVidFaltet()).toBeNull();
      expect(larm()).toEqual([]);
      expect(knappen().disabled).toBe(false);
      await skicka();
      expect(h.bekrafta).toHaveBeenCalledOnce();
    });
  }
});

// Låsningen: de andras andelar är redan 100 %, så inget tal hon skriver går
// igenom (docs/design.md, "Vid försäljningen räcker det inte alltid att ändra
// sitt eget fält"). Meningen säger att någon annan måste ändra sin.
describe("de andras andelar är redan 100 %", () => {
  function lasningensLydelse(): string {
    const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
    const m = design.match(/^> \*\*(Övriga andelar är redan [^*]+)\*\*$/m);
    if (!m) throw new Error("design.md saknar låsningens lydelse");
    return m[1];
  }

  it("Doris 100 %: låsningens mening vid fältet, fältet ogiltigt och knappen avstängd – vad hon än skriver", async () => {
    await skarmen({ egen: 50, annan: 100 });
    for (const varde of ["50", "1"]) {
      await skriv(varde);
      expect(mellanslag(meningenVidFaltet() ?? ""), varde).toBe(lasningensLydelse());
      expect(faltet().getAttribute("aria-invalid")).toBe("true");
      expect(knappen().disabled).toBe(true);
    }
  });

  it("en utestående inbjudan räknas till de andra: 60 + 40 är också redan 100 %", async () => {
    await skarmen({ egen: 10, annan: 60, inbjuden: 40 });
    expect(mellanslag(meningenVidFaltet() ?? "")).toBe(lasningensLydelse());
  });

  it("motprovet: de andra på 90 % ger den vanliga meningen när hon skriver för mycket", async () => {
    await skarmen({ egen: 10, annan: 90 });
    await skriv("20");
    expect(mellanslag(meningenVidFaltet() ?? "")).toBe(designensMening());
  });
});
