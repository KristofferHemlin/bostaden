// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Andelsskarmen svarar medan hon skriver (docs/design.md, "Andelsskärmen
// svarar medan hon skriver"). Provat i en DOM, eftersom allt som ar nytt ar
// beteende over tid: ekot och erbjudandet foljer talet som statt stilla eller
// lamnat faltet, aldrig varje tangenttryck – den som skriver 100 passerar 1
// och 10. Och 0 slapps aldrig igenom: ett lagrat 0 ska avbryta berakningen
// (CLAUDE.md, "Andelen ar null tills den besvarats").
//
// Lydelsen for ekot lases ur design.md, inne i testet.

const h = vi.hoisted(() => ({ mottaget: [] as FormData[] }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: vi.fn(async () => ({})),
  aterkallaInbjudanAction: vi.fn(async () => ({})),
}));
vi.mock("@/app/bostaden/actions", () => ({
  sparaKopeskillingen: vi.fn(async () => ({})),
  sparaAndelen: vi.fn(async (_foreg: unknown, fd: FormData) => {
    h.mottaget.push(fd);
    return {};
  }),
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AndelFormular, BJUD_IN_KNAPPEN, EKOTS_FORDROJNING_MS } from "@/app/bostaden/formular";
import { ANDEL_NOLL } from "@/lib/agarandel";
import { delagarlydelse } from "./_delagarlydelser";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Ekot for 50 %, ordagrant ur design.md. */
function ekotFor50(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const m = design.match(/\*\*Talet ekas tillbaka under fältet:\*\* \*"([^"]+)"\*/);
  if (!m) throw new Error("design.md saknar ekots lydelse");
  return m[1];
}

/** Meningen for 0, ordagrant ur design.md. */
function nollansLydelse(): string {
  const design = readFileSync(join(process.cwd(), "docs", "design.md"), "utf-8");
  const avsnitt = design.indexOf("#### Andelsskärmen svarar medan hon skriver");
  if (avsnitt < 0) throw new Error("design.md saknar avsnittet om andelsskärmen");
  const m = design.slice(avsnitt).match(/\*\*Lydelsen är:\*\* \*"([^"]+)"\*/);
  if (!m) throw new Error("design.md saknar lydelsen för 0");
  return m[1];
}

/** Bara mellanslagens sort normaliseras: appen satter hart mellanslag fore %,
 *  design.md vanligt. Texten jamfors i sin helhet. */
const mellanslag = (t: string | null) => t?.replace(/\u00a0/g, " ") ?? null;

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  vi.useFakeTimers();
  h.mottaget = [];
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  vi.useRealTimers();
});

async function rendera({ forval = "", andraFinns = false } = {}) {
  await act(async () =>
    rot.render(createElement(AndelFormular, { forval, franExport: false, andraFinns })),
  );
}

const falt = () => behallare.querySelector<HTMLInputElement>('input[name="agarandel"]')!;
/** Ekots hela text, eller null nar det inte visas. Appen satter ett hart
 *  mellanslag fore % (formateraAndel) sa att tecknet aldrig bryts till en egen
 *  rad; design.md skriver ett vanligt. Bara mellanslagets sort normaliseras –
 *  texten jamfors i sin helhet. */
const eko = () =>
  behallare.querySelector("[data-andelseko]")?.textContent?.replace(/\u00a0/g, " ") ?? null;
const erbjudande = () => behallare.querySelector("[data-inbjudningserbjudande]");
const knapp = (text: string) =>
  [...behallare.querySelectorAll("button")].find((b) => b.textContent === text) ?? null;
const fel = () => [...behallare.querySelectorAll('[role="alert"]')].map((e) => e.textContent);

async function skriv(text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(falt(), text);
    falt().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function vanta(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function lamna() {
  await act(async () => {
    falt().focus();
    falt().blur();
  });
}

describe("fältet bär sin enhet", () => {
  it("ett % står i fältet, utanför värdet", async () => {
    await rendera();
    const enhet = falt().parentElement!.querySelector("[data-enhet]");
    expect(enhet?.textContent).toBe("%");
    expect(falt().value).toBe("");
  });
});

describe("ekot följer talet som stått stilla", () => {
  it("50 som står stilla: ekot är design.md:s lydelse, och erbjudandet följer under", async () => {
    await rendera();
    await skriv("5");
    await skriv("50");
    expect(eko()).toBeNull();
    await vanta(EKOTS_FORDROJNING_MS);
    expect(eko()).toBe(ekotFor50());
    expect(erbjudande()).not.toBeNull();
    // Erbjudandet ligger direkt under ekot, i samma formulär.
    const ekoElement = behallare.querySelector("[data-andelseko]")!;
    expect(ekoElement.nextElementSibling).toBe(erbjudande());
    expect(erbjudande()!.contains(knapp(BJUD_IN_KNAPPEN))).toBe(true);
  });

  it("den som skriver 100 passerar 1 och 10 utan att något blinkar fram", async () => {
    await rendera();
    for (const t of ["1", "10", "100"]) {
      await skriv(t);
      await vanta(EKOTS_FORDROJNING_MS / 2);
      expect(eko(), `ekot efter ${t}`).toBeNull();
      expect(erbjudande(), `erbjudandet efter ${t}`).toBeNull();
    }
    await vanta(EKOTS_FORDROJNING_MS);
    expect(eko()).toBe(ekotFor50().replace("50 %", "100 %"));
    expect(erbjudande()).toBeNull();
  });

  it("att lämna fältet visar ekot direkt, utan att vänta", async () => {
    await rendera();
    await skriv("33,33");
    expect(eko()).toBeNull();
    await lamna();
    expect(eko()).toBe(ekotFor50().replace("50 %", "33,33 %"));
    expect(erbjudande()).not.toBeNull();
  });

  it("ett ändrat tal tar bort ekot tills det nya stått stilla", async () => {
    await rendera();
    await skriv("50");
    await lamna();
    expect(eko()).toBe(ekotFor50());
    await skriv("100");
    expect(eko()).toBeNull();
    expect(erbjudande()).toBeNull();
  });

  it("ett sparat svar ekas från början", async () => {
    await rendera({ forval: "50" });
    expect(eko()).toBe(ekotFor50());
  });

  it("finns redan en annan medlem erbjuds ingen inbjudan, men ekot står kvar", async () => {
    await rendera({ andraFinns: true });
    await skriv("50");
    await lamna();
    expect(eko()).toBe(ekotFor50());
    expect(erbjudande()).toBeNull();
  });
});

describe("0 avvisas", () => {
  it("meningen är design.md:s lydelse, och varken eko eller erbjudande visas", async () => {
    await rendera();
    await skriv("0");
    await lamna();
    expect(fel().map(mellanslag)).toEqual([nollansLydelse()]);
    expect(mellanslag(ANDEL_NOLL)).toBe(nollansLydelse());
    expect(eko()).toBeNull();
    expect(erbjudande()).toBeNull();
  });

  it("0 skickas aldrig till servern", async () => {
    await rendera();
    await skriv("0");
    await act(async () => knapp("Spara ägarandelen")!.click());
    expect(h.mottaget).toHaveLength(0);
  });
});

describe("båda knapparna sparar svaret", () => {
  it("Spara ägarandelen sparar utan att leda till inbjudan", async () => {
    await rendera();
    await skriv("50");
    await lamna();
    await act(async () => knapp("Spara ägarandelen")!.click());
    expect(h.mottaget).toHaveLength(1);
    expect(h.mottaget[0].get("agarandel")).toBe("50");
    expect(h.mottaget[0].get("bjud_in")).toBe("");
  });

  it("erbjudandets knapp sparar samma svar och väljer inbjudan", async () => {
    await rendera();
    await skriv("50");
    await lamna();
    await act(async () => knapp(BJUD_IN_KNAPPEN)!.click());
    expect(h.mottaget).toHaveLength(1);
    expect(h.mottaget[0].get("agarandel")).toBe("50");
    expect(h.mottaget[0].get("bjud_in")).toBe("1");
  });

  it("erbjudandets knapp är inte en submitknapp – Enter i fältet sparar", async () => {
    await rendera();
    await skriv("50");
    await lamna();
    expect(knapp(BJUD_IN_KNAPPEN)!.type).toBe("button");
    const forstaSubmit = behallare.querySelector('button[type="submit"]');
    expect(forstaSubmit?.textContent).toBe("Spara ägarandelen");
  });
});

// docs/design.md, "Appen räknar aldrig de andra delägarna". Knappens lydelse
// stod inte i filen fore 2026-11-09 och vaktades inte. Texterna hittas pa det
// anvandaren laser, och jamfors i sin helhet.
describe("erbjudandet räknar inte de övriga delägarna", () => {
  it("texten och knappen är design.md:s lydelser", async () => {
    const text = delagarlydelse("Erbjudandets text");
    const knapptext = delagarlydelse("Knappen i andelsskärmens erbjudande, och inbjudningssidans rubrik");
    await rendera();
    await skriv("50");
    await lamna();
    const e = erbjudande();
    if (!e) throw new Error("erbjudandet renderades inte vid 50 %");
    const stycken = [...e.querySelectorAll("p")].map((p) => p.textContent);
    expect(stycken).toEqual([text]);
    const k = [...e.querySelectorAll("button")].find((b) => b.textContent === knapptext);
    if (!k) throw new Error(`erbjudandet saknar knappen "${knapptext}"`);
    expect(k.type).toBe("button");
  });
});
