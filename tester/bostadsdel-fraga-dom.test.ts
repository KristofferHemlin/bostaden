// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "Vilken del av bostaden?", provat i en DOM (docs/design.md, "Vilken
// del av bostaden projektet rörde"): efter namnet, knappar per
// upplatelseform, flerval, och Annat som oppnar ett fritextfalt. Det formularet
// skickar ar det servern tolkar – raden i tester/bostadsdel.test.ts provar
// vad som sparas.

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BostadsdelFraga } from "@/app/projekt/bostadsdel-fraga";
import { tolkaBostadsdelar } from "@/doman/bostadsdel";
import { knapptabellen } from "./_bostadsdelar-design";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};

const design = () => readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");

function fragan(): string {
  const m = design().match(/Efter namnet kommer \*\*"([^"]+)"\*\*/);
  if (!m) throw new Error("design.md saknar fragan");
  return m[1];
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

/** Fragans faltgrupp, hittad pa sin rubrik. */
function grupp(): HTMLFieldSetElement {
  const legend = [...behallare.querySelectorAll("legend")].find((l) => l.textContent === fragan());
  if (!legend) throw new Error("fragan renderas inte");
  return legend.parentElement as HTMLFieldSetElement;
}

const knappar = () => [...grupp().querySelectorAll("button")].map((b) => b.textContent);

/** Knapparna under en rubrik, som hon läser dem: gruppen hittad på sin
 *  rubriks text, stannar om den saknas. */
function underRubrik(rubrik: string): string[] {
  const g = [...grupp().querySelectorAll('[role="group"]')].find(
    (e) => e.querySelector(`#${e.getAttribute("aria-labelledby")}`)?.textContent === rubrik,
  );
  if (!g) throw new Error(`ingen grupp under rubriken ${rubrik}`);
  return [...g.querySelectorAll("button")].map((b) => b.textContent!);
}
const knapp = (text: string) => [...grupp().querySelectorAll("button")].find((b) => b.textContent === text)!;

describe("bostadsdelsfragan", () => {
  // Att frågan står under namnet prövas där den står: projektflödets första
  // steg (tester/projekt-nytt-flode.test.ts) och delen Vad och var
  // (tester/projektsidan-i-delar.test.ts). Här stod till 2026-11-19 ett prov
  // av <FragetradetFalt> med bostadsdelen, en kombination ingen skärm längre
  // visar (docs/design.md, "Projektsidan ändras i delar").
  // docs/design.md, "Vad projektet rörde": knapparna under två rubriker,
  // Annat för sig under båda. Rubrikerna och knapparna ur tabellen.
  it("en bostadsratt far bostadsrattens knappar under två rubriker, en fastighet aven husets", async () => {
    const { rubriker, bostadsratt, fastighetPlus } = knapptabellen();
    await act(async () => rot.render(createElement(BostadsdelFraga, { upplatelseform: "bostadsratt" })));
    expect(underRubrik(rubriker[0])).toEqual(bostadsratt[0]);
    expect(underRubrik(rubriker[1])).toEqual(bostadsratt[1]);
    await act(async () => rot.render(createElement(BostadsdelFraga, { upplatelseform: "fastighet" })));
    expect(underRubrik(rubriker[0])).toEqual([...bostadsratt[0], ...fastighetPlus[0]]);
    expect(underRubrik(rubriker[1])).toEqual([...bostadsratt[1], ...fastighetPlus[1]]);
  });

  it("Annat står för sig, efter båda grupperna och i ingen av dem", async () => {
    const { rubriker } = knapptabellen();
    await act(async () => rot.render(createElement(BostadsdelFraga, { upplatelseform: "fastighet" })));
    expect(underRubrik(rubriker[0])).not.toContain("Annat");
    expect(underRubrik(rubriker[1])).not.toContain("Annat");
    expect(knappar().filter((t) => t === "Annat")).toHaveLength(1);
    const sista = [...grupp().querySelectorAll('[role="group"]')].at(-1)!;
    expect(sista.compareDocumentPosition(knapp("Annat")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    // Och under sin rubrik – grupperingen får inte göra svaret hemlöst.
    // Förutsättningen: en bostadsrätt har annars ingen Tak-knapp.
    const { rubriker, bostadsratt } = knapptabellen();
    expect(bostadsratt[1]).not.toContain("Tak");
    expect(underRubrik(rubriker[1])).toEqual([...bostadsratt[1], "Tak"]);
  });
});
