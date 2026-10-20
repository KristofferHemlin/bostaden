// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Falt och okontrollerade falt, provat i en DOM – det anvandaren moter, inte
// det React jamfor (docs/design.md, "När ett formulär vägrar": en andring i
// Falt ska provas pa ett okontrollerat falt, inte bara ett kontrollerat).
//
// Uppmatt i produktionen 2026-10-19: en avvisad adress pa inloggningen var
// borta efter avvisningen. Falt gav sina barn olika form med och utan fel, och
// React monterade om faltet. Registreringens kontrollerade falt klarade sig,
// och det fick felet att se ut som en skillnad mellan valideringarna.
//
// Tre saker ar spärren:
//   1. Ett okontrollerat falt behaller sitt varde efter en avvisning.
//   2. Forsta tangenttrycket efter avvisningen gar inte forlorat – felet
//      forsvinner i samma ogonblick, och det ar da formen bytte tillbaka.
//   3. Fokus overlever samma ogonblick.
//
// Den enda testfilen i DOM-miljo. Ovriga tester kor i Node.

const h = vi.hoisted(() => ({ hanteraAuth: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
vi.mock("@/app/login/actions", () => ({ hanteraAuth: h.hanteraAuth }));

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Falt, INPUT_KLASS } from "@/components/skarm";
import LoginSida from "@/app/login/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  vi.clearAllMocks();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

async function rendera(element: ReturnType<typeof createElement>) {
  await act(async () => rot.render(element));
}

/** Skriver som en anvandare: varje tecken ett input-event, sa att React ser det. */
async function skriv(input: HTMLInputElement, text: string) {
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  for (const tecken of text) {
    await act(async () => {
      satt.call(input, input.value + tecken);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

async function skicka(form: HTMLFormElement) {
  await act(async () => form.requestSubmit());
}

const epostfalt = () => behallare.querySelector<HTMLInputElement>('input[name="epost"]')!;
const losenordsfalt = () => behallare.querySelector<HTMLInputElement>('input[name="losenord"]')!;
const formular = () => behallare.querySelector("form")!;
const alert = () => behallare.querySelector('[role="alert"]')?.textContent ?? null;

// En minimal sida: Falt runt ett okontrollerat falt, och ett fel som kommer
// vid inskickning och gar vid nasta andring – samma rytm som useFormularfel.
function Provsida() {
  const [fel, setFel] = useState<string | undefined>();
  return createElement(
    "form",
    {
      noValidate: true,
      onSubmit: (e: Event) => {
        e.preventDefault();
        setFel("Fyll i leverantör.");
        behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!.focus();
      },
    },
    createElement(Falt, {
      etikett: "Leverantör",
      fel,
      children: createElement("input", {
        name: "leverantor",
        defaultValue: "",
        onChange: () => setFel(undefined),
        className: INPUT_KLASS,
      }),
    }),
  );
}

describe("Falt med ett okontrollerat falt", () => {
  it("behaller vardet, nasta tecken och fokus genom en avvisning", async () => {
    await rendera(createElement(Provsida));
    const falt = behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!;
    await skriv(falt, "Beij");
    await skicka(behallare.querySelector("form")!);

    expect(alert()).toBe("Fyll i leverantör.");
    const efterAvvisning = behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!;
    expect(efterAvvisning.value).toBe("Beij");
    expect(document.activeElement).toBe(efterAvvisning);

    await skriv(efterAvvisning, "e");
    const efterTecken = behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!;
    expect(alert()).toBeNull();
    expect(efterTecken.value).toBe("Beije");
    expect(document.activeElement).toBe(efterTecken);
  });
});

// Samma sida med ett kontrollerat falt. Vardet bor hos foraldern och overlevde
// en ommontering – men DOM-elementet byttes anda, och fokus foljde inte med.
function KontrolleradProvsida() {
  const [fel, setFel] = useState<string | undefined>();
  const [varde, setVarde] = useState("");
  return createElement(
    "form",
    {
      noValidate: true,
      onSubmit: (e: Event) => {
        e.preventDefault();
        setFel("Fyll i leverantör.");
        behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!.focus();
      },
    },
    createElement(Falt, {
      etikett: "Leverantör",
      fel,
      children: createElement("input", {
        name: "leverantor",
        value: varde,
        onChange: (e: { target: HTMLInputElement }) => {
          setVarde(e.target.value);
          setFel(undefined);
        },
        className: INPUT_KLASS,
      }),
    }),
  );
}

describe("Falt med ett kontrollerat falt", () => {
  it("fokus stannar nar felet forsvinner vid forsta tecknet", async () => {
    await rendera(createElement(KontrolleradProvsida));
    const falt = behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!;
    await skriv(falt, "Beij");
    await skicka(behallare.querySelector("form")!);
    expect(document.activeElement).toBe(
      behallare.querySelector('input[name="leverantor"]'),
    );

    await skriv(behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!, "e");
    const efter = behallare.querySelector<HTMLInputElement>('input[name="leverantor"]')!;
    expect(efter.value).toBe("Beije");
    expect(document.activeElement).toBe(efter);
  });
});

describe("inloggningen, som anvandaren moter den", () => {
  it("1. en avvisad adress star kvar i faltet", async () => {
    await rendera(createElement(LoginSida));
    await skriv(epostfalt(), "kristoffer@gmailcom");
    await skicka(formular());

    expect(alert()).toBe("Fyll i en giltig e-postadress, t.ex. du@exempel.se.");
    expect(epostfalt().value).toBe("kristoffer@gmailcom");
    expect(h.hanteraAuth).not.toHaveBeenCalled();
  });

  it("2 och 3. forsta tecknet efter avvisningen gar inte forlorat, och fokus stannar", async () => {
    await rendera(createElement(LoginSida));
    await skriv(epostfalt(), "kristoffer@gmail");
    await skicka(formular());
    expect(alert()).not.toBeNull();
    expect(document.activeElement).toBe(epostfalt());

    await skriv(epostfalt(), ".");
    expect(alert()).toBeNull();
    expect(epostfalt().value).toBe("kristoffer@gmail.");
    expect(document.activeElement).toBe(epostfalt());

    await skriv(epostfalt(), "com");
    expect(epostfalt().value).toBe("kristoffer@gmail.com");
  });

  it("serverns avvisning: adressen star kvar efter att formularet aterstallts, losenordet tommas", async () => {
    h.hanteraAuth.mockResolvedValue({
      fel: "Fel e-post eller lösenord.",
      epost: "kristoffer@gmail.com",
    });
    await rendera(createElement(LoginSida));
    await skriv(epostfalt(), "kristoffer@gmail.com");
    await skriv(losenordsfalt(), "hemligt-Losen-91");
    await skicka(formular());

    expect(h.hanteraAuth).toHaveBeenCalledTimes(1);
    expect(alert()).toBe("Fel e-post eller lösenord.");
    expect(epostfalt().value).toBe("kristoffer@gmail.com");
    expect(losenordsfalt().value).toBe("");
  });
});
