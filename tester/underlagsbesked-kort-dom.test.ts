// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Beskedet i kortet Förvärvet, renderat (docs/design.md, "Beskedet när ett
// värde ändrar vilka kvitton som räknas"). Serverprovet
// (tester/underlagsbesked.test.ts) prövar talet; det här prövar det som bara
// syns i kortet:
//
//   * ett besked är inget sparande – kortet står kvar öppet
//   * det hon skrev står kvar när beskedet kommer. Formuläret skickas via
//     action-propen, och React nollställer då okontrollerade fält när
//     actionen är klar – kortets fält är kontrollerade och står kvar, och
//     provet visar det. Brutet 2026-11-24: ett byte till inskick från
//     onSubmit fällde inget, eftersom inget fält i kortet tappar sitt värde.
//   * "Spara ändå" skickar samma värden igen, med bekräftelsen
//   * "Avbryt" stänger rutan och skickar ingenting
//
// Serverfunktionen är en attrapp: första anropet svarar med ett besked,
// andra med att det sparades.

const h = vi.hoisted(() => ({ sparaForvarvet: vi.fn() }));

vi.mock("@/app/installningar/actions", () => ({
  sparaBostaden: vi.fn(async () => ({})),
  sparaForvarvet: h.sparaForvarvet,
}));
vi.mock("@/app/installningar/arkivexport-actions", () => ({ hamtaArkivexportlista: vi.fn() }));
vi.mock("@/app/login/actions", () => ({ loggaUt: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => "/installningar",
  useSearchParams: () => new URLSearchParams(),
}));

import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ForvarvetKort } from "@/app/installningar/kort";
import { BEKRAFTAD_ANDRING, UNDERLAGSBESKED_AVBRYT, UNDERLAGSBESKED_RUBRIK, UNDERLAGSBESKED_SPARA, type Underlagsbesked } from "@/lib/underlagsbesked";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BESKED: Underlagsbesked = {
  summor: [{ sida: 1, fore: 1_600_000, efter: 1_000_000 }],
  kvittonUtanforInnehavet: 1,
  kvittonInnanforInnehavet: 0,
  arUnderTroskeln: { antal: 1, troskelbelopp: 500_000 },
  arOverTroskeln: null,
  bostadsfragorNollstalls: false,
  bekraftelse: '[["tilltradesdatum","2020-06-01"]]',
};

let behallare: HTMLDivElement;
let rot: Root;
const onKlar = vi.fn();

beforeEach(() => {
  h.sparaForvarvet.mockReset();
  h.sparaForvarvet.mockResolvedValueOnce({ underlag: BESKED }).mockResolvedValueOnce({});
  onKlar.mockReset();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  document.body.innerHTML = "";
});

async function oppnaKortet() {
  await act(async () =>
    rot.render(
      createElement(ForvarvetKort, {
        data: {
          tilltradesdatum: "2019-06-01",
          kopeskillingOren: null,
          kopkostnaderOren: null,
          arBostadsratt: false,
          agarandelProcent: 100,
          bostadsfragor: { upplatelseform: "fastighet", forstaAgare: false, ombildning: null },
        },
        oppen: true,
        formRef: createRef<HTMLFormElement>(),
        onAndra: () => {},
        onAvbryt: () => {},
        onDirty: () => {},
        onKlar,
      }),
    ),
  );
}

async function skrivAr(ar: string) {
  const falt = [...behallare.querySelectorAll<HTMLInputElement>("input")].find((i) => i.placeholder === "ÅÅÅÅ");
  if (!falt) throw new Error("årsrutan i tillträdesdatumet finns inte");
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt, ar);
    falt.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function vanta() {
  for (let i = 0; i < 10; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
}

async function spara() {
  const knapp = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Spara");
  if (!knapp) throw new Error("knappen Spara finns inte");
  await act(async () => knapp.click());
  await vanta();
}

const rutan = () => document.querySelector('[role="dialog"]');
const svaret = (namn: string) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === namn) as HTMLButtonElement | undefined;
const skickat = (i: number) => h.sparaForvarvet.mock.calls[i][1] as FormData;

describe("beskedet i kortet Förvärvet", () => {
  it("visas i stället för att kortet stängs – ett besked är inget sparande", async () => {
    await oppnaKortet();
    await skrivAr("2020");
    await spara();
    expect(h.sparaForvarvet).toHaveBeenCalledOnce();
    expect(rutan()?.querySelector("h2")?.textContent).toBe(UNDERLAGSBESKED_RUBRIK);
    expect(onKlar, "kortet ska inte stängas som sparat").not.toHaveBeenCalledWith(false);
  });

  it("det hon skrev står kvar, och Spara ändå skickar samma datum med bekräftelsen", async () => {
    await oppnaKortet();
    await skrivAr("2020");
    await spara();
    expect(skickat(0).get("tilltradesdatum"), "förutsättningen: det nya datumet skickades").toBe("2020-06-01");
    expect(skickat(0).get(BEKRAFTAD_ANDRING)).toBe("");
    await act(async () => svaret(UNDERLAGSBESKED_SPARA)!.click());
    await vanta();
    expect(h.sparaForvarvet).toHaveBeenCalledTimes(2);
    expect(skickat(1).get("tilltradesdatum")).toBe("2020-06-01");
    expect(skickat(1).get(BEKRAFTAD_ANDRING)).toBe(BESKED.bekraftelse);
    expect(rutan()).toBeNull();
    expect(onKlar).toHaveBeenLastCalledWith(false);
  });

  it("Avbryt stänger rutan, skickar ingenting och lämnar kortet öppet med det hon skrev", async () => {
    await oppnaKortet();
    await skrivAr("2020");
    await spara();
    await act(async () => svaret(UNDERLAGSBESKED_AVBRYT)!.click());
    await vanta();
    expect(rutan()).toBeNull();
    expect(h.sparaForvarvet).toHaveBeenCalledOnce();
    expect(onKlar).not.toHaveBeenCalledWith(false);
    const dolt = behallare.querySelector<HTMLInputElement>('input[name="tilltradesdatum"]');
    expect(dolt?.value).toBe("2020-06-01");
  });
});
