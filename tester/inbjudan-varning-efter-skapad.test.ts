// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Texten om vad den inbjudna ser ar en upplysning FORE ett beslut, och
// forsvinner nar inbjudan ar skapad (docs/design.md, "Att bjuda in en
// delägare": "Och den försvinner när inbjudan är skapad"). Nar QR-koden
// visas ar beslutet fattat. Galler bada stallena: kortet Tillgang och
// erbjudandet efter andelsfragan pa startsidan.

const h = vi.hoisted(() => ({
  skapa: vi.fn(async () => ({
    ok: true as const,
    lank: "https://bostad.test/inbjudan/e0000000-0000-4000-8000-0000000000d1",
    qrSvg: "<svg data-qr></svg>",
    epost: "bertil@exempel.se",
    harKonto: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: h.skapa,
  aterkallaInbjudanAction: vi.fn(async () => ({})),
  visaInbjudanAction: vi.fn(async () => ({})),
}));
vi.mock("@/app/bostaden/actions", () => ({}));

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { INBJUDAN_SER_ALLT, TillgangKort } from "@/app/installningar/dela-bostaden";
import { Inbjudningserbjudande } from "@/app/bostaden/formular";

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

const knapp = (text: string) => {
  const b = [...behallare.querySelectorAll("button")].find((e) => e.textContent === text);
  if (!b) throw new Error(`hittade ingen knapp "${text}"`);
  return b;
};
const varningenSyns = () => [...behallare.querySelectorAll("p")].some((p) => p.textContent === INBJUDAN_SER_ALLT);

async function skapaInbjudan() {
  await act(async () => knapp("Skapa inbjudan").click());
  for (let i = 0; i < 20 && !behallare.querySelector("[data-qr]"); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  if (!behallare.querySelector("[data-qr]")) throw new Error("QR-koden visades inte efter en skapad inbjudan");
}

const STALLEN: [string, () => ReactElement, () => Promise<void>][] = [
  [
    "kortet Tillgang",
    () =>
      createElement(TillgangKort, {
        data: { medlemmar: [{ epost: "anna@exempel.se", du: true, andel: 50 }], inbjudningar: [] },
      }),
    async () => act(async () => knapp("Bjud in någon till bostaden").click()),
  ],
  [
    "erbjudandet pa startsidan",
    () => createElement(Inbjudningserbjudande, { egenAndel: 50, dit: "/" }),
    async () => {},
  ],
];

describe.each(STALLEN)("varningstexten i %s", (_namn, element, oppna) => {
  it("star ovanfor falten innan inbjudan ar skapad", async () => {
    await act(async () => rot.render(element()));
    await oppna();
    expect(varningenSyns()).toBe(true);
  });

  it("ar borta nar QR-koden visas", async () => {
    await act(async () => rot.render(element()));
    await oppna();
    await skapaInbjudan();
    expect(h.skapa).toHaveBeenCalledTimes(1);
    expect(varningenSyns()).toBe(false);
  });
});
