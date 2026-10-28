// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Inbjudningssteget i kortet Tillgang, provat i en DOM (CLAUDE.md, "Andelen ar
// null tills den besvarats"). Utgangslaget for den som inte angett sin andel
// ar tva tomma falt – inte tva hundratal – och inget av dem visar ett fel pa
// ett startvarde anvandaren inte skrivit. Till 2026-10-28 borjade det egna
// faltet pa "100", och efter att forvalet togs bort hade det borjat pa "0"
// med felet "kan inte vara noll" redan innan nagon rort det.

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: vi.fn(async () => ({})),
  aterkallaInbjudanAction: vi.fn(async () => ({})),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TillgangKort, type TillgangData } from "@/app/installningar/dela-bostaden";
import { ANDEL_SAKNAS } from "@/lib/agarandel";

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

async function oppnaSteget(data: TillgangData) {
  await act(async () => rot.render(createElement(TillgangKort, { data })));
  const knapp = (text: string) =>
    [...behallare.querySelectorAll("button")].find((b) => b.textContent === text)!;
  await act(async () => knapp("Bjud in någon till bostaden").click());
  await act(async () => knapp("Fortsätt").click());
}

const falt = (namn: string) => behallare.querySelector<HTMLInputElement>(`input[name="${namn}"]`)!;
const fel = () => [...behallare.querySelectorAll('[role="alert"]')].map((e) => e.textContent);

async function tom(input: HTMLInputElement) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(input, "5");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    satt.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("inbjudningssteget nar den egna andelen inte ar angiven", () => {
  it("borjar med tva tomma falt och inget fel", async () => {
    await oppnaSteget({ medlemmar: [{ epost: "anna@exempel.se", du: true, andel: null }], inbjudningar: [] });
    expect(falt("egen_andel").value).toBe("");
    expect(falt("inbjuden_andel").value).toBe("");
    expect(fel()).toEqual([]);
  });

  it("ett falt som tomts av anvandaren visar felet", async () => {
    await oppnaSteget({ medlemmar: [{ epost: "anna@exempel.se", du: true, andel: null }], inbjudningar: [] });
    await tom(falt("egen_andel"));
    expect(fel()).toEqual([ANDEL_SAKNAS]);
  });
});

describe("inbjudningssteget nar den egna andelen ar angiven", () => {
  it("borjar pa den angivna andelen", async () => {
    await oppnaSteget({ medlemmar: [{ epost: "anna@exempel.se", du: true, andel: 33.33 }], inbjudningar: [] });
    expect(falt("egen_andel").value).toBe("33,33");
    expect(falt("inbjuden_andel").value).toBe("");
    expect(fel()).toEqual([]);
  });
});
