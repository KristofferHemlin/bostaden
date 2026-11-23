// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Gränsen 1970 prövas i webbläsaren också, inte först efter att formuläret
// skickats – och meddelandet står vid sitt fält. Till 2026-11-23 prövades den
// bara på servern, och vid försäljningen stod varje fel överst i formuläret.
// Serversidan prövas i tester/tidigaste-datum.test.ts.

const h = vi.hoisted(() => ({
  markeraSald: vi.fn(async (): Promise<{ fel?: string; falt?: string }> => ({})),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {}, prefetch: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  redirect: () => {},
}));
vi.mock("@/app/forsaljning/actions", () => ({ markeraSald: h.markeraSald }));
vi.mock("@/app/registrera/actions", () => ({ slutforRegistrering: vi.fn(async () => ({})) }));
vi.mock("@/app/installningar/actions", () => ({
  sparaForvarvet: vi.fn(async () => ({})),
  sparaBostaden: vi.fn(async () => ({})),
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  taBortKostnad: vi.fn(async () => ({})),
  taBortBilagaAction: vi.fn(async () => ({})),
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortUtkastRad: vi.fn(async () => ({})),
  redigeraKostnad: vi.fn(async () => ({})),
  sattHorInteTillBostaden: vi.fn(async () => ({})),
}));
vi.mock("@/lib/lagring/bilaga-klient", () => ({ laddaUppKostnadsbilaga: vi.fn() }));
vi.mock("@/app/kostnad/bilaga-actions", () => ({
  analyseraBilaga: vi.fn(async () => ({})),
  taBortBilaga: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/kostnad/nytt/actions", () => ({
  skapaUtkast: vi.fn(async () => ({})),
  sparaKostnad: vi.fn(async () => ({})),
  sparaUtkastfalten: vi.fn(async () => ({})),
}));

import { act, createElement, createRef, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ForsaljningForm } from "@/app/forsaljning/form";
import { FORSALJNINGSDATUM_FORE_GRANSEN } from "@/app/forsaljning/validering";
import { ForvarvetKort } from "@/app/installningar/kort";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";
import { NyKostnadForm } from "@/app/kostnad/nytt/form";
import { RegistreraFlode } from "@/app/registrera/flode";
import { TILLTRADESFALTETS_ETIKETT } from "@/app/registrera/validering";
import { fortidigtDatumFel, TIDIGASTE_DATUM } from "@/lib/datum";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAGEN_FORE = (() => {
  const d = new Date(`${TIDIGASTE_DATUM}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  h.markeraSald.mockReset();
  h.markeraSald.mockResolvedValue({});
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

async function rendera(vy: ReactElement) {
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
  await act(async () => rot.render(vy));
}

const satt = () => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

/** Skriver ett datum i fältet med den etiketten: tre rutor, tecken för tecken, efter att de tömts. */
async function skrivDatum(etikett: string, dag: string) {
  const [a, m, d] = dag.split("-");
  for (const [del, v] of [["år", a], ["månad", m], ["dag", d]] as const) {
    const ruta = behallare.querySelector<HTMLInputElement>(`input[aria-label="${etikett}, ${del}"]`);
    expect(ruta, `förutsättningen: rutan "${etikett}, ${del}"`).toBeTruthy();
    await act(async () => {
      satt().call(ruta!, "");
      ruta!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    for (const tecken of v) {
      await act(async () => {
        satt().call(ruta!, ruta!.value + tecken);
        ruta!.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  }
}

/** Meddelandet som datumfältet med den etiketten visar under sina rutor, eller null. */
function faltetsMeddelande(etikett: string): string | null {
  const ruta = behallare.querySelector<HTMLInputElement>(`input[aria-label="${etikett}, år"]`)!;
  const id = ruta.getAttribute("aria-describedby");
  if (!id) return null;
  const texter = id
    .split(/\s+/)
    .map((i) => behallare.querySelector(`[id="${i}"]`))
    .filter((e): e is Element => e !== null && e.getAttribute("role") === "alert")
    .map((e) => e.textContent ?? "");
  return texter.length > 0 ? texter.join(" ") : null;
}

const SKARMARNA: { namn: string; etikett: string; meddelande: string; oppna: () => Promise<void> }[] = [
  {
    namn: "försäljningen",
    etikett: "Försäljningsdatum",
    meddelande: FORSALJNINGSDATUM_FORE_GRANSEN,
    oppna: () => rendera(createElement(ForsaljningForm, { forvaltDatum: "", forvaltPris: "", redanSald: false })),
  },
  {
    namn: "tillträdet i registreringen",
    etikett: TILLTRADESFALTETS_ETIKETT,
    meddelande: fortidigtDatumFel("Tillträdesdatum"),
    oppna: () => rendera(createElement(RegistreraFlode, { endastBostad: true })),
  },
  {
    namn: "tillträdet i inställningarna",
    etikett: "Tillträdesdatum",
    meddelande: fortidigtDatumFel("Tillträdesdatum"),
    oppna: () =>
      rendera(
        createElement(ForvarvetKort, {
          data: {
            tilltradesdatum: "2019-06-01", kopeskillingOren: null, kopkostnaderOren: null, arBostadsratt: false,
            agarandelProcent: 100, bostadsfragor: { upplatelseform: "fastighet", forstaAgare: false, ombildning: null },
          },
          oppen: true,
          formRef: createRef<HTMLFormElement>(),
          onAndra: () => {}, onAvbryt: () => {}, onDirty: () => {}, onKlar: () => {},
        } as never),
      ),
  },
  {
    namn: "betaldagen i inmatningen",
    etikett: "Betaldatum",
    meddelande: fortidigtDatumFel("Datum"),
    oppna: () =>
      rendera(
        createElement(NyKostnadForm, {
          bostad: { id: "b0000000-0000-4000-8000-0000000000f9", namn: null },
          innehav: { tilltradesdatum: "1960-01-01", forsaljningsdatum: null },
        }),
      ),
  },
  {
    namn: "betaldagen i kvittots ändringsläge",
    etikett: "Betaldatum",
    meddelande: fortidigtDatumFel("Betaldatum"),
    oppna: () =>
      rendera(
        createElement(RedigeraVy, {
          kostnadId: "k0000000-0000-4000-8000-0000000000f9",
          projekt: [],
          varden: {
            leverantor: "Bauhaus", totalbelopp: "1 250,00", totalbeloppVisning: 125000, dokumentdatum: "2020-03-02",
            betaldatum: "2020-03-02", projektId: "", rotUtnyttjat: "", anteckning: "",
          },
          innehav: { tilltradesdatum: "1960-01-01", forsaljningsdatum: null },
          privatDel: { forvalt: "" },
          arkiverad: false,
          onAvbryt: () => {},
          onSparat: () => {},
        } as never),
      ),
  },
];

describe.each(SKARMARNA)("$namn: gränsen i webbläsaren", ({ etikett, meddelande, oppna }) => {
  it("dagen före gränsen säger till vid fältet medan hon skriver", async () => {
    await oppna();
    await skrivDatum(etikett, DAGEN_FORE);
    expect(faltetsMeddelande(etikett)).toBe(meddelande);
  });

  it("gränsens egen dag säger ingenting", async () => {
    await oppna();
    await skrivDatum(etikett, TIDIGASTE_DATUM);
    expect(faltetsMeddelande(etikett)).toBeNull();
  });
});

describe("försäljningen: formuläret skickas inte, och beskedet står vid fältet", () => {
  it("dagen före gränsen skickas aldrig till servern", async () => {
    await SKARMARNA[0].oppna();
    await skrivDatum("Försäljningsdatum", DAGEN_FORE);
    await act(async () => behallare.querySelector("form")!.requestSubmit());
    expect(h.markeraSald).not.toHaveBeenCalled();
    expect(faltetsMeddelande("Försäljningsdatum")).toBe(FORSALJNINGSDATUM_FORE_GRANSEN);
    expect(behallare.querySelector(`[${FORMULARFEL_ATTRIBUT}]`), "inget formulärfel överst").toBeNull();
  });

  it("gränsens egen dag skickas", async () => {
    await SKARMARNA[0].oppna();
    await skrivDatum("Försäljningsdatum", TIDIGASTE_DATUM);
    await act(async () => behallare.querySelector("form")!.requestSubmit());
    expect(h.markeraSald).toHaveBeenCalledTimes(1);
  });

  it("serverns besked om datumet står vid fältet, inte överst", async () => {
    const fel = "Försäljningsdatum kan inte ligga före tillträdet (2021-03-01).";
    h.markeraSald.mockResolvedValue({ fel, falt: "forsaljningsdatum" });
    await SKARMARNA[0].oppna();
    await skrivDatum("Försäljningsdatum", "2020-01-01");
    await act(async () => behallare.querySelector("form")!.requestSubmit());
    expect(h.markeraSald).toHaveBeenCalledTimes(1);
    expect(faltetsMeddelande("Försäljningsdatum")).toBe(fel);
    expect(behallare.querySelector(`[${FORMULARFEL_ATTRIBUT}]`), "inget formulärfel överst").toBeNull();
  });
});

// Ett tomt tillträdesfält lämnar det sparade datumet orört (docs/design.md,
// "Kortet Förvärvet"), och servern måste då kunna skilja ett tömt fält från
// ett påbörjat: båda ger ett tomt ISO-fält. Datumfältet säger det i ett eget
// dolt fält.
describe("inställningarnas tillträde: tomt är inte detsamma som påbörjat", () => {
  async function tom(del: "år" | "månad" | "dag") {
    const ruta = behallare.querySelector<HTMLInputElement>(`input[aria-label="Tillträdesdatum, ${del}"]`)!;
    await act(async () => {
      satt().call(ruta, "");
      ruta.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const dolda = () => ({
    iso: behallare.querySelector<HTMLInputElement>('input[type="hidden"][name="tilltradesdatum"]')!.value,
    paborjat: behallare.querySelector<HTMLInputElement>('input[type="hidden"][name="tilltradesdatum__paborjat"]')!.value,
  });

  it("ett ifyllt datum: ISO-värdet, inte påbörjat", async () => {
    await SKARMARNA[2].oppna();
    expect(dolda()).toEqual({ iso: "2019-06-01", paborjat: "" });
  });

  it("ett helt tömt fält: tomt, inte påbörjat", async () => {
    await SKARMARNA[2].oppna();
    await tom("år");
    await tom("månad");
    await tom("dag");
    expect(dolda()).toEqual({ iso: "", paborjat: "" });
  });

  it("ett halvt tömt fält: tomt ISO-värde, men påbörjat", async () => {
    await SKARMARNA[2].oppna();
    await tom("dag");
    expect(dolda()).toEqual({ iso: "", paborjat: "1" });
  });
});
