// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Forslagen i fas 1, provade i en DOM. Uppmatt av den forsta riktiga
// anvandaren 2026-11-09: tva forslag att lagga ihop kvitton visades, hon
// tryckte pa det enas knapp och BADA gick in i vantlage, fast bara det ena
// sparades. Vantlaget hor till raden som skickades, inte till listan.

const h = vi.hoisted(() => ({
  // Sparandet blir aldrig klart – vantlaget ska synas medan det pagar.
  skapaHog: vi.fn((_foregaende: unknown, _fd: FormData) => new Promise<never>(() => {})),
}));

vi.mock("@/app/genomgang/actions", () => ({
  skapaHog: h.skapaHog,
  laggIHog: vi.fn(),
  flyttaUturHog: vi.fn(),
  raknasInte: vi.fn(),
  aterforFranRaknasInte: vi.fn(),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Fas1 } from "@/app/genomgang/fas1";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const kvitto = (id: string, anteckning: string) => ({
  id,
  leverantor: "BAUHAUS",
  anteckning,
  belopp: 465_800,
  datum: "2026-08-14",
});

const OKLASSIFICERADE = [
  kvitto("k1", "Färg till sovrummet"),
  kvitto("k2", "Penslar till sovrummet"),
  kvitto("k3", "Kakel till badrummet"),
  kvitto("k4", "Fog till badrummet"),
];

const FORSLAG = [
  { kvitto_ider: ["k1", "k2"], motiv: "Samma dag hos BAUHAUS" },
  { kvitto_ider: ["k3", "k4"], motiv: "Samma vecka hos BAUHAUS" },
];

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(async () => {
  h.skapaHog.mockClear();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () =>
    rot.render(
      createElement(Fas1, {
        oklassificerade: OKLASSIFICERADE,
        hogar: [],
        raknasInte: [],
        forslag: FORSLAG,
      }),
    ),
  );
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

/** Forslagets knapp, hittad via forslagets motiv – texten anvandaren laser. */
function forslagetsKnapp(motiv: string): HTMLButtonElement {
  const p = [...behallare.querySelectorAll("p")].find((e) => e.textContent === motiv);
  if (!p) throw new Error(`hittade inget forslag med motivet "${motiv}"`);
  const knapp = p.parentElement?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!knapp) throw new Error(`forslaget "${motiv}" har ingen skicka-knapp`);
  return knapp;
}

describe("vantlaget pa forslagen i fas 1", () => {
  it("bara forslaget som skickades ar i vantlage", async () => {
    const forsta = forslagetsKnapp("Samma dag hos BAUHAUS");
    const andra = forslagetsKnapp("Samma vecka hos BAUHAUS");
    expect(forsta.textContent).toBe("Ja, lägg ihop");
    expect(andra.textContent).toBe("Ja, lägg ihop");

    await act(async () => forsta.click());

    expect(h.skapaHog).toHaveBeenCalledTimes(1);
    expect(forslagetsKnapp("Samma dag hos BAUHAUS").textContent).toBe("Sparar…");
    expect(forslagetsKnapp("Samma dag hos BAUHAUS").disabled).toBe(true);
    expect(forslagetsKnapp("Samma vecka hos BAUHAUS").textContent).toBe("Ja, lägg ihop");
    expect(forslagetsKnapp("Samma vecka hos BAUHAUS").disabled).toBe(false);
  });

  it("det som skickades ar forslagets egna kvitton", async () => {
    await act(async () => forslagetsKnapp("Samma vecka hos BAUHAUS").click());
    const fd = h.skapaHog.mock.calls[0]?.[1];
    if (!fd) throw new Error("skapaHog anropades inte med ett formular");
    expect(fd.getAll("kostnad_ider")).toEqual(["k3", "k4"]);
  });
});
