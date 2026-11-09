// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Losenordet toms bara nar det kan ha varit fel (docs/design.md,
// Inloggningssidan). Formularet laser orsaken i serverns svar, aldrig
// meningens text: en omskriven mening ska inte andra vad som toms. Fallen
// nedan ar valda for att skilja de tva – ett svar dar texten sager "fel
// uppgifter" men orsaken ar kontakt behaller losenordet, och ett dar orsaken
// ar uppgifter men texten ar en annan tommer det.
//
// Allt annat behaller ocksa losenordet: formularet skickar fran onSubmit, sa
// React nollstaller det inte (src/lib/skicka-utan-nollstallning.ts).

const h = vi.hoisted(() => ({ hanteraAuth: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/login/actions", () => ({ hanteraAuth: h.hanteraAuth }));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import LoginSida from "@/app/login/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FEL_UPPGIFTER = "Fel e-post eller lösenord.";
const INGEN_KONTAKT = "Ingen kontakt med inloggningstjänsten. Försök igen om en stund.";
const EPOST = "anna@exempel.se";
const LOSENORD = "ett-langt-och-noga-valt-losenord";

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(async () => {
  vi.clearAllMocks();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(createElement(LoginSida)));
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

function falt(namn: string): HTMLInputElement {
  const e = behallare.querySelector<HTMLInputElement>(`input[name="${namn}"]`);
  if (!e) throw new Error(`hittade inget falt ${namn}`);
  return e;
}

async function skriv(namn: string, text: string) {
  const e = falt(namn);
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(e, text);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Loggar in och vantar tills serverns mening syns. Syns den aldrig faller
 *  testet har, i stallet for att prova falten innan svaret kommit. */
async function loggaIn(svar: { fel: string; orsak: string }) {
  h.hanteraAuth.mockResolvedValue({ ...svar, epost: EPOST });
  await skriv("epost", EPOST);
  await skriv("losenord", LOSENORD);
  const knapp = [...behallare.querySelectorAll("button")].find((b) => b.textContent === "Logga in");
  if (!knapp) throw new Error("hittade ingen knapp Logga in");
  await act(async () => knapp.click());
  for (let i = 0; i < 20 && !behallare.textContent?.includes(svar.fel); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  if (!behallare.textContent?.includes(svar.fel)) throw new Error(`meningen "${svar.fel}" visades aldrig`);
  expect(h.hanteraAuth).toHaveBeenCalledTimes(1);
}

describe("losenordet efter en avvisad inloggning", () => {
  it("toms vid fel uppgifter, och adressen star kvar", async () => {
    await loggaIn({ fel: FEL_UPPGIFTER, orsak: "uppgifter" });
    expect({ epost: falt("epost").value, losenord: falt("losenord").value }).toEqual({ epost: EPOST, losenord: "" });
  });

  it("star kvar nar inloggningstjansten inte svarar", async () => {
    await loggaIn({ fel: INGEN_KONTAKT, orsak: "kontakt" });
    expect({ epost: falt("epost").value, losenord: falt("losenord").value }).toEqual({ epost: EPOST, losenord: LOSENORD });
  });

  it("star kvar vid annat", async () => {
    await loggaIn({ fel: "E-postadressen är inte bekräftad än. Kolla mejlen.", orsak: "annat" });
    expect(falt("losenord").value).toBe(LOSENORD);
  });

  // De tva fallen som faller om tomningen gors pa meningens text.
  it("star kvar nar orsaken ar kontakt, aven om meningen ar den for fel uppgifter", async () => {
    await loggaIn({ fel: FEL_UPPGIFTER, orsak: "kontakt" });
    expect(falt("losenord").value).toBe(LOSENORD);
  });

  it("toms nar orsaken ar uppgifter, aven om meningen ar omskriven", async () => {
    await loggaIn({ fel: "Adressen eller lösenordet stämmer inte.", orsak: "uppgifter" });
    expect(falt("losenord").value).toBe("");
  });
});
