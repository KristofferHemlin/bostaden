// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Namnfaltet i fas 2 ar tomt, aven nar forsta kvittot har en anteckning
// (docs/design.md, "Namnfältet är tomt, och föreslår ingenting"). Anteckningen
// och namnet svarar pa olika fragor, och anteckningen star redan i
// kvittolistan ovanfor.
//
// Till 2026-11-04 var faltet forifyllt med anteckningen fram till forsta
// skiljetecknet. Fem projekt i testkontot fick da namn som "Totalrenovering av
// badrummet – nNytt badrumytt tätskikt": namnet skrevs in dar markoren
// hamnade vid klicket.
//
// Provat pa det som renderas: den riktiga sidan kors mot en falsk databas, och
// fas 2 renderas ur sidans eget trad – forifyllningen satt i sidan, inte i
// komponenten, sa det ar sidan som maste provas.
//
// Och namnet ar fortfarande obligatoriskt: ett tomt svar avvisas vid faltet
// och nar aldrig servern. Serverns tolkning ar provad for sig
// (tester/formular-vagrar.test.ts, "tomt namn pekar ut fråga 1"); har provas
// att formularet som renderas foljer den.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  return {
    db: skapaFalskDatabas(),
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
const klassificeraHog = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/app/genomgang/fragor/actions", () => ({ klassificeraHog }));

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import FragorSida from "@/app/genomgang/fragor/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const HOG = "c0000000-0000-4000-8000-00000000000a";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ANTECKNING = "Totalrenovering av badrummet – nytt tätskikt, klinker och kommod";

function seeda() {
  const { db } = h;
  db.nollstall();
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2019-06-01"),
    nybyggd_vid_forvarv: false,
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  // En hog fran fas 1: inget namn, fragorna obesvarade.
  db.lagg("projekt", { id: HOG, bostad_id: X, namn: "", ar: 2025, atgardstyp: null });
  const k = h.db.lagg("kostnad", {
    bostad_id: X,
    leverantor: "Kakelhuset",
    anteckning: ANTECKNING,
    totalbelopp: 7_000_000,
    dokumentdatum: datum("2025-03-14"),
    betaldatum: datum("2025-03-14"),
    skapad_av: ANNA,
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Badrum", belopp: 7_000_000 });
  h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: HOG, andel: 1 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

/** Elementen i tradet vars komponent heter `namn`. */
function elementFor(nod: unknown, namn: string): ReactElement[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<{ children?: unknown }> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

let behallare: HTMLDivElement;
let rot: Root;

beforeEach(() => {
  seeda();
  klassificeraHog.mockClear();
  vi.stubGlobal("scrollTo", () => {});
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});

afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
  vi.unstubAllGlobals();
});

/** Fragesidans fas 2, renderad ur sidans eget trad. */
async function renderaFas2() {
  const vy = await FragorSida();
  const [fas2] = elementFor(vy, "Fas2");
  expect(fas2, "sidan visar inte fas 2").toBeTruthy();
  await act(async () => rot.render(fas2));
}

function namnfaltet(): HTMLInputElement {
  const falt = behallare.querySelector<HTMLInputElement>('input[type="text"]');
  if (!falt) throw new Error("Namnfaltet renderades inte");
  return falt;
}

describe("namnfaltet i fas 2", () => {
  it("ar tomt, aven nar forsta kvittot har en anteckning", async () => {
    await renderaFas2();
    expect(namnfaltet().value).toBe("");
    expect(behallare.querySelector<HTMLInputElement>('input[type="hidden"][name="namn"]')!.value).toBe("");
  });

  // Texten finns i listan. Hur manga rader den far provas i
  // tester/anteckning-tva-rader-layout.test.ts – jsdom raknar inte ut layout.
  it("anteckningen star i kvittolistan ovanfor", async () => {
    await renderaFas2();
    // Hela texten i ett element i listan – inte en klass, som kan bytas.
    const texter = [...behallare.querySelectorAll("section li *")].map((el) => el.textContent);
    expect(texter).toContain(ANTECKNING);
  });

  it("ett tomt namn avvisas vid faltet och nar aldrig servern", async () => {
    await renderaFas2();
    const form = behallare.querySelector("form")!;
    await act(async () => form.requestSubmit());
    expect(klassificeraHog).not.toHaveBeenCalled();
    const falt = namnfaltet();
    expect(falt.getAttribute("aria-invalid")).toBe("true");
    // Felet som faltet pekar ut, inte en text nagonstans pa sidan.
    const felId = falt.getAttribute("aria-describedby");
    expect(felId, "faltet pekar inte ut nagot fel").toBeTruthy();
    expect(document.getElementById(felId!)!.textContent).toBe("Skriv vad du gjorde.");
  });
});
