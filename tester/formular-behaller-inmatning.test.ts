// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ett formular som avvisas behaller det hon skrev (docs/design.md, "När ett
// formulär vägrar"). React 19 nollstaller ett <form action={…}> till sina
// defaultValue nar atgarden ar klar – ocksa nar servern svarat med ett fel –
// och da toms varje okontrollerat falt i formularet. Formularen skickar
// darfor fran onSubmit i en transition (src/lib/skicka-utan-nollstallning.ts).
//
// Ett test per formular dar ett okontrollerat falt annars tappades. Kortet
// Bostaden provas i tester/installningar-storlek-dom.test.ts.

const h = vi.hoisted(() => ({
  redigeraKostnad: vi.fn(async (_f: unknown, _fd: FormData) => ({
    fel: "Fyll i betaldatum.",
    falt: "betaldatum" as const,
  })),
  skapaInbjudan: vi.fn(async (_f: unknown, _fd: FormData) => ({
    fel: "Ägarandelarna blir tillsammans mer än 100 %.",
  })),
  sattNyttLosenord: vi.fn(async (_f: unknown, _fd: FormData) => ({
    fel: "Välj ett annat lösenord än det du hade.",
    falt: "losenord" as const,
  })),
  skapaBilagepaket: vi.fn(async (_f: unknown, _fd: FormData) => ({
    ok: false as const,
    fel: "Något gick fel. Försök igen.",
  })),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/app/kostnad/[id]/actions", () => ({
  redigeraKostnad: h.redigeraKostnad,
  taBortKostnad: vi.fn(async () => ({})),
  aterforTillGenomgang: vi.fn(async () => {}),
  taBortBilagaAction: vi.fn(async () => ({})),
  revalideraKostnadssida: vi.fn(async () => {}),
  taBortUtkastRad: vi.fn(async () => ({})),
  delaUppKostnad: vi.fn(async () => ({})),
}));
vi.mock("@/app/inbjudan/actions", () => ({
  skapaInbjudanAction: h.skapaInbjudan,
  aterkallaInbjudanAction: vi.fn(async () => ({})),
  visaInbjudanAction: vi.fn(async () => ({})),
}));
vi.mock("@/app/losenord/actions", () => ({
  sattNyttLosenord: h.sattNyttLosenord,
  begarAterstallning: vi.fn(async () => ({})),
}));
vi.mock("@/app/export/paket/actions", () => ({ skapaBilagepaket: h.skapaBilagepaket }));
vi.mock("@/lib/bilagepaket/pdf", () => ({ byggBilagepaketPdf: vi.fn() }));

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RedigeraVy } from "@/app/kostnad/[id]/kvitto-kort";
import { TillgangKort } from "@/app/installningar/dela-bostaden";
import { NyttLosenordFormular } from "@/app/losenord/nytt/formular";
import { BilagepaketFlode } from "@/app/export/paket/flode";

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

async function rendera(element: ReactElement) {
  await act(async () => rot.render(element));
}

function falt<T extends HTMLInputElement | HTMLSelectElement>(namn: string): T {
  const e = behallare.querySelector<T>(`[name="${namn}"]:not([type="hidden"])`);
  if (!e) throw new Error(`hittade inget falt ${namn}`);
  return e;
}

async function skriv(namn: string, text: string) {
  const e = falt<HTMLInputElement>(namn);
  const satt = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    satt.call(e, text);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function valj(namn: string, varde: string) {
  const e = falt<HTMLSelectElement>(namn);
  await act(async () => {
    e.value = varde;
    e.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function tryck(text: string) {
  const knapp = [...behallare.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!knapp) throw new Error(`hittade ingen knapp "${text}"`);
  await act(async () => knapp.click());
}

/** Vantar tills serverns fel syns. Syns det aldrig faller testet har, med
 *  vad det vantade pa – i stallet for att prova falten innan svaret kommit. */
async function vantaPaFel(fel: string) {
  for (let i = 0; i < 20 && !behallare.textContent?.includes(fel); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  if (!behallare.textContent?.includes(fel)) throw new Error(`felet "${fel}" visades aldrig`);
}

describe("redigera kvitto", () => {
  it("leverantoren och projektvalet star kvar nar servern avvisar", async () => {
    await rendera(
      createElement(RedigeraVy, {
        // Som KvittoKort skickar det: kvittot hör till bostaden.
        arkiverad: false,
        kostnadId: "d0000000-0000-4000-8000-000000000001",
        projekt: [
          { id: "c0000000-0000-4000-8000-000000000001", namn: "Badrummet", ar: 2025 },
          { id: "c0000000-0000-4000-8000-000000000002", namn: "Sovrummet", ar: 2025 },
        ],
        varden: {
          leverantor: "BAUHAUS",
          totalbelopp: "4658,00",
          totalbeloppVisning: 465_800,
          dokumentdatum: "2025-05-02",
          betaldatum: "2025-05-02",
          projektId: "c0000000-0000-4000-8000-000000000001",
          rotUtnyttjat: "",
          anteckning: "",
        },
        innehav: { tilltradesdatum: "2019-06-01", forsaljningsdatum: null },
        privatDel: { forvalt: "" },
        onAvbryt: () => {},
        onSparat: () => {},
      }),
    );
    await skriv("leverantor", "Byggmax Umeå");
    await valj("projekt_id", "c0000000-0000-4000-8000-000000000002");
    await tryck("Spara");
    expect(h.redigeraKostnad).toHaveBeenCalledTimes(1);
    await vantaPaFel("Fyll i betaldatum.");
    expect({
      leverantor: falt<HTMLInputElement>("leverantor").value,
      projekt: falt<HTMLSelectElement>("projekt_id").value,
    }).toEqual({ leverantor: "Byggmax Umeå", projekt: "c0000000-0000-4000-8000-000000000002" });
  });
});

describe("inbjudan", () => {
  it("e-postadressen star kvar nar servern avvisar", async () => {
    await rendera(
      createElement(TillgangKort, {
        data: { medlemmar: [{ epost: "anna@exempel.se", du: true, andel: 50 }], inbjudningar: [] },
      }),
    );
    await tryck("Bjud in någon till bostaden");
    await skriv("epost", "bertil@exempel.se");
    await tryck("Skapa inbjudan");
    expect(h.skapaInbjudan).toHaveBeenCalledTimes(1);
    await vantaPaFel("Ägarandelarna blir tillsammans mer än 100 %.");
    expect(falt<HTMLInputElement>("epost").value).toBe("bertil@exempel.se");
  });
});

describe("nytt losenord", () => {
  it("losenordet star kvar nar servern avvisar", async () => {
    await rendera(createElement(NyttLosenordFormular));
    await skriv("losenord", "ett-langt-och-noga-valt-losenord");
    await tryck("Spara och logga in");
    expect(h.sattNyttLosenord).toHaveBeenCalledTimes(1);
    await vantaPaFel("Välj ett annat lösenord än det du hade.");
    expect(falt<HTMLInputElement>("losenord").value).toBe("ett-langt-och-noga-valt-losenord");
  });
});

describe("bilagepaketet", () => {
  it("andelen, tilltradesdatumet och identifieringen star kvar nar servern avvisar", async () => {
    await rendera(
      createElement(BilagepaketFlode, {
        agarandel: "",
        tilltradesdatum: "",
        identifiering: "",
        upplatelseform: "fastighet",
      }),
    );
    await skriv("agarandel", "50");
    await skriv("tilltradesdatum", "2019-06-01");
    await skriv("identifiering", "Umeå Tallen 4:2");
    await tryck("Skapa bilagepaket");
    expect(h.skapaBilagepaket).toHaveBeenCalledTimes(1);
    await vantaPaFel("Något gick fel. Försök igen.");
    expect(falt<HTMLInputElement>("agarandel").value).toBe("50");
    expect(falt<HTMLInputElement>("tilltradesdatum").value).toBe("2019-06-01");
    expect(falt<HTMLInputElement>("identifiering").value).toBe("Umeå Tallen 4:2");
  });
});
