// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Den valda bilagan på kvittots sida (uppräkningen 2026-11-24): vilken bilaga
// som visas stort bars bara av en ring. Miniatyrerna i inmatningen har
// aria-pressed; nu har kvittots sida det också. Utan stor förhandsvisning
// öppnar miniatyren en vy och är ingen växel – då inget aria-pressed.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortBilagaAction: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({})),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Bilagor } from "@/app/kostnad/[id]/bilagor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const bilaga = (id: string, filnamn: string) => ({
  id, filnamn, arPdf: false, arBild: true, analyserad: true, sidantal: null, bredd: null, hojd: null,
});
const BILAGOR = [
  bilaga("e0000000-0000-4000-8000-000000000001", "sida-1.jpg"),
  bilaga("e0000000-0000-4000-8000-000000000002", "sida-2.jpg"),
];

const miniatyr = (namn: string) => {
  const k = behallare.querySelector<HTMLButtonElement>(`button[title="${namn}"]`);
  if (!k) throw new Error(`miniatyren för ${namn} finns inte`);
  return k;
};

describe("den valda bilagan är märkt, inte bara inringad", () => {
  it("med stor förhandsvisning: den som visas är nedtryckt, och valet följer trycket", async () => {
    await act(async () => rot.render(createElement(Bilagor, { kostnadId: "k1", bilagor: BILAGOR, storForhandsvisning: true, redigerbar: false })));
    expect([miniatyr("sida-1.jpg"), miniatyr("sida-2.jpg")].map((k) => k.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    await act(async () => miniatyr("sida-2.jpg").click());
    expect([miniatyr("sida-1.jpg"), miniatyr("sida-2.jpg")].map((k) => k.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
  });

  it("utan stor förhandsvisning öppnar miniatyren en vy – ingen växel, inget aria-pressed", async () => {
    await act(async () => rot.render(createElement(Bilagor, { kostnadId: "k1", bilagor: BILAGOR, redigerbar: false })));
    expect(miniatyr("sida-1.jpg").hasAttribute("aria-pressed")).toBe(false);
  });
});
