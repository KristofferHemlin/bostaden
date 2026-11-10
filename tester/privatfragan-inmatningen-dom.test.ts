// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Privatfaltet i inmatningen, matt och inte last (CLAUDE.md, "En rapport
// skiljer pa vad som ar matt och vad som ar last"). Tva saker som en
// genomlasning av formularet sa skulle galla aven det nya faltet:
//
//   - Avvisar servern star det hon skrev kvar i rutan (docs/design.md, "När
//     ett formulär vägrar"). React 19 nollstaller okontrollerade falt i ett
//     <form action>, och ett falt som "foljer samma vag" ar ett antagande
//     tills nagon kort det.
//   - Tva tryck pa Spara skapar ett kvitto, inte tva (CLAUDE.md, "Ingen knapp
//     får skickas två gånger"). Tva kvitton pa samma belopp ger dubbla
//     siffror i underlaget.
//
// Formularet fylls i som en anvandare gor det – belopp, datum, leverantor och
// privatfragan – och skickas med knappen. Ingen bilaga, sa forsta trycket
// stannar vid "Inget kvitto bifogat" och gar vidare med "Spara ändå".

const h = vi.hoisted(() => ({ sparaKostnad: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  taBortKostnad: vi.fn(async () => ({})),
  taBortBilagaAction: vi.fn(async () => ({})),
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortUtkastRad: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({})),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/kostnad/nytt/actions", () => ({
  skapaUtkast: vi.fn(async () => ({})),
  sparaKostnad: h.sparaKostnad,
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";
import { formateraBeloppInmatning } from "@/lib/format";

const satt = (v: boolean) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = v;
};
satt(true);

// Det faltet visar nar hon skrivit 1000 – samma formaterare som faltet.
const SKRIVET = formateraBeloppInmatning("1000");

const AVVISNING = "Privatbeloppet måste vara mindre än kvittots totalbelopp.";

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(async () => {
  h.sparaKostnad.mockReset();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () =>
    rot.render(
      createElement(NyKostnadForm, {
        bostad: { id: "b0000000-0000-4000-8000-00000000000a", namn: null },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
      }),
    ),
  );
});

afterEach(() => {
  satt(true);
  act(() => rot.unmount());
  behallare.remove();
});

/** Soker i hela dokumentet: fragan om bilagan renderas i en portal pa body. */
function knapp(text: string): HTMLButtonElement {
  const k = [...document.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!k) throw new Error(`hittade ingen knapp "${text}"`);
  return k;
}

function falt(selektor: string): HTMLInputElement {
  const f = behallare.querySelector<HTMLInputElement>(selektor);
  if (!f) throw new Error(`hittade inget falt ${selektor}`);
  return f;
}

/** Skriver som en anvandare: Reacts egen vardesattare och ett input-event. */
async function skriv(selektor: string, text: string) {
  const f = falt(selektor);
  const sattare = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    sattare.call(f, text);
    f.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fyllIKvittot() {
  await skriv('input[name="totalbelopp"]', "10000");
  await skriv('input[aria-label="År"]', "2026");
  await skriv('input[aria-label="Månad"]', "05");
  await skriv('input[aria-label="Dag"]', "01");
  await skriv('input[name="leverantor"]', "Bauhaus");
  await act(async () => knapp("Var något på kvittot privat?").click());
  await skriv('input[name="privatbelopp"]', "1000");
}

/** Forsta trycket: Spara kvitto, sedan "Spara ändå" i fragan om bilagan. */
async function sparaForstaGangen() {
  await act(async () => knapp("Spara kvitto").click());
  await act(async () => knapp("Spara ändå").click());
}

describe("privatfältet när servern avvisar", () => {
  it("beloppet står kvar i rutan, och felet står vid den", async () => {
    h.sparaKostnad.mockResolvedValue({ fel: AVVISNING, falt: "privatbelopp" });
    await fyllIKvittot();
    const skrivet = falt('input[name="privatbelopp"]').value;
    expect(skrivet).toBe(SKRIVET);

    await sparaForstaGangen();

    // Servern fick faltet – annars hade det inte provats.
    expect(h.sparaKostnad).toHaveBeenCalledTimes(1);
    const skickat = h.sparaKostnad.mock.calls[0][0] as FormData;
    expect(skickat.get("privatbelopp")).toBe(skrivet);

    const efter = falt('input[name="privatbelopp"]');
    expect(efter.value).toBe(skrivet);
    const fel = efter.closest("label")?.querySelector('[role="alert"]');
    expect(fel?.textContent).toBe(AVVISNING);
  });
});

describe("två tryck på Spara med ett privat belopp", () => {
  it("skickar ett kvitto, inte två", async () => {
    // Forsta sparningen avvisas, sa att fragan om bilagan ar besvarad och
    // nasta tryck pa Spara kvitto gar rakt till servern.
    h.sparaKostnad.mockResolvedValueOnce({ fel: AVVISNING, falt: "privatbelopp" });
    await fyllIKvittot();
    await sparaForstaGangen();
    h.sparaKostnad.mockClear();
    // Sparningen blir aldrig klar – den pagar nar det andra trycket kommer.
    h.sparaKostnad.mockImplementation(() => new Promise(() => {}));

    // Tva tryck i samma uppgift, utan att React hinner rendera emellan: da
    // ar knappen fortfarande tillganglig i DOM:en (src/lib/dubbelinskick.ts).
    const spara = knapp("Spara kvitto");
    satt(false);
    spara.click();
    spara.click();
    satt(true);
    await act(async () => {});

    expect(h.sparaKostnad).toHaveBeenCalledTimes(1);
    const skickat = h.sparaKostnad.mock.calls[0][0] as FormData;
    expect(skickat.get("privatbelopp")).toBe(SKRIVET);
  });
});
