// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Adressfaltets koppling, provad i en DOM: att valja ett forslag och se vad
// som star i ortfaltet. Regeln sjalv ar provad som funktion
// (tester/adress-ort.test.ts); har provas att komponenten foljer den – det
// som kraver en DOM, eftersom uppslagningen ar en klientinteraktion med
// asynkrona svar.
//
// Uppmatt i produktionen 2026-10-19: "Enköping" stod i ortfaltet, ett tryck
// landade pa ett forslag, och orten blev "Älta".
//
// INTE provat har: forslagslistans hojdgrans. jsdom raknar inte ut layout,
// och ett test som pastod sig prova overlappningen vore ett falskt test. Den
// kontrollen gors i produktionen.

const h = vi.hoisted(() => {
  // Nyckeln lases nar modulen laddas – den maste finnas fore importen.
  process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY = "testnyckel";
  return {
    /** Ort per platsid, som detaljuppslagningen svarar med. */
    orter: {} as Record<string, string>,
    /** Haller detaljsvaret tills testet slapper det, nar det behovs. */
    vanta: null as Promise<void> | null,
  };
});

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AdressFalt } from "@/app/registrera/adress-falt";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FORSLAG = [
  { placeId: "p-alta", text: "Storgatan 1", sekundar: "Älta" },
  { placeId: "p-solna", text: "Storgatan 1", sekundar: "Solna" },
];

function svar(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200 });
}

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.orter = { "p-alta": "Älta", "p-solna": "Solna" };
  h.vanta = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("places:autocomplete")) {
        return svar({
          suggestions: FORSLAG.map((f) => ({
            placePrediction: {
              placeId: f.placeId,
              structuredFormat: { mainText: { text: f.text }, secondaryText: { text: f.sekundar } },
            },
          })),
        });
      }
      const placeId = decodeURIComponent(url.split("/").pop()!);
      if (h.vanta) await h.vanta;
      return svar({
        location: { latitude: 59.3, longitude: 18.1 },
        addressComponents: [{ longText: h.orter[placeId], types: ["postal_town"] }],
      });
    }),
  );
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  vi.unstubAllGlobals();
});

const adressfalt = () => behallare.querySelector<HTMLInputElement>('input[name="adress"]')!;
const ortfalt = () => behallare.querySelector<HTMLInputElement>('input[name="ort"]')!;

async function rendera() {
  await act(async () => rot.render(createElement(AdressFalt, { obligatoriskt: true })));
}

/** Skriver som en anvandare: ett input-event per tecken. */
async function skriv(input: HTMLInputElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  for (const tecken of text) {
    await act(async () => {
      satt.call(input, input.value + tecken);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

/** Skriver en adress och vantar ut fordrojningen tills forslagen visas. */
async function sokAdress(text: string) {
  await skriv(adressfalt(), text);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}

/** Trycker pa forslaget med den har sekundartexten, och vantar ut detaljsvaret. */
async function valjForslag(sekundar: string) {
  const knapp = [...behallare.querySelectorAll<HTMLButtonElement>('[role="option"] button')].find(
    (b) => b.textContent?.includes(sekundar),
  );
  expect(knapp, `inget forslag ${sekundar}`).toBeTruthy();
  await act(async () => {
    knapp!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    knapp!.click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("uppslagningen och ortfaltet", () => {
  it("en ort anvandaren skrivit star kvar nar en adress valjs", async () => {
    await rendera();
    await skriv(ortfalt(), "Enköping");
    await sokAdress("Storg");
    await valjForslag("Älta");
    expect(adressfalt().value).toBe("Storgatan 1");
    expect(ortfalt().value).toBe("Enköping");
  });

  it("ett tomt ortfalt fylls i av uppslagningen", async () => {
    await rendera();
    await sokAdress("Storg");
    await valjForslag("Älta");
    expect(ortfalt().value).toBe("Älta");
  });

  it("ett andra adressval ersatter orten fran det forsta", async () => {
    await rendera();
    await sokAdress("Storg");
    await valjForslag("Älta");
    await sokAdress("a");
    await valjForslag("Solna");
    expect(ortfalt().value).toBe("Solna");
  });

  it("en ort som skrivs medan svaret ar pa vag star kvar", async () => {
    let slapp!: () => void;
    h.vanta = new Promise<void>((r) => {
      slapp = r;
    });
    await rendera();
    await sokAdress("Storg");
    await valjForslag("Älta");
    // Svaret har inte kommit an – anvandaren skriver orten under tiden.
    await skriv(ortfalt(), "Enköping");
    await act(async () => {
      slapp();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ortfalt().value).toBe("Enköping");
  });
});
