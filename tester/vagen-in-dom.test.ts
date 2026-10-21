// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Vagen in, provad i en DOM – det anvandaren moter (docs/design.md,
// Inloggningssidan, besluten 2026-10-21):
//
//   1. Losenordet gar att se: dolt fran borjan, ett oga som ar en egen knapp
//      och aldrig skickar formularet, med ett namn som sager vad det gor. Pa
//      inloggningen, nytt losenord och registreringen.
//   2. Adressen foljer med mellan vagarna in – inloggning, registrering, glomt
//      losenord – i flikens tillstand och aldrig i en URL. Losenordet foljer
//      aldrig med.
//   3. "Skicka igen" vilar en minut efter ett utskick, med en dampad rad och
//      inget felmeddelande.
//
// Varje overgang provas hela vagen: skriv pa sidan, tryck pa lanken, montera
// malsidan och las faltet. Att lagringen innehaller adressen sager ingenting
// om att faltet visar den.

const h = vi.hoisted(() => ({
  hanteraAuth: vi.fn(),
  begarAterstallning: vi.fn(),
  sattNyttLosenord: vi.fn(),
  slutforRegistrering: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {} }),
  redirect: () => {},
}));
vi.mock("@/app/login/actions", () => ({ hanteraAuth: h.hanteraAuth }));
vi.mock("@/app/losenord/actions", () => ({
  begarAterstallning: h.begarAterstallning,
  sattNyttLosenord: h.sattNyttLosenord,
}));
vi.mock("@/app/registrera/actions", () => ({
  slutforRegistrering: h.slutforRegistrering,
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import LoginSida from "@/app/login/page";
import GlomtLosenordSida from "@/app/losenord/glomt/page";
import { SKICKA_IGEN_EFTER_MS, VANTA_MED_NY_LANK } from "@/app/losenord/glomt/vila";
import { NyttLosenordFormular } from "@/app/losenord/nytt/formular";
import { RegistreraFlode } from "@/app/registrera/flode";
import { EpostLank } from "@/components/epost-lank";
import { VISA_LOSENORDET } from "@/components/losenord-falt";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let behallare: HTMLDivElement;
let rot: Root;
/** Lankar navigerar inte i testet – trycket ska bara ge lankens egen effekt. */
function stoppaNavigering(e: MouseEvent) {
  if ((e.target as Element).closest?.("a")) e.preventDefault();
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  document.addEventListener("click", stoppaNavigering, true);
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  document.removeEventListener("click", stoppaNavigering, true);
  vi.useRealTimers();
});

async function rendera(element: ReturnType<typeof createElement>) {
  await act(async () => rot.render(element));
}

/** Byter sida: den gamla avmonteras helt, som vid en navigering. */
async function byt(element: ReturnType<typeof createElement>) {
  act(() => rot.unmount());
  rot = createRoot(behallare);
  await rendera(element);
}

async function skriv(input: HTMLInputElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function tryck(el: Element) {
  await act(async () => (el as HTMLElement).click());
}

const falt = (namn: string) =>
  behallare.querySelector<HTMLInputElement>(`input[name="${namn}"]`)!;

/** Lanken med exakt den har texten – aldrig en delstrang. */
function lank(text: string): HTMLAnchorElement {
  const traffar = [...behallare.querySelectorAll("a")].filter(
    (a) => a.textContent?.trim() === text,
  );
  expect(traffar, `lanken "${text}"`).toHaveLength(1);
  return traffar[0];
}

function knapp(text: string): HTMLButtonElement {
  const traffar = [...behallare.querySelectorAll("button")].filter(
    (b) => b.textContent?.trim() === text,
  );
  expect(traffar, `knappen "${text}"`).toHaveLength(1);
  return traffar[0];
}

/** Allt fliken bar – for att se att losenordet aldrig ar med. */
function flikensTillstand(): string {
  return Object.keys(sessionStorage)
    .map((k) => `${k}=${sessionStorage.getItem(k)}`)
    .join("\n");
}

// --- 1. Losenordet gar att se ------------------------------------------------

const SIDOR_MED_LOSENORD = [
  { namn: "inloggningen", etikett: "Lösenord", sida: () => createElement(LoginSida), action: () => h.hanteraAuth },
  { namn: "nytt lösenord", etikett: "Nytt lösenord", sida: () => createElement(NyttLosenordFormular), action: () => h.sattNyttLosenord },
  { namn: "registreringen", etikett: "Lösenord", sida: () => createElement(RegistreraFlode, {}), action: () => h.slutforRegistrering },
];

describe.each(SIDOR_MED_LOSENORD)("lösenordet går att se: $namn", ({ etikett, sida, action }) => {
  function oga(): HTMLButtonElement {
    const traffar = [...behallare.querySelectorAll("button")].filter(
      (b) => b.getAttribute("aria-label") === VISA_LOSENORDET,
    );
    expect(traffar, "ett oga per losenordsfalt").toHaveLength(1);
    return traffar[0];
  }

  it("är dolt från början, och ögat växlar fram och tillbaka", async () => {
    await rendera(sida());
    expect(falt("losenord").type).toBe("password");
    expect(oga().getAttribute("aria-pressed")).toBe("false");

    await tryck(oga());
    expect(falt("losenord").type).toBe("text");
    expect(oga().getAttribute("aria-pressed")).toBe("true");

    await tryck(oga());
    expect(falt("losenord").type).toBe("password");
    expect(oga().getAttribute("aria-pressed")).toBe("false");
  });

  it("ögat skickar aldrig formuläret, och det skrivna står kvar", async () => {
    await rendera(sida());
    const skickat = vi.fn();
    behallare.querySelector("form")!.addEventListener("submit", skickat);
    await skriv(falt("losenord"), "ett-langt-losenord");

    await tryck(oga());
    await tryck(oga());

    expect(skickat).not.toHaveBeenCalled();
    expect(action()).not.toHaveBeenCalled();
    expect(falt("losenord").value).toBe("ett-langt-losenord");
  });

  it("fältets namn är etiketten, inte etiketten och knappen", async () => {
    await rendera(sida());
    // Knappen ligger inne i Falts <label>; utan aria-label blir faltets namn
    // "Lösenord Visa lösenordet" for den som anvander skarmlasare.
    expect(falt("losenord").getAttribute("aria-label")).toBe(etikett);
  });
});

// --- 2. Adressen foljer med -------------------------------------------------

const ADRESS = "anna.svensson@exempel.se";
const LOSENORD = "hemligt-losenord-123";

describe("adressen följer med mellan vägarna in", () => {
  it("inloggning → registrering (Skapa konto)", async () => {
    await rendera(createElement(LoginSida));
    await skriv(falt("epost"), ADRESS);
    await skriv(falt("losenord"), LOSENORD);
    const l = lank("Skapa konto");
    expect(l.getAttribute("href")).toBe("/registrera");
    await tryck(l);

    await byt(createElement(RegistreraFlode, {}));
    expect(falt("epost").value).toBe(ADRESS);
    expect(falt("losenord").value).toBe("");
    expect(flikensTillstand()).not.toContain(LOSENORD);
  });

  it("registrering → inloggning (Jag har redan ett konto)", async () => {
    await rendera(createElement(RegistreraFlode, {}));
    await skriv(falt("epost"), ADRESS);
    await skriv(falt("losenord"), LOSENORD);
    const l = lank("Jag har redan ett konto");
    expect(l.getAttribute("href")).toBe("/login");
    await tryck(l);

    await byt(createElement(LoginSida));
    expect(falt("epost").value).toBe(ADRESS);
    expect(falt("losenord").value).toBe("");
    expect(flikensTillstand()).not.toContain(LOSENORD);
  });

  it("inloggning → Glömt lösenordet", async () => {
    await rendera(createElement(LoginSida));
    await skriv(falt("epost"), ADRESS);
    await skriv(falt("losenord"), LOSENORD);
    const l = lank("Glömt lösenordet?");
    expect(l.getAttribute("href")).toBe("/losenord/glomt");
    await tryck(l);

    await byt(createElement(GlomtLosenordSida));
    expect(falt("epost").value).toBe(ADRESS);
    expect(flikensTillstand()).not.toContain(LOSENORD);
  });

  it("registrering → inloggning via Logga in i stället, när adressen redan har ett konto", async () => {
    h.slutforRegistrering.mockResolvedValue({
      fel: "E-postadressen har redan ett konto. Logga in i stället.",
      falt: "epost",
      epostUpptagen: true,
      epost: ADRESS,
    });
    await rendera(createElement(RegistreraFlode, {}));
    await skriv(falt("epost"), ADRESS);
    await skriv(falt("losenord"), LOSENORD);
    await act(async () => behallare.querySelector("form")!.requestSubmit());
    expect(h.slutforRegistrering).toHaveBeenCalledTimes(1);

    const l = lank("Logga in i stället");
    expect(l.getAttribute("href")).toBe("/login");
    await tryck(l);

    await byt(createElement(LoginSida));
    expect(falt("epost").value).toBe(ADRESS);
    expect(falt("losenord").value).toBe("");
    expect(flikensTillstand()).not.toContain(LOSENORD);
  });

  it("Glömt lösenordet → tillbaka till inloggningen", async () => {
    await rendera(createElement(GlomtLosenordSida));
    await skriv(falt("epost"), ADRESS);
    const l = lank("Tillbaka till inloggningen");
    expect(l.getAttribute("href")).toBe("/login");
    await tryck(l);

    await byt(createElement(LoginSida));
    expect(falt("epost").value).toBe(ADRESS);
  });

  it("inbjudan → inloggning: lankens adress foljer med, inte i URL:en", async () => {
    await rendera(createElement(EpostLank, { href: "/login", epost: ADRESS, children: "Logga in för att ansluta" }));
    const l = lank("Logga in för att ansluta");
    expect(l.getAttribute("href")).toBe("/login");
    await tryck(l);

    await byt(createElement(LoginSida));
    expect(falt("epost").value).toBe(ADRESS);
  });

  it("en suddad adress följer inte med – en gammal dyker inte upp igen", async () => {
    sessionStorage.setItem("kvittobo.epost", "gammal@exempel.se");
    await rendera(createElement(LoginSida));
    expect(falt("epost").value).toBe("gammal@exempel.se");
    await skriv(falt("epost"), "");
    await tryck(lank("Skapa konto"));

    await byt(createElement(RegistreraFlode, {}));
    expect(falt("epost").value).toBe("");
  });

  it("utan något i fliken är fältet tomt, inte 'undefined' eller 'null'", async () => {
    await rendera(createElement(LoginSida));
    expect(falt("epost").value).toBe("");
  });
});

// --- 3. Sextiosekundersfonstret ----------------------------------------------

describe("Skicka igen vilar en minut", () => {
  function dampadRad(): HTMLElement[] {
    return [...behallare.querySelectorAll("p")].filter(
      (p) => p.textContent?.trim() === VANTA_MED_NY_LANK,
    );
  }

  async function skickaEnGang() {
    h.begarAterstallning.mockResolvedValue({ skickatTill: ADRESS });
    await rendera(createElement(GlomtLosenordSida));
    await skriv(falt("epost"), ADRESS);
    await act(async () => behallare.querySelector("form")!.requestSubmit());
    expect(h.begarAterstallning).toHaveBeenCalledTimes(1);
  }

  it("före första utskicket finns ingen vila", async () => {
    await rendera(createElement(GlomtLosenordSida));
    expect(knapp("Skicka länk").disabled).toBe(false);
    expect(dampadRad()).toHaveLength(0);
  });

  it("efter ett utskick är knappen overksam, med en dämpad rad och inget fel", async () => {
    await skickaEnGang();
    expect(knapp("Skicka igen").disabled).toBe(true);
    expect(dampadRad()).toHaveLength(1);
    expect(dampadRad()[0].getAttribute("role")).toBeNull();
    // Inget felmeddelande nagonstans.
    expect(behallare.querySelector('[role="alert"]')).toBeNull();

    // Ett tryck nar inte servern.
    await tryck(knapp("Skicka igen"));
    expect(h.begarAterstallning).toHaveBeenCalledTimes(1);
  });

  it("efter en minut går det att be om en ny länk", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await skickaEnGang();
    await act(async () => vi.advanceTimersByTime(SKICKA_IGEN_EFTER_MS - 1));
    expect(knapp("Skicka igen").disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));
    expect(knapp("Skicka igen").disabled).toBe(false);
    expect(dampadRad()).toHaveLength(0);
  });

  it("en rättad adress går att skicka till direkt – vilan gäller den som fick mejlet", async () => {
    await skickaEnGang();
    await skriv(falt("epost"), "anna.svenson@exempel.se");
    expect(knapp("Skicka igen").disabled).toBe(false);
    expect(dampadRad()).toHaveLength(0);
  });
});
