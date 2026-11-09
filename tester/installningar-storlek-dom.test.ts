// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Det hon skrev star kvar nar storleken avvisas (docs/design.md,
// "Inställningssidan": "Och det hon skrev står kvar när fältet avvisar").
// Uppmatt i produktionen 2026-11-09: skriv 72,5, tryck Spara – beskedet kom,
// men faltet visade det lagrade vardet igen.

const h = vi.hoisted(() => ({
  sparaBostaden: vi.fn(async (_f: unknown, _fd: FormData) => ({
    fel: "Fel i storleken.",
    falt: "storlek" as const,
  })),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/installningar",
}));
vi.mock("@/app/installningar/actions", () => ({
  sparaBostaden: h.sparaBostaden,
  sparaForvarvet: vi.fn(async () => ({})),
}));

import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BostadenKort, type BostadenData } from "@/app/installningar/kort";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DATA: BostadenData = {
  adress: "Storgatan 1",
  ort: "Umeå",
  platsId: "",
  lat: "",
  lng: "",
  upplatelseform: "fastighet",
  identifiering: "",
  storlek: "36",
  kapitaltillskottOren: null,
  sald: false,
};

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(async () => {
  h.sparaBostaden.mockClear();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () =>
    rot.render(
      createElement(BostadenKort, {
        data: DATA,
        oppen: true,
        formRef: createRef<HTMLFormElement>(),
        onAndra: () => {},
        onAvbryt: () => {},
        onDirty: () => {},
        onKlar: () => {},
      }),
    ),
  );
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

function storleken(): HTMLInputElement {
  const falt = behallare.querySelector<HTMLInputElement>('input[name="storlek"]');
  if (!falt) throw new Error("kortet har inget storleksfalt");
  return falt;
}

async function skriv(falt: HTMLInputElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt, text);
    falt.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function spara() {
  const knapp = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Spara");
  if (!knapp) throw new Error("kortet har ingen knapp Spara");
  await act(async () => knapp.click());
  for (let i = 0; i < 20 && !behallare.querySelector('[role="alert"], [aria-invalid="true"]'); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe("storleken avvisas och det inskrivna star kvar", () => {
  it("faltet visar det hon skrev, inte det lagrade vardet", async () => {
    await skriv(storleken(), "35,23");
    await spara();
    expect(h.sparaBostaden).toHaveBeenCalledTimes(1);
    expect(behallare.textContent).toContain("Fel i storleken.");
    expect(storleken().value).toBe("35,23");
  });

  // Nollstallningen ar Reacts, efter varje action pa formularet – den tar
  // aven falt som inte hade nagot fel (src/lib/skicka-utan-nollstallning.ts).
  it("de andra falten i kortet behaller ocksa det hon skrev", async () => {
    const identifiering = behallare.querySelector<HTMLInputElement>('input[name="identifiering"]');
    if (!identifiering) throw new Error("kortet har inget falt for identifieringen");
    await skriv(identifiering, "Umeå Tallen 4:2");
    await skriv(storleken(), "35,23");
    await spara();
    expect(h.sparaBostaden).toHaveBeenCalledTimes(1);
    expect(behallare.querySelector<HTMLInputElement>('input[name="identifiering"]')!.value).toBe("Umeå Tallen 4:2");
  });
});
