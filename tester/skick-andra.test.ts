// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// Skicket vid forsaljningen gar att andra (CLAUDE.md: varje tillstand appen
// kan hamna i ska ha en vag ut). Skicket multiplicerar hela reparationsdelen,
// och forsaljningsflodet fragar bara om obesvarade atgarder – ett feltryck
// gick forut inte att rata nagonstans. Vagen ar projektets redigering, med en
// lank bredvid raden pa projektsidan. Fore forsaljningen visas fragan inte.
//
// Provat pa det som renderas: formularet renderas i en DOM, dess eget
// FormData skickas till den riktiga actionen, mot en falsk databas.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return {
    db: skapaFalskDatabas(),
    Omdirigering,
    inloggad: null as { id: string; email: string } | null,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/forsaljning/samma-del",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "bostad.test" }) }));
vi.mock("@sentry/nextjs", () => ({ setUser: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseKonfigurerad: () => true,
  skapaServerklient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.inloggad } }) },
  }),
}));
vi.mock("@/lib/lagring/klient", () => ({
  BILAGOR_BUCKET: "bilagor",
  bilagelager: () => ({ createSignedUrls: vi.fn(async () => ({ data: [], error: null })) }),
  lagringsklient: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { redigeraProjekt } from "@/app/projekt/actions";
import { RedigeraProjektForm } from "@/app/projekt/[id]/redigera/form";
import RedigeraProjektSida from "@/app/projekt/[id]/redigera/page";
import ProjektSida from "@/app/projekt/[id]/page";
import { SKICK_FORSALJNING_FRAGA, SKICK_ORD } from "@/doman/fragetradet";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANNA = "a0000000-0000-4000-8000-000000000001";
const X = "b0000000-0000-4000-8000-00000000000a";
const FASAD = "c0000000-0000-4000-8000-000000000001";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function seeda({ sald = true }: { sald?: boolean } = {}) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  db.lagg("bostad", {
    id: X,
    adress: "Storgatan 1",
    upplatelseform: "fastighet",
    tilltradesdatum: datum("2015-06-01"),
    bostadsfragor_besvarade: true,
    forsta_agare: false,
    ...(sald ? { forsaljningsdatum: datum("2026-09-15") } : {}),
  });
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  h.db.lagg("projekt", {
    id: FASAD,
    bostad_id: X,
    namn: "Måla fasaden",
    ar: 2022,
    atgardstyp: "utbytt",
    battre_kvalitet: false,
    skick_forvarv: 1,
    skick_forsaljning: sald ? 4 : null,
  });
  const k = h.db.lagg("kostnad", {
    bostad_id: X,
    leverantor: "Målerifirman",
    totalbelopp: 3_000_000,
    dokumentdatum: datum("2022-06-01"),
    betaldatum: datum("2022-06-01"),
  });
  const rad = h.db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: "Målning", belopp: 3_000_000 });
  h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: FASAD, andel: 1 });
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

async function omdirigeringFran(anrop: () => Promise<unknown>): Promise<string | null> {
  try {
    await anrop();
    return null;
  } catch (e) {
    if (e instanceof h.Omdirigering) return e.url;
    throw e;
  }
}

function elementFor(nod: unknown, namn: string): ReactElement<Record<string, unknown>>[] {
  if (nod == null || typeof nod !== "object") return [];
  if (Array.isArray(nod)) return nod.flatMap((n) => elementFor(n, namn));
  const el = nod as ReactElement<Record<string, unknown>> & { type?: unknown };
  const egen = typeof el.type === "function" && (el.type as { name: string }).name === namn ? [el] : [];
  return [...egen, ...elementFor(el.props?.children, namn)];
}

/** Element av en viss sort vars HELA text ar exakt den har – aldrig en delstrang. */
function medText(rot: ParentNode, tagg: string, text: string): Element[] {
  return [...rot.querySelectorAll(tagg)].filter((e) => e.textContent?.trim() === text);
}

const projektet = () => h.db.tabell("projekt").find((p) => p.id === FASAD)!;
const kort = (siffra: number) => `${siffra} – ${SKICK_ORD[siffra]}`;

let behallare: HTMLDivElement;
let rot: Root;
beforeEach(() => {
  seeda();
  behallare = document.createElement("div");
  document.body.appendChild(behallare);
  rot = createRoot(behallare);
});
afterEach(() => {
  act(() => rot.unmount());
  behallare.remove();
});

/** Redigeringens formular, som sidan bygger det, renderat i en DOM. */
async function redigering() {
  const vy = await RedigeraProjektSida({ params: Promise.resolve({ id: FASAD }) });
  const [formular] = elementFor(vy, "RedigeraProjektForm");
  expect(formular, "sidan visar inte formularet").toBeTruthy();
  await act(async () => rot.render(createElement(RedigeraProjektForm, formular.props as never)));
  return behallare.querySelector("form")!;
}

/** Ett kort i fraga 7:s grupp – fraga 6 ovanfor har kort med samma text. */
function knapp(text: string): HTMLButtonElement | undefined {
  const [legend] = medText(behallare, "legend", SKICK_FORSALJNING_FRAGA);
  expect(legend, "fraga 7 saknas").toBeTruthy();
  return medText(legend.closest("fieldset")!, "button", text)[0] as HTMLButtonElement | undefined;
}

describe("ett besvarat skick går att ändra i redigeringen", () => {
  it("frågan står där, med det tidigare svaret ifyllt", async () => {
    await redigering();
    expect(medText(behallare, "legend", SKICK_FORSALJNING_FRAGA)).toHaveLength(1);
    expect(knapp(kort(4))?.getAttribute("aria-pressed")).toBe("true");
  });

  it("ett nytt svar sparas – formulärets eget FormData till den riktiga actionen", async () => {
    const form = await redigering();
    await act(async () => knapp(kort(3))!.click());
    const till = await omdirigeringFran(() => redigeraProjekt({}, new FormData(form)));
    expect(till).toBe(`/projekt/${FASAD}`);
    expect(projektet().skick_forsaljning).toBe(3);
    // Ett svar som klassificeringen – "Besvarat av".
    expect(projektet().klassificerad_av).toBe(ANNA);
  });

  it("att spara utan att röra skicket lämnar det orört", async () => {
    const form = await redigering();
    await omdirigeringFran(() => redigeraProjekt({}, new FormData(form)));
    expect(projektet().skick_forsaljning).toBe(4);
  });
});

describe("före försäljningen", () => {
  beforeEach(() => seeda({ sald: false }));

  it("visas frågan inte", async () => {
    await redigering();
    expect(medText(behallare, "legend", SKICK_FORSALJNING_FRAGA)).toHaveLength(0);
    expect(behallare.querySelector('input[name="skick_forsaljning"]')).toBeNull();
  });

  it("och ett handskrivet värde sparas inte", async () => {
    const form = await redigering();
    const data = new FormData(form);
    data.set("skick_forsaljning", "3");
    await omdirigeringFran(() => redigeraProjekt({}, data));
    expect(projektet().skick_forsaljning).toBeNull();
  });
});

describe("ingången från projektsidan", () => {
  async function skickraden(): Promise<HTMLElement> {
    const vy = await ProjektSida({ params: Promise.resolve({ id: FASAD }) });
    const rad = elementFor(vy, "Rad").find((r) => r.props.etikett === "Skick vid försäljningen");
    expect(rad, "ingen skickrad").toBeTruthy();
    const d = document.createElement("div");
    d.innerHTML = renderToStaticMarkup(rad!);
    return d;
  }

  it("ett besvarat skick har länken Ändra till redigeringen", async () => {
    const [lank] = medText(await skickraden(), "a", "Ändra");
    expect(lank?.getAttribute("href")).toBe(`/projekt/${FASAD}/redigera`);
  });

  it("ett obesvarat har ingen länk – det besvaras i försäljningsflödet", async () => {
    projektet().skick_forsaljning = null;
    expect(medText(await skickraden(), "a", "Ändra")).toHaveLength(0);
  });
});
