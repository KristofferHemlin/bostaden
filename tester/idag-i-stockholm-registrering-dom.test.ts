// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Registreringens eget prov i webbläsaren (src/app/registrera/flode.tsx,
// validera) avgör om formuläret alls skickas – innan servern ser något. Det
// räknade idag i UTC, och den som registrerade sig strax efter midnatt med
// dagens tillträde stoppades där (CLAUDE.md, "Ett datum utan sin tidszon är
// inte en dag"). Serversidan och datumfältet prövas i
// tester/idag-i-stockholm.test.ts; här prövas att formuläret skickas.

const h = vi.hoisted(() => ({ slutforRegistrering: vi.fn(async () => ({})) }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {} }),
  redirect: () => {},
}));
vi.mock("@/app/registrera/actions", () => ({ slutforRegistrering: h.slutforRegistrering }));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RegistreraFlode } from "@/app/registrera/flode";
import { isoDatum } from "@/lib/format";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OGONBLICK = [
  { namn: "vintertid, 00:30", nu: "2026-11-23T23:30:00.000Z", idag: "2026-11-24", imorgon: "2026-11-25" },
  { namn: "sommartid, 01:30", nu: "2026-06-15T23:30:00.000Z", idag: "2026-06-16", imorgon: "2026-06-17" },
];
const ZONER = ["UTC", "America/New_York", "Europe/Stockholm"];
const ursprungligZon = process.env.TZ;

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  h.slutforRegistrering.mockClear();
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  vi.useRealTimers();
  if (ursprungligZon === undefined) delete process.env.TZ;
  else process.env.TZ = ursprungligZon;
});

const satt = () => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

async function skriv(input: HTMLInputElement, text: string) {
  for (const tecken of text) {
    await act(async () => {
      satt().call(input, input.value + tecken);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

/** Fyller bostadssteget med ett giltigt svar på allt utom tillträdet, och skickar. */
async function skickaMedTilltrade(dag: string): Promise<string> {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(createElement(RegistreraFlode, { endastBostad: true })));

  const villa = [...behallare.querySelectorAll("button")].find((b) => b.textContent?.includes("Villa eller radhus"));
  expect(villa, "förutsättningen: valet Villa eller radhus").toBeTruthy();
  await act(async () => villa!.click());

  const [a, m, d] = dag.split("-");
  for (const [p, v] of [["ÅÅÅÅ", a], ["MM", m], ["DD", d]] as const) {
    const ruta = behallare.querySelector<HTMLInputElement>(`input[name="tilltradesdatum"] ~ * input[placeholder="${p}"], input[placeholder="${p}"]`);
    expect(ruta, `förutsättningen: tillträdets ruta ${p}`).toBeTruthy();
    await skriv(ruta!, v);
  }
  const adress = behallare.querySelector<HTMLInputElement>('input[name="adress"]');
  expect(adress, "förutsättningen: adressfältet").toBeTruthy();
  await act(async () => {
    satt().call(adress!, "Kvarnvägen 3");
    adress!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await skriv(behallare.querySelector<HTMLInputElement>('input[name="kopeskilling"]')!, "3250000");

  await act(async () => behallare.querySelector("form")!.requestSubmit());
  return behallare.textContent ?? "";
}

describe.each(ZONER)("processens tidszon %s", (zon) => {
  describe.each(OGONBLICK)("$namn i Stockholm", ({ nu, idag, imorgon }) => {
    beforeEach(() => {
      process.env.TZ = zon;
      vi.setSystemTime(new Date(nu));
      expect(isoDatum(new Date())).not.toBe(idag);
    });

    it("registreringen skickas med dagens tillträde", async () => {
      const text = await skickaMedTilltrade(idag);
      expect(text).not.toMatch(/kan inte ligga i framtiden/);
      expect(h.slutforRegistrering).toHaveBeenCalledTimes(1);
    });

    it("och stoppas med morgondagens", async () => {
      const text = await skickaMedTilltrade(imorgon);
      expect(text).toMatch(/Tillträdesdatum kan inte ligga i framtiden\./);
      expect(h.slutforRegistrering).not.toHaveBeenCalled();
    });
  });
});
