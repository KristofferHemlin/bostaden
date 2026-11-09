// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ingen knapp far skickas tva ganger (CLAUDE.md) – aven de tva bilagevagarna
// som inte ar formular och darfor saknade spärren:
//
//   - "Försök igen" efter en misslyckad uppladdning (kvittots detaljvy). Tva
//     korningar laddar upp samma fil tva ganger och skapar tva bilagerader.
//   - "Ta bort" pa en sparad bilaga i ett nytt kvitto. Ett andra anrop svarar
//     "Bilagan hittades inte." efter att borttagningen lyckats.
//
// Uppmatt 2026-11-09: med en rendering mellan trycken ar "Försök igen"
// redan borta ur DOM:en fore det andra, sa felet kraver tva tryck i samma
// uppgift – samma lucka som src/lib/dubbelinskick.ts beskriver, dar
// knappens nya lage nar DOM:en forst i en senare mikrouppgift. Testerna
// trycker darfor tva ganger utan att React hinner rendera emellan.

const h = vi.hoisted(() => ({
  laddaUpp: vi.fn(),
  taBortBilaga: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortBilagaAction: vi.fn(async () => ({})),
  taBortKostnad: vi.fn(async () => ({})),
  taBortUtkastRad: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: h.laddaUpp }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({})),
  taBortBilaga: h.taBortBilaga,
  begarBilagauppladdning: vi.fn(async () => ({})),
  bekraftaBilagauppladdning: vi.fn(async () => ({})),
}));
vi.mock("@/app/kostnad/nytt/actions", () => ({
  skapaUtkast: vi.fn(async () => ({})),
  sparaKostnad: vi.fn(async () => ({})),
}));

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Bilagor } from "@/app/kostnad/[id]/bilagor";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";

const satt = (v: boolean) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = v;
};
satt(true);

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.laddaUpp.mockReset();
  h.taBortBilaga.mockReset();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  satt(true);
  act(() => rot.unmount());
  behallare.remove();
});

async function rendera(element: ReactElement) {
  await act(async () => rot.render(element));
}

/** Soker i hela dokumentet: bekraftelsen renderas i en portal pa body. */
function knapp(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find((b) => b.textContent === text);
}

async function vantaPa(vad: string, finns: () => boolean) {
  for (let i = 0; i < 20 && !finns(); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  if (!finns()) throw new Error(`${vad} visades aldrig`);
}

/** Tva tryck i samma uppgift – utan att React hinner rendera emellan. */
async function tryckTvaGangerDirekt(element: HTMLButtonElement) {
  satt(false);
  element.click();
  element.click();
  satt(true);
  await act(async () => {});
}

describe("Försök igen efter en misslyckad uppladdning", () => {
  it("tva tryck startar en uppladdning, inte tva", async () => {
    // Forsta forsoket misslyckas, sa att "Försök igen" visas. Nasta blir
    // aldrig klart – det ska fortfarande pagaende nar det andra trycket kommer.
    h.laddaUpp.mockResolvedValueOnce({ ok: false, fel: "nätverket svarade inte." });
    h.laddaUpp.mockImplementation(() => new Promise(() => {}));
    await rendera(createElement(Bilagor, { kostnadId: "k1", bilagor: [], redigerbar: true }));
    const input = behallare.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("hittade inget filfalt");
    const fil = new File([new Uint8Array([0xff, 0xd8, 0xff])], "kvitto.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [fil], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await vantaPa("Försök igen", () => knapp("Försök igen") !== undefined);
    h.laddaUpp.mockClear();

    await tryckTvaGangerDirekt(knapp("Försök igen")!);
    expect(h.laddaUpp).toHaveBeenCalledTimes(1);
  });
});

describe("Ta bort pa en sparad bilaga i ett nytt kvitto", () => {
  it("tva tryck tar bort en gang, och inget falskt fel visas", async () => {
    let svara: (svar: { ok: boolean; fel?: string }) => void = () => {};
    h.taBortBilaga.mockImplementationOnce(() => new Promise((r) => (svara = r)));
    h.taBortBilaga.mockImplementation(async () => ({ ok: false, fel: "Bilagan hittades inte." }));
    await rendera(
      createElement(NyKostnadForm, {
        utkast: {
          id: "d0000000-0000-4000-8000-000000000001",
          anteckning: null,
          bilagor: [
            {
              id: "e0000000-0000-4000-8000-000000000001",
              filnamn: "kvitto.jpg",
              arPdf: false,
              arBild: true,
              analyserad: true,
              sidantal: null,
              bredd: null,
              hojd: null,
            },
          ],
        },
        bostad: { id: "b0000000-0000-4000-8000-00000000000a", namn: null },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
      }),
    );
    const kryss = behallare.querySelector<HTMLButtonElement>('button[aria-label="Ta bort kvitto.jpg"]');
    if (!kryss) throw new Error("hittade inget kryss pa den sparade bilagan");
    await act(async () => kryss.click());
    await vantaPa("bekraftelsen", () => knapp("Ta bort") !== undefined);

    await tryckTvaGangerDirekt(knapp("Ta bort")!);
    expect(h.taBortBilaga).toHaveBeenCalledTimes(1);

    await act(async () => svara({ ok: true }));
    expect(document.body.textContent).not.toContain("Bilagan hittades inte.");
  });
});
