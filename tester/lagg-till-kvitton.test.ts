// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGELPARAMETRAR } from "./_hjalp";

// "Lägg till kvitton" på ett projekt som redan finns (docs/design.md, "Att
// lägga kvitton till ett projekt som redan finns"): flera kvitton i ett svep,
// med samma lista och samma urval som projektskapandets sista steg. Fas 1 var
// till 2026-11-13 det enda stället det gick.
//
// Och merkostnaden: ett projekt som sparats som bättre kvalitet utan belopp
// väntar på frågan. Får projektet ett belopp här ställs den här, i samma
// formulär, med spärren mot projektets nya belopp – den lämnas inte åt en
// upplysning efteråt.

const h = await vi.hoisted(async () => {
  const { skapaFalskDatabas } = await import("./_falsk-databas");
  class Omdirigering extends Error {
    constructor(public url: string) {
      super(`NEXT_REDIRECT ${url}`);
    }
  }
  return { db: skapaFalskDatabas(), Omdirigering, inloggad: null as { id: string; email: string } | null };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.db.klient }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new h.Omdirigering(url);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/projekt",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
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

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { laggTillKvitton } from "@/app/projekt/[id]/kvitton/actions";
import LaggTillSida from "@/app/projekt/[id]/kvitton/page";
import ProjektSida from "@/app/projekt/[id]/page";
import NyttProjektSida from "@/app/projekt/nytt/page";
import { utkastNyckel } from "@/app/projekt/nytt/flode";
import { MERKOSTNAD_MASTE_ANGES, merkostnadOverBeloppetFel } from "@/lib/fragetradet-formdata";
import { MERKOSTNAD_ANDRAD_FRAGA } from "@/doman/regeltext";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};

const ANNA = "a0000000-0000-4000-8000-000000000061";
const X = "b0000000-0000-4000-8000-000000000061";
const Y = "b0000000-0000-4000-8000-000000000062";
const P = "c0000000-0000-4000-8000-000000000061";
const ANNAT = "c0000000-0000-4000-8000-000000000062";
const datum = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ids: Record<string, string> = {};

function seeda(projekt: Record<string, unknown> = { atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: null, merkostnad_bas: null, skick_forvarv: 1 }) {
  const { db } = h;
  db.nollstall();
  for (const r of REGELPARAMETRAR) {
    db.lagg("regelparameter", { ...r, giltig_fran: datum(r.giltig_fran), giltig_till: null });
  }
  db.lagg("anvandare", { id: ANNA, epost: "anna@exempel.se" });
  for (const id of [X, Y]) {
    db.lagg("bostad", { id, adress: "Storgatan 1", upplatelseform: "fastighet", tilltradesdatum: datum("2019-06-01"), nybyggd_vid_forvarv: false });
  }
  db.lagg("medlemskap", { anvandare_id: ANNA, bostad_id: X, agarandel: 100 });
  db.lagg("projekt", { id: P, bostad_id: X, namn: "Nytt golv", ar: 2026, ...projekt });
  db.lagg("projekt", { id: ANNAT, bostad_id: X, namn: "Nya taklampor", ar: 2026, atgardstyp: "utbytt", battre_kvalitet: false, skick_forvarv: 2 });
  for (const [namn, belopp, betald, bostad, kopplad] of [
    ["parkett", 1_200_000, "2026-05-02", X, null],
    ["lister", 80_000, "2026-05-09", X, null],
    ["obetald", 300_000, null, X, null],
    ["lampor", 69_000, "2026-06-03", X, ANNAT],
    ["annans", 50_000, "2026-01-01", Y, null],
  ] as const) {
    const k = db.lagg("kostnad", {
      bostad_id: bostad, leverantor: "Golvpoolen", anteckning: `Kvitto för ${namn}`, totalbelopp: belopp,
      dokumentdatum: datum(betald ?? "2026-07-01"), betaldatum: betald ? datum(betald) : null,
    });
    ids[namn] = k.id as string;
    const rad = db.lagg("kostnadsrad", { kostnad_id: k.id, artikel: namn, belopp });
    if (kopplad) db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: kopplad, andel: 1 });
  }
  h.inloggad = { id: ANNA, email: "anna@exempel.se" };
}

function formular(kvitton: string[], merkostnad?: string): FormData {
  const f = new FormData();
  f.set("projekt_id", P);
  for (const k of kvitton) f.append("kostnad_ider", ids[k]);
  if (merkostnad !== undefined) f.set("merkostnad", merkostnad);
  return f;
}

const kopplade = (projekt: string) => {
  const radTillKostnad = new Map(h.db.tabell("kostnadsrad").map((r) => [r.id as string, r.kostnad_id as string]));
  const namn = new Map(Object.entries(ids).map(([n, id]) => [id, n]));
  return h.db.tabell("radfordelning").filter((f) => f.projekt_id === projekt).map((f) => namn.get(radTillKostnad.get(f.kostnadsrad_id as string)!)).sort();
};
const projektet = () => h.db.tabell("projekt").find((p) => p.id === P)!;

beforeEach(() => seeda({ atgardstyp: "utbytt", battre_kvalitet: false, merkostnad: null, skick_forvarv: 1 }));

describe("flera kvitton i ett svep", () => {
  it("kopplar de valda, och hoppar över ett som hör till ett annat projekt eller en annan bostad", async () => {
    await expect(laggTillKvitton({}, formular(["parkett", "lister", "lampor", "annans"]))).rejects.toThrow(`NEXT_REDIRECT /projekt/${P}`);
    expect(kopplade(P)).toEqual(["lister", "parkett"]);
    expect(kopplade(ANNAT)).toEqual(["lampor"]);
  });

  it("utan valt kvitto sparas ingenting", async () => {
    const fore = h.db.ogonblick();
    expect(await laggTillKvitton({}, formular([]))).toEqual({ fel: "Välj minst ett kvitto.", falt: "kvitton" });
    expect(h.db.ogonblick()).toEqual(fore);
  });

  it("ett kvitto som kopplas någon annanstans under tiden – ingenting sparas", async () => {
    let kapat = false;
    h.db.lyssna((modell) => {
      if (modell !== "kostnad" || kapat) return;
      kapat = true;
      const rad = h.db.tabell("kostnadsrad").find((r) => r.kostnad_id === ids.lister)!;
      h.db.lagg("radfordelning", { kostnadsrad_id: rad.id, projekt_id: ANNAT, andel: 1 });
    });
    const svar = await laggTillKvitton({}, formular(["parkett", "lister"]));
    expect(kapat).toBe(true);
    expect(svar.fel).toBe("Ett av kvittona hann kopplas till ett annat projekt medan du valde. Ladda om sidan och välj kvittona igen.");
    expect(kopplade(P)).toEqual([]);
  });
});

describe("merkostnaden som väntade", () => {
  beforeEach(() => seeda());

  it("får projektet ett belopp krävs svaret, och ingenting kopplas utan det", async () => {
    const fore = h.db.ogonblick();
    expect(await laggTillKvitton({}, formular(["parkett"]))).toEqual({ fel: MERKOSTNAD_MASTE_ANGES, falt: "merkostnad" });
    expect(h.db.ogonblick()).toEqual(fore);
  });

  it("spärren gäller mot projektets nya belopp – lika med beloppet avvisas", async () => {
    expect(await laggTillKvitton({}, formular(["parkett", "lister"], "12 800"))).toEqual({
      fel: merkostnadOverBeloppetFel("Nytt golv", 1_280_000),
      falt: "merkostnad",
    });
  });

  it("ett giltigt svar sparas med det nya beloppet som bas", async () => {
    await expect(laggTillKvitton({}, formular(["parkett", "lister"], "5 000"))).rejects.toThrow("NEXT_REDIRECT");
    expect(projektet()).toMatchObject({ merkostnad: 500_000, merkostnad_bas: 1_280_000, klassificerad_av: ANNA });
    expect(kopplade(P)).toEqual(["lister", "parkett"]);
  });

  it("bara ett obetalt kvitto ger inget belopp – frågan väntar vidare", async () => {
    await expect(laggTillKvitton({}, formular(["obetald"]))).rejects.toThrow("NEXT_REDIRECT");
    expect(projektet()).toMatchObject({ merkostnad: null, merkostnad_bas: null });
    expect(kopplade(P)).toEqual(["obetald"]);
  });

  it("ett projekt med givet svar frågas inte här – det ändrade projektet frågar på sin sida", async () => {
    seeda({ atgardstyp: "utbytt", battre_kvalitet: true, merkostnad: 100_000, merkostnad_bas: 1_200_000, skick_forvarv: 1 });
    // Förutsättningen: svaret stämmer mot projektet innan något läggs till.
    h.db.lagg("radfordelning", { kostnadsrad_id: h.db.tabell("kostnadsrad").find((r) => r.kostnad_id === ids.parkett)!.id, projekt_id: P, andel: 1 });
    const foreSida = document.createElement("div");
    foreSida.innerHTML = renderToStaticMarkup(await ProjektSida({ params: Promise.resolve({ id: P }) }));
    expect(foreSida.textContent).not.toContain(MERKOSTNAD_ANDRAD_FRAGA);

    await expect(laggTillKvitton({}, formular(["lister"], "999 999"))).rejects.toThrow("NEXT_REDIRECT");
    expect(projektet()).toMatchObject({ merkostnad: 100_000, merkostnad_bas: 1_200_000 });
    const sida = document.createElement("div");
    sida.innerHTML = renderToStaticMarkup(await ProjektSida({ params: Promise.resolve({ id: P }) }));
    expect(sida.textContent).toContain(MERKOSTNAD_ANDRAD_FRAGA);
  });
});

describe("sidan", () => {
  async function rendera(vy: unknown): Promise<{ div: HTMLDivElement; stang: () => void }> {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const rot = createRoot(div);
    await act(async () => rot.render((await vy) as Parameters<typeof rot.render>[0]));
    return { div, stang: () => { act(() => rot.unmount()); div.remove(); } };
  }

  it("är samma lista som projektskapandets sista steg, rad för rad", async () => {
    const lagg = await rendera(LaggTillSida({ params: Promise.resolve({ id: P }) }));
    window.localStorage.setItem(utkastNyckel(X), JSON.stringify({
      steg: 4, namn: "Nytt golv", bostadsdelar: [],
      svar: { byggdeNytt: "ja", andradePlanlosning: "", nyttEllerBytt: "", battreEllerLiknande: "", merkostnad: null, merkostnadText: "", skickForvarv: "", motivering: "" },
      valda: [],
    }));
    const nytt = await rendera(NyttProjektSida());
    const lista = (div: HTMLElement) => div.querySelector('ul:has(input[type="checkbox"])')!.outerHTML;
    // Förutsättningen: listan har rader, och samma rader som urvalet säger.
    expect(lagg.div.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(lista(lagg.div)).toBe(lista(nytt.div));
    lagg.stang();
    nytt.stang();
    window.localStorage.clear();
  });

  it("merkostnadsfältet kommer när ett valt kvitto ger projektet ett belopp", async () => {
    seeda();
    const s = await rendera(LaggTillSida({ params: Promise.resolve({ id: P }) }));
    const falt = () => [...s.div.querySelectorAll<HTMLInputElement>("input")].find((i) => i.placeholder === "t.ex. 500") ?? null;
    const ruta = (namn: string) =>
      [...s.div.querySelectorAll("label")].find((l) => l.textContent?.includes(`Kvitto för ${namn}`))!.querySelector("input")!;
    expect(falt()).toBeNull();
    await act(async () => ruta("obetald").click());
    expect(falt(), "ett obetalt kvitto ger inget belopp").toBeNull();
    await act(async () => ruta("parkett").click());
    expect(falt()).not.toBeNull();
    s.stang();
  });

  it("projektets sida har länken under Kvitton när det finns kvitton att välja, annars inte", async () => {
    const lankar = async () => {
      const div = document.createElement("div");
      div.innerHTML = renderToStaticMarkup(await ProjektSida({ params: Promise.resolve({ id: P }) }));
      return [...div.querySelectorAll("a")].filter((a) => a.textContent === "Lägg till kvitton").map((a) => a.getAttribute("href"));
    };
    expect(await lankar()).toEqual([`/projekt/${P}/kvitton`]);
    for (const k of ["parkett", "lister", "obetald"]) {
      h.db.lagg("radfordelning", { kostnadsrad_id: h.db.tabell("kostnadsrad").find((r) => r.kostnad_id === ids[k])!.id, projekt_id: ANNAT, andel: 1 });
    }
    expect(await lankar()).toEqual([]);
  });
});
