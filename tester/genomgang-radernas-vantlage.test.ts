// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fas 1:s listor dar varje rad har en egen knapp: Flytta ut, Lägg N valda
// här och Ta tillbaka. Varje rad har ett eget tillstand – vantlaget,
// sparren och felet hor till raden, inte till listan (docs/design.md, "När
// ett formulär vägrar"). Till 2026-11-09 delade varje lista en enda
// useActionState i Fas1. Samma fel som pa forslagen, se
// tester/genomgang-forslag-vantlage.test.ts.

const h = vi.hoisted(() => {
  // Sparandet blir inte klart forran testet ar slut – vantlaget ska synas
  // medan det pagar. Det slapps i afterEach: React haller ihop alla pagaende
  // asynkrona actions, och ett sparande som aldrig blir klart haller annars
  // kvar uppdateringarna i nasta test.
  const slapp: (() => void)[] = [];
  const aldrigKlar = (_foregaende: unknown, _fd: FormData) =>
    new Promise<object>((r) => slapp.push(() => r({})));
  return {
    slapp,
    aldrigKlar,
    flyttaUturHog: vi.fn(aldrigKlar),
    laggIHog: vi.fn(aldrigKlar),
    aterforFranRaknasInte: vi.fn(aldrigKlar),
    // Svarar med ett fel – for att prova att felet star vid raden.
    felSvar: { fel: "Kvittot gick inte att flytta. Försök igen." },
  };
});

vi.mock("@/app/genomgang/actions", () => ({
  skapaHog: vi.fn(),
  laggIHog: h.laggIHog,
  flyttaUturHog: h.flyttaUturHog,
  raknasInte: vi.fn(),
  aterforFranRaknasInte: h.aterforFranRaknasInte,
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Fas1, laggValdaHarText } from "@/app/genomgang/fas1";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const kvitto = (id: string, anteckning: string) => ({
  id,
  leverantor: "BAUHAUS",
  anteckning,
  belopp: 465_800,
  datum: "2026-08-14",
});

const PROPS = {
  oklassificerade: [kvitto("k1", "Lister till hallen")],
  hogar: [
    { id: "h1", kvitton: [kvitto("k2", "Färg till sovrummet"), kvitto("k3", "Penslar till sovrummet")] },
    { id: "h2", kvitton: [kvitto("k4", "Kakel till badrummet")] },
  ],
  raknasInte: [kvitto("k5", "Blommor till balkongen"), kvitto("k6", "Grillkol")],
  forslag: [],
};

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(async () => {
  h.flyttaUturHog.mockReset().mockImplementation(h.aldrigKlar);
  h.laggIHog.mockReset().mockImplementation(h.aldrigKlar);
  h.aterforFranRaknasInte.mockReset().mockImplementation(h.aldrigKlar);
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(createElement(Fas1, PROPS)));
});

afterEach(async () => {
  await act(async () => {
    for (const r of h.slapp.splice(0)) r();
  });
  act(() => rot.unmount());
  behallare.remove();
});

/** Raden (li) dar kvittots rubrik star – texten anvandaren laser. */
function raden(rubrik: string): HTMLLIElement {
  const span = [...behallare.querySelectorAll("li span")].find((e) => e.textContent === rubrik);
  const li = span?.closest("li");
  if (!li) throw new Error(`hittade ingen rad med rubriken "${rubrik}"`);
  return li;
}

/** Radens skicka-knapp. */
function radensKnapp(rubrik: string): HTMLButtonElement {
  const knapp = raden(rubrik).querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!knapp) throw new Error(`raden "${rubrik}" har ingen skicka-knapp`);
  return knapp;
}

/** Hogens knapp "Lägg N valda här", hittad via ett kvitto i hogen. */
function hogensLaggKnapp(kvittoIHogen: string, text: string): HTMLButtonElement {
  const hog = raden(kvittoIHogen).closest("ul")?.parentElement;
  if (!hog) throw new Error(`hittade ingen hog med "${kvittoIHogen}"`);
  const knapp = [...hog.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].find(
    (b) => b.textContent === text,
  );
  if (!knapp) throw new Error(`hogen med "${kvittoIHogen}" har ingen knapp "${text}"`);
  return knapp;
}

async function valj(rubrik: string) {
  const ruta = raden(rubrik).querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!ruta) throw new Error(`raden "${rubrik}" har ingen kryssruta`);
  await act(async () => ruta.click());
}

describe("Flytta ut", () => {
  it("bara raden som skickades ar i vantlage, aven i en annan hog", async () => {
    await act(async () => radensKnapp("Färg till sovrummet").click());
    expect(h.flyttaUturHog).toHaveBeenCalledTimes(1);
    // En avstangd knapp utan ord ser ut som en knapp som slutat fungera
    // (uppmatt pa skarmen 2026-11-09) – den sager vad som hander.
    expect(radensKnapp("Färg till sovrummet").textContent).toBe("Flyttar ut…");
    expect(radensKnapp("Färg till sovrummet").disabled).toBe(true);
    expect(radensKnapp("Penslar till sovrummet").textContent).toBe("Flytta ut");
    expect(radensKnapp("Penslar till sovrummet").disabled).toBe(false);
    expect(radensKnapp("Kakel till badrummet").textContent).toBe("Flytta ut");
    expect(radensKnapp("Kakel till badrummet").disabled).toBe(false);
  });

  it("felet star i raden som gick fel, inte overst", async () => {
    h.flyttaUturHog.mockImplementation(async () => h.felSvar);
    await act(async () => radensKnapp("Penslar till sovrummet").click());
    // Svaret kommer nagra varv efter klicket. Visas inget fel alls faller
    // testet med besked, i stallet for att paståendet nedan provar en tom lista.
    for (let i = 0; i < 20 && !behallare.querySelector('[role="alert"]'); i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
    if (!behallare.querySelector('[role="alert"]')) throw new Error("inget fel visades efter svaret");
    const fel = [...behallare.querySelectorAll('[role="alert"]')];
    expect(fel.map((e) => e.textContent)).toEqual([h.felSvar.fel]);
    expect(raden("Penslar till sovrummet").contains(fel[0]!)).toBe(true);
  });
});

describe("Lägg N valda här", () => {
  it("bara hogen som skickades ar i vantlage", async () => {
    await valj("Lister till hallen");
    const text = laggValdaHarText(1);
    await act(async () => hogensLaggKnapp("Färg till sovrummet", text).click());
    expect(h.laggIHog).toHaveBeenCalledTimes(1);
    expect(hogensLaggKnapp("Färg till sovrummet", "Lägger till…").disabled).toBe(true);
    expect(hogensLaggKnapp("Kakel till badrummet", text).disabled).toBe(false);
  });
});

describe("Ta tillbaka", () => {
  async function oppna() {
    const knapp = [...behallare.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Hör inte till bostaden ("),
    );
    if (!knapp) throw new Error("hittade inte knappen som visar Hör inte till bostaden");
    await act(async () => knapp.click());
  }

  it("bara raden som skickades ar i vantlage", async () => {
    await oppna();
    await act(async () => radensKnapp("Blommor till balkongen").click());
    expect(h.aterforFranRaknasInte).toHaveBeenCalledTimes(1);
    expect(radensKnapp("Blommor till balkongen").textContent).toBe("Tar tillbaka…");
    expect(radensKnapp("Blommor till balkongen").disabled).toBe(true);
    expect(radensKnapp("Grillkol").textContent).toBe("Ta tillbaka");
    expect(radensKnapp("Grillkol").disabled).toBe(false);
  });
});
