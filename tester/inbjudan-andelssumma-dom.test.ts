// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Summan av andelarna vid inbjudan (docs/design.md, "Summan av andelarna får
// inte överstiga 100 %"; CLAUDE.md, "Ett besked som bara bärs av en färg finns
// inte"). Uppmätt i produktionen 2026-11-24: 50 + 60 gav ett rött tal och
// ingenting annat – ingen mening, inget aria-invalid, och knappen tänd.
//
// Tre lager i webbläsaren, prövade vart för sig: en mening vid fältet, fältet
// märkt ogiltigt, och en inbjudan som inte går att skapa. Det fjärde – att
// servern vägrar – prövas i tester/inbjudan.test.ts mot den falska databasen.
//
// Meningens lydelse vaktas inte här: den är serverns (andelssummaVidInbjudan)
// tills en lydelse står i design.md. Provet kräver att meningen säger summan.

const h = vi.hoisted(() => ({ skapa: vi.fn(async () => ({})) }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: h.skapa,
  aterkallaInbjudanAction: vi.fn(async () => ({})),
  visaInbjudanAction: vi.fn(async () => ({})),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SkapaInbjudan } from "@/app/installningar/dela-bostaden";
import { formateraAndel } from "@/lib/samagande";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.skapa.mockClear();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

const falt = (namn: string) => {
  const f = behallare.querySelector<HTMLInputElement>(`input[name="${namn}"]`);
  if (!f) throw new Error(`fältet ${namn} finns inte`);
  return f;
};
const knappen = () => {
  const k = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Skapa inbjudan");
  if (!k) throw new Error("knappen Skapa inbjudan finns inte");
  return k;
};
const larm = () => [...behallare.querySelectorAll('[role="alert"]')].map((e) => e.textContent ?? "");

async function skriv(input: HTMLInputElement, varde: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(input, varde);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function formularet({ egen, inbjuden, ovriga = [] }: { egen: string; inbjuden: string; ovriga?: (number | null)[] }) {
  await act(async () =>
    rot.render(createElement(SkapaInbjudan, { egenAndel: null, ovriga, onKlar: () => {} })),
  );
  await skriv(falt("epost"), "doris@exempel.se");
  await skriv(falt("egen_andel"), egen);
  await skriv(falt("inbjuden_andel"), inbjuden);
}

/** Meningen fältet pekar på via aria-describedby, eller null. */
function meningenVidFaltet(input: HTMLInputElement): string | null {
  const id = input.getAttribute("aria-describedby");
  if (!id) return null;
  const el = document.getElementById(id);
  if (!el) throw new Error(`aria-describedby pekar på ${id}, som inte finns`);
  return mellanslag(el.textContent ?? "");
}

/** Hårt och vanligt mellanslag är samma sak för den som läser. Serverns mening
 *  har i dag båda: formateraAndel ger ett hårt, "100 %" i texten ett vanligt. */
const mellanslag = (t: string) => t.replace(/\u00a0/g, " ");

async function skicka() {
  const form = falt("epost").form!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("50 + 60: summan över 100 %", () => {
  it("1. en mening vid fältet säger summan och taket, i ord", async () => {
    await formularet({ egen: "50", inbjuden: "60" });
    const mening = meningenVidFaltet(falt("inbjuden_andel"));
    expect(mening, "fältet pekar på en mening").not.toBeNull();
    expect(mening).toContain(mellanslag(formateraAndel(110)));
    expect(mening).toContain(mellanslag(formateraAndel(100)));
    expect(larm().map(mellanslag)).toContain(mening);
  });

  it("2. fältet är märkt ogiltigt", async () => {
    await formularet({ egen: "50", inbjuden: "60" });
    expect(falt("inbjuden_andel").getAttribute("aria-invalid")).toBe("true");
  });

  it("3. knappen är avstängd, och ett inskick når inte servern", async () => {
    await formularet({ egen: "50", inbjuden: "60" });
    expect(knappen().disabled).toBe(true);
    await skicka();
    expect(h.skapa).not.toHaveBeenCalled();
  });

  it("övrigas andelar räknas med: 50 tagna, 30 + 30 är också för mycket", async () => {
    await formularet({ egen: "30", inbjuden: "30", ovriga: [50] });
    expect(falt("inbjuden_andel").getAttribute("aria-invalid")).toBe("true");
    expect(meningenVidFaltet(falt("inbjuden_andel"))).toContain(mellanslag(formateraAndel(110)));
    expect(knappen().disabled).toBe(true);
  });
});

// Motprovet: samma formulär med en summa som går ihop. Utan det säger proven
// ovan inte om det var summan eller något annat som bar utfallet.
describe("under taket är tillåtet och vanligt", () => {
  for (const [egen, inbjuden, summa] of [["50", "50", 100], ["30", "20", 50]] as const) {
    it(`${egen} + ${inbjuden} = ${summa} %: ingen mening, inget ogiltigt fält, knappen skickar`, async () => {
      await formularet({ egen, inbjuden });
      expect(falt("inbjuden_andel").hasAttribute("aria-invalid")).toBe(false);
      expect(meningenVidFaltet(falt("inbjuden_andel"))).toBeNull();
      expect(larm()).toEqual([]);
      expect(knappen().disabled).toBe(false);
      await skicka();
      expect(h.skapa).toHaveBeenCalledOnce();
    });
  }
});
