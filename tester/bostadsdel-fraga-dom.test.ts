// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "Vilken del av bostaden?" i fas 2, provat i en DOM (docs/design.md, "Vilken
// del av bostaden projektet rörde"): efter namnet, knappar per
// upplatelseform, flerval, och Annat som oppnar ett fritextfalt. Det formularet
// skickar ar det servern tolkar – raden i tester/bostadsdel.test.ts provar
// vad som sparas.

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/genomgang/fragor/actions", () => ({ klassificeraHog: vi.fn(async () => ({})) }));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Fas2 } from "@/app/genomgang/fragor/fas2";
import { BostadsdelFraga } from "@/app/projekt/bostadsdel-fraga";
import { tolkaBostadsdelar } from "@/doman/bostadsdel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

function fragan(): string {
  const m = design().match(/Efter namnet i fas 2 kommer \*\*"([^"]+)"\*\*/);
  if (!m) throw new Error("design.md saknar fragan");
  return m[1];
}

function knapparIDesign(): { bostadsratt: string[]; fastighetPlus: string[] } {
  const d = design();
  const br = d.match(/^\| Bostadsrätt \| (.+) \|$/m);
  const fa = d.match(/^\| Fastighet \| Alla ovan, plus (.+) \|$/m);
  if (!br || !fa) throw new Error("design.md saknar knapptabellen");
  return { bostadsratt: br[1].split(", "), fastighetPlus: fa[1].split(", ") };
}

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

const HOG = {
  id: "c0000000-0000-4000-8000-0000000000a1",
  kvitton: [{ id: "k1", rubrik: "Nytt kök", anteckning: true, underrad: "Beijer Bygg · 2025-05-02", belopp: 1_800_000 }],
  belopp: 1_800_000,
  summa: 1_800_000,
};

/** Fragans faltgrupp, hittad pa sin rubrik. */
function grupp(): HTMLFieldSetElement {
  const legend = [...behallare.querySelectorAll("legend")].find((l) => l.textContent === fragan());
  if (!legend) throw new Error("fragan renderas inte");
  return legend.parentElement as HTMLFieldSetElement;
}

const knappar = () => [...grupp().querySelectorAll("button")].map((b) => b.textContent);
const knapp = (text: string) => [...grupp().querySelectorAll("button")].find((b) => b.textContent === text)!;

describe("bostadsdelsfragan i fas 2", () => {
  it("star efter namnet och fore fragetradet", async () => {
    await act(async () => rot.render(createElement(Fas2, { hogar: [HOG], upplatelseform: "bostadsratt" })));
    const namn = [...behallare.querySelectorAll("label span")].find((s) => s.textContent?.startsWith("Vad gjorde du?"))!;
    const del = grupp();
    const nasta = [...behallare.querySelectorAll("legend")].find((l) => l.textContent !== fragan())!;
    expect(namn.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(del.compareDocumentPosition(nasta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("en bostadsratt far bostadsrattens knappar, en fastighet aven husets", async () => {
    const { bostadsratt, fastighetPlus } = knapparIDesign();
    await act(async () => rot.render(createElement(BostadsdelFraga, { upplatelseform: "bostadsratt" })));
    expect(knappar()).toEqual(bostadsratt);
    await act(async () => rot.render(createElement(BostadsdelFraga, { upplatelseform: "fastighet" })));
    expect([...knappar()].sort()).toEqual([...bostadsratt, ...fastighetPlus].sort());
  });

  it("flerval, och Annat oppnar ett fritextfalt", async () => {
    await act(async () => rot.render(createElement("form", null, createElement(BostadsdelFraga, { upplatelseform: "bostadsratt" }))));
    expect(grupp().querySelector('input[type="text"]')).toBeNull();
    await act(async () => knapp("Kök").click());
    await act(async () => knapp("El").click());
    await act(async () => knapp("Annat").click());
    expect(knapp("Kök").getAttribute("aria-pressed")).toBe("true");
    expect(knapp("El").getAttribute("aria-pressed")).toBe("true");

    const fritext = grupp().querySelector<HTMLInputElement>('input[type="text"]')!;
    const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      satt.call(fritext, "Trappan");
      fritext.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Det formularet skickar, tolkat som servern tolkar det.
    const f = new FormData(behallare.querySelector("form")!);
    expect(tolkaBostadsdelar(f)).toEqual([
      { del: "KOK", fritext: null },
      { del: "EL", fritext: null },
      { del: "ANNAT", fritext: "Trappan" },
    ]);

    // Ett andra tryck tar bort valet.
    await act(async () => knapp("El").click());
    expect(knapp("El").getAttribute("aria-pressed")).toBe("false");
  });

  it("ett sparat svar som inte hor till formens knappar visas anda, sa att det inte tas bort tyst", async () => {
    await act(async () =>
      rot.render(
        createElement(BostadsdelFraga, {
          upplatelseform: "bostadsratt",
          initial: [{ del: "TAK", fritext: null }],
        }),
      ),
    );
    expect(knapp("Tak").getAttribute("aria-pressed")).toBe("true");
  });
});
